import { z } from 'zod';
import type { ArselTool } from './define.js';
import { segmentFilter } from './segment-filter.js';
import { id, pagination, QUIET_IDS } from './shared.js';

const AUTOMATION_STATUSES = ['draft', 'enabled', 'disabled'] as const;
const RUN_STATUSES = ['running', 'waiting', 'completed', 'failed', 'cancelled'] as const;
const TRIGGER_EVENTS = [
  'contact_created',
  'contact_unsubscribed',
  'tag_added',
  'list_added',
  'form_submitted',
  'entered_segment',
  'email_opened',
  'email_clicked',
  'email_bounced',
  'sms_clicked',
  'push_opened',
  'push_clicked',
  'in_app_shown',
  'in_app_clicked',
  'in_app_dismissed',
  'custom_event',
] as const;

const ENABLE_NOTE =
  'This server cannot enable or disable an automation: once `issues` is empty, the user turns it on from the Arsel dashboard. Saving steps messages nobody.';

const uuid = (description: string) => z.guid().nullish().describe(description);
const text = (max: number) => z.string().min(1).max(max).nullish();
const duration = z.strictObject({
  value: z.int().min(1),
  unit: z.enum(['minutes', 'hours', 'days']),
});
const smartSending = z
  .boolean()
  .nullish()
  .describe("On unless `false`: skips the contact if they got a message on this channel within the organization's Smart Sending window.");
const stringMap = z.record(z.string(), z.string().max(1024));
const filter = (description: string) => segmentFilter.nullish().describe(description);

// One schema per step type, as the API publishes them. A draft may leave any
// config value out or null; `issues` on the automation names what is missing.
const step = <T extends string, C extends z.ZodRawShape>(
  type: T,
  description: string,
  config: C,
) =>
  z
    .strictObject({
      key: z
        .string()
        .max(64)
        .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
        .describe(
          'Chosen by you and never changed: the step’s identity in connections, runs and results, e.g. `welcome_email`.',
        ),
      type: z.literal(type),
      name: z.string().max(255).describe('Shown in the dashboard and in runs.'),
      config: z.strictObject(config),
    })
    .describe(description);

const tagConfig = { tag_id: uuid('From list-tags.') };
const listConfig = { list_id: uuid('From list-lists.') };

const steps = z
  .array(
    z.discriminatedUnion('type', [
      z
        .strictObject({
          key: z.literal('trigger'),
          type: z.literal('trigger'),
          name: z.string().max(255),
          config: z.strictObject({
            event: z.enum(TRIGGER_EVENTS).nullish(),
            tag_id: uuid('For `tag_added`, from list-tags.'),
            list_id: uuid('For `list_added`, from list-lists.'),
            form_id: uuid('For `form_submitted`. This server cannot list forms: ask the user.'),
            segment_id: uuid('For `entered_segment`, from list-segments.'),
            campaign_id: uuid(
              "For the email, SMS, push and in-app events, from that channel's campaign list tool, e.g. list-email-campaigns. Required for the email and SMS events; left out for push and in-app, any campaign counts.",
            ),
            event_name: text(255).describe('For `custom_event`, an event name from list-events.'),
            reentry: z
              .strictObject({
                mode: z.enum(['always', 'once', 'window', 'not_while_active']),
                window_hours: z
                  .int()
                  .min(1)
                  .max(8760)
                  .nullish()
                  .describe('With `window`: hours before the contact may enter again.'),
              })
              .nullish()
              .describe(
                'Whether a contact may enter again: `always`, `once` ever, `not_while_active` (not while a run of theirs is in progress) or after a `window`. Unset reads as `always`.',
              ),
          }),
        })
        .describe('What starts a run. Exactly one, keyed `trigger`. Set only the target field its `event` uses.'),
      step('send_email', 'Sends an email template.', {
        template_id: uuid('An email template from list-templates.'),
        from_domain: text(255).describe("A `verified` domain from list-email-domains."),
        from_prefix: z
          .string()
          .regex(/^[A-Za-z0-9._%+-]{1,64}$/)
          .nullish()
          .describe('The part of the sender address before the @, e.g. `hello`.'),
        from_name: text(255),
        reply_to: z.email().max(320).nullish(),
        subject: text(998).describe("Overrides the template's subject. May use merge tags."),
        preheader: text(255),
        smart_sending: smartSending,
      }),
      step(
        'send_sms',
        'Sends an SMS. The sender is chosen per contact, from the senders registered for `purpose` in the contact’s country (list-sms-senders).',
        {
          content: text(1600).describe('May use merge tags.'),
          purpose: z.enum(['marketing', 'transactional']).nullish(),
          sender_by_country: z
            .record(z.string().max(32), z.string().min(1).max(64))
            .nullish()
            .describe('Country → sender name, only where a country has several senders for `purpose`.'),
          smart_sending: smartSending,
        },
      ),
      step('send_whatsapp', 'Sends an approved WhatsApp template.', {
        template_name: text(512).describe('From list-whatsapp-templates, `approved` only.'),
        language: text(16).describe("The template's language code."),
        parameters: stringMap
          .nullish()
          .describe('Each template variable → its value, which may use merge tags.'),
        smart_sending: smartSending,
      }),
      step('send_push', 'Sends a push notification to every device of the contact.', {
        title: text(200),
        body: text(1000),
        image_url: text(2048),
        icon_url: text(2048),
        deep_link: text(2048),
        android_channel_id: text(128),
        action_buttons: z
          .array(
            z.strictObject({
              action_id: z.string().min(1).max(64),
              label: z.string().min(1).max(64),
              deep_link: z.string().min(1).max(2048).nullish(),
            }),
          )
          .max(3)
          .nullish(),
        data: stringMap.nullish().describe('Key-value data delivered to the app.'),
        ttl_seconds: z.int().min(60).max(2419200).nullish(),
        priority: z.enum(['high', 'normal']).nullish(),
        smart_sending: smartSending,
      }),
      step('show_in_app', 'Shows an in-app campaign to the contact.', {
        campaign_id: uuid('From list-in-app-campaigns.'),
        expires_in_days: z.int().min(1).max(90).nullish(),
      }),
      step('add_tag', 'Adds a tag to the contact.', tagConfig),
      step('remove_tag', 'Removes a tag from the contact.', tagConfig),
      step('add_to_list', 'Adds the contact to a list.', listConfig),
      step('remove_from_list', 'Removes the contact from a list.', listConfig),
      step(
        'update_contact',
        'Writes values to the contact as given: merge tags are not rendered. Set at least one.',
        {
          first_name: text(100),
          last_name: text(100),
          email: z.email().max(320).nullish(),
          phone_number: z
            .string()
            .regex(/^\+?[0-9]{6,20}$/)
            .nullish()
            .describe('Digits only, with the country code.'),
          properties: z
            .record(z.string(), z.union([z.string().max(1000), z.number(), z.boolean()]))
            .nullish()
            .describe('Custom property key → value; keys from list-contact-properties.'),
        },
      ),
      step('delay', 'Holds the run for `duration`, at most 365 days.', {
        duration: duration.nullish(),
      }),
      step(
        'condition',
        'Splits the run: leaves by `condition_met` when the contact matches `filter`, otherwise by `condition_not_met`.',
        { filter: filter('The rules the contact must match now.') },
      ),
      step(
        'wait_for_event',
        "Holds the run until the contact's activity matches `filter` (leaves by `event_received`) or `timeout` passes (leaves by `timeout`).",
        {
          filter: filter(
            'What the contact must do, e.g. an `event` rule, or a `message_engagement` rule on an earlier send step of this automation.',
          ),
          timeout: duration.nullish(),
        },
      ),
    ]),
  )
  .describe('Every step, the trigger included. Send it with `connections`; together they replace what was there.');

const connections = z
  .array(
    z.strictObject({
      from: z.string().describe('Key of the step it leaves.'),
      to: z.string().describe('Key of the step it enters.'),
      type: z.enum(['default', 'condition_met', 'condition_not_met', 'event_received', 'timeout']),
    }),
  )
  .describe('Send it with `steps`.');

const GRAPH_GUIDE = `**Shape.** An automation is a graph. \`steps\` holds every step, the trigger included (key \`trigger\`), and \`connections\` link them by key. A step leaves by \`default\`, except a \`condition\` (\`condition_met\`, \`condition_not_met\`) and a \`wait_for_event\` (\`event_received\`, \`timeout\`). A branch with no connection ends the run. Every step must be reachable from the trigger, no connection may lead back to an earlier step, and branches that split must rejoin at one step or not at all. At most 100 steps.

**Look up what the steps name before writing them.** Tags from list-tags, lists from list-lists, segments from list-segments, email templates from list-templates, sending domains from list-email-domains, SMS senders from list-sms-senders, WhatsApp templates from list-whatsapp-templates, custom properties from list-contact-properties, events from list-events, campaigns from the channel's campaign list tool.

**Conditions and waits** take a \`filter\` in the segment rule format. To react to a message this automation sent, use a \`message_engagement\` rule with \`target_type: automation_step\` and the send step's key as \`target_id\`; that step must always run before.

**Drafts may be unfinished.** The automation comes back with \`issues\`, each naming a \`step_key\` and the config \`path\` still missing or wrong. Fix them with update-automation. A graph that breaks a rule of the shape above is refused and nothing is saved.`;

export const automationTools: ArselTool[] = [
  {
    name: 'list-automations',
    title: 'List Automations',
    scope: 'read',
    method: 'GET',
    path: '/automations',
    description: `List automations, newest first, with their \`status\`: \`draft\` until first enabled, then \`enabled\` or \`disabled\`. ${QUIET_IDS}`,
    inputSchema: z.object({
      ...pagination,
      status: z.enum(AUTOMATION_STATUSES).optional().describe('Only automations in this status.'),
    }),
  },
  {
    name: 'get-automation',
    title: 'Get Automation',
    scope: 'read',
    method: 'GET',
    path: '/automations/{id}',
    description:
      'Get one automation: its latest `steps` and `connections`, in the format create-automation and update-automation accept, and the `issues` left before it can be enabled.',
    inputSchema: z.object({ id: id('automation') }),
  },
  {
    name: 'create-automation',
    title: 'Create Automation',
    scope: 'write',
    method: 'POST',
    path: '/automations',
    description: `Create an automation as a \`draft\`: a journey each contact who matches the trigger goes through. Send \`steps\` and \`connections\` to build it, or only \`name\` for an empty draft. ${ENABLE_NOTE}

${GRAPH_GUIDE}`,
    inputSchema: z.object({
      name: z.string().min(1).max(255),
      steps: steps.optional(),
      connections: connections.optional(),
    }),
    withheld: ['status'],
  },
  {
    name: 'update-automation',
    title: 'Update Automation',
    scope: 'write',
    destructive: true,
    method: 'PATCH',
    path: '/automations/{id}',
    description: `Rename an automation or replace its steps. Omitted fields are unchanged.

\`steps\` with \`connections\` REPLACE the whole graph: read it with get-automation, edit it and send all of it back, keeping each step's \`key\`. The steps of an \`enabled\` automation cannot be replaced: tell the user to disable it in the Arsel dashboard first, or build the change on a copy from clone-automation. The steps of a \`disabled\` one take effect when the user enables it again, so confirm with the user first, naming the automation. ${ENABLE_NOTE}

${GRAPH_GUIDE}`,
    inputSchema: z.object({
      id: id('automation'),
      name: z.string().min(1).max(255).optional(),
      steps: steps.optional(),
      connections: connections.optional(),
    }),
    withheld: ['status'],
  },
  {
    name: 'clone-automation',
    title: 'Clone Automation',
    scope: 'write',
    method: 'POST',
    path: '/automations/{id}/clone',
    description: 'Copy an automation’s latest steps into a new `draft` named “Copy of …”.',
    inputSchema: z.object({ id: id('automation') }),
  },
  {
    name: 'list-automation-runs',
    title: 'List Automation Runs',
    scope: 'read',
    method: 'GET',
    path: '/automations/{id}/runs',
    description: `List the runs of an automation, newest first: one per contact entry, with its \`status\`, the step it is on and why it failed. ${QUIET_IDS}`,
    inputSchema: z.object({
      id: id('automation'),
      ...pagination,
      status: z
        .string()
        .optional()
        .describe(`Only runs in these statuses, comma-separated: ${RUN_STATUSES.map((s) => `\`${s}\``).join(', ')}.`),
      contact_id: z.guid().optional().describe('Only the runs of this contact, from list-contacts.'),
    }),
  },
  {
    name: 'get-automation-run',
    title: 'Get Automation Run',
    scope: 'read',
    method: 'GET',
    path: '/automations/{id}/runs/{run_id}',
    description:
      'Get one run: what started it and each step it went through, `completed`, `skipped` (with the reason a message was not sent, e.g. `no_email` or `suppressed`) or `failed`. Use it to explain why a contact did or did not get a message.',
    inputSchema: z.object({ id: id('automation'), run_id: id('run') }),
  },
];
