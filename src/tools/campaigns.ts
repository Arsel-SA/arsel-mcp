import { z } from 'zod';
import type { ArselTool } from './define.js';
import {
  AUDIENCE_NOTE,
  DRAFT_NOTE,
  id,
  ids,
  pagination,
  PLATFORMS,
  QUIET_IDS,
  search,
} from './shared.js';

const EDITABLE_NOTE =
  'Only `draft` and `scheduled` campaigns can be edited. Editing a scheduled campaign changes what goes out at its scheduled time, so confirm with the user first. Omitted fields are unchanged.';

const DELIVERY_STATUSES = [
  'draft',
  'scheduled',
  'queued',
  'sending',
  'sent',
  'paused',
  'failed',
  'cancelled',
] as const;

const status = (values: readonly [string, ...string[]]) =>
  z.enum(values).optional().describe('Only campaigns in this status.');

const listFields = (statuses: readonly [string, ...string[]]) => ({
  ...pagination,
  search: search('campaign name'),
  status: status(statuses),
});

const audience = {
  list_ids: ids('Lists to target.').optional(),
  tag_ids: ids('Tags to target.').optional(),
  segment_ids: ids('Segments to target.').optional(),
};

const emailFields = {
  name: z.string().max(100).optional().describe('Internal campaign name.'),
  subject: z.string().optional(),
  preheader: z
    .string()
    .optional()
    .describe('Preview text shown after the subject in most inboxes.'),
  from_name: z.string().optional().describe('Sender display name.'),
  from: z
    .email()
    .optional()
    .describe(
      "Sender address. Its domain must be verified in the organization; ask the user if you don't know one.",
    ),
  reply_to: z.email().optional(),
  template_id: z
    .string()
    .optional()
    .describe('Template holding the email body, from list-templates.'),
  ...audience,
};

const smsFields = {
  description: z.string().max(500).optional(),
  content: z
    .string()
    .max(3200)
    .optional()
    .describe(
      'Message text. Long or non-Latin text is split into several billed segments.',
    ),
  from: z
    .string()
    .max(11)
    .optional()
    .describe(
      "Pre-approved sender name, 3-11 characters. Ask the user if you don't know it.",
    ),
  ...audience,
};

const pushFields = {
  description: z.string().max(500).optional(),
  image_url: z.url().optional().describe('Large image, https only.'),
  icon_url: z.url().optional().describe('Small icon, https only.'),
  deep_link: z
    .string()
    .max(2048)
    .optional()
    .describe('Opened when the notification is tapped.'),
  android_channel_id: z.string().max(128).optional(),
  ttl_seconds: z
    .number()
    .int()
    .min(60)
    .max(2_419_200)
    .optional()
    .describe('How long delivery is retried for an offline device.'),
  priority: z.enum(['high', 'normal']).optional(),
  action_buttons: z
    .array(
      z.object({
        action_id: z
          .string()
          .min(1)
          .max(64)
          .describe('Stable id reported back when the button is tapped.'),
        label: z.string().min(1).max(64),
        deep_link: z.string().max(2048).optional(),
      }),
    )
    .max(3)
    .optional(),
  data_payload: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      'Flat string map delivered to the app. Keys reserved by Arsel or Firebase are rejected.',
    ),
  target_platforms: z
    .array(z.enum(PLATFORMS))
    .optional()
    .describe('Restrict to these platforms; omit for all.'),
  throttle_minutes: z
    .number()
    .int()
    .min(1)
    .max(720)
    .optional()
    .describe('Spread delivery over this many minutes.'),
  ...audience,
  smart_sending_enabled: z
    .boolean()
    .optional()
    .describe(
      'Skip contacts messaged too recently on this channel. Defaults to true.',
    ),
};

// form, rating and custom_html need fields the API does not accept yet.
const IN_APP_LAYOUTS = [
  'modal',
  'banner_top',
  'banner_bottom',
  'fullscreen',
  'image_only',
  'half_interstitial',
  'alert',
] as const;

const inAppContent = z
  .object({
    headline: z.string().min(1).max(120),
    body: z.string().min(1).max(500),
    image_url: z.url().max(2048).optional(),
    background_color: z.string().optional().describe('Hex color, e.g. #FFFFFF.'),
    text_color: z.string().optional().describe('Hex color.'),
    show_close_button: z.boolean(),
  })
  .describe(
    'Message content. With no close button, at least one button must dismiss.',
  );

const inAppTrigger = z
  .object({
    type: z.enum(['app_open', 'screen_view', 'custom_event']),
    event_name: z
      .string()
      .max(80)
      .optional()
      .describe('Required for screen_view and custom_event.'),
    properties: z
      .record(z.string(), z.string())
      .optional()
      .describe('Event properties that must all equal these values.'),
  })
  .describe('When the message shows on the device.');

const inAppFields = {
  description: z.string().max(1000).optional(),
  buttons: z
    .array(
      z.object({
        button_id: z.string().min(1).max(64),
        label: z.string().min(1).max(40),
        action: z.enum(['deep_link', 'url', 'dismiss', 'custom_event']),
        value: z
          .string()
          .max(2048)
          .optional()
          .describe('URL, deep link or event name; required unless dismiss.'),
        style: z.enum(['primary', 'secondary']),
      }),
    )
    .max(2)
    .optional(),
  display_rules: z
    .object({
      max_per_session: z.number().int().min(1).max(10),
      max_lifetime: z.number().int().min(1).max(100),
      min_seconds_between: z.number().int().min(0).max(2_592_000),
      delay_seconds: z.number().int().min(0).max(300),
    })
    .optional()
    .describe(
      'Frequency caps. Defaults to once per session, three times ever, a day apart.',
    ),
  priority: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .optional()
    .describe('Higher wins when several messages are eligible at once.'),
  target_platforms: z.array(z.enum(PLATFORMS)).optional(),
  ...audience,
  grant_only: z
    .boolean()
    .optional()
    .describe('Only shown to contacts an automation grants it to.'),
  starts_at: z
    .string()
    .optional()
    .describe('ISO 8601 date-time, e.g. 2026-09-01T09:00:00Z.'),
  ends_at: z
    .string()
    .optional()
    .describe('ISO 8601 date-time; omit for an open-ended campaign.'),
};

export const campaignTools: ArselTool[] = [
  {
    name: 'list-email-campaigns',
    title: 'List Email Campaigns',
    scope: 'read',
    method: 'GET',
    path: '/email/campaigns',
    description: `List email campaigns, optionally by name or status. ${QUIET_IDS}`,
    inputSchema: z.object(listFields(DELIVERY_STATUSES)),
  },
  {
    name: 'get-email-campaign',
    title: 'Get Email Campaign',
    scope: 'read',
    method: 'GET',
    path: '/email/campaigns/{id}',
    description:
      'Get one email campaign: status, sender, subject, template, audience and schedule.',
    inputSchema: z.object({ id: id('email campaign') }),
  },
  {
    name: 'create-email-campaign',
    title: 'Create Email Campaign',
    scope: 'write',
    method: 'POST',
    path: '/email/campaigns',
    description: `Create an email campaign. Every field is optional, so a draft can be built up step by step. ${AUDIENCE_NOTE} ${DRAFT_NOTE}`,
    inputSchema: z.object(emailFields),
  },
  {
    name: 'update-email-campaign',
    title: 'Update Email Campaign',
    scope: 'write',
    destructive: true,
    method: 'PATCH',
    path: '/email/campaigns/{id}',
    description: `Update an email campaign. ${EDITABLE_NOTE}`,
    inputSchema: z.object({ id: id('email campaign'), ...emailFields }),
  },

  {
    name: 'list-sms-campaigns',
    title: 'List SMS Campaigns',
    scope: 'read',
    method: 'GET',
    path: '/sms/campaigns',
    description: `List SMS campaigns, optionally by name or status. ${QUIET_IDS}`,
    inputSchema: z.object(listFields(DELIVERY_STATUSES)),
  },
  {
    name: 'get-sms-campaign',
    title: 'Get SMS Campaign',
    scope: 'read',
    method: 'GET',
    path: '/sms/campaigns/{id}',
    description:
      'Get one SMS campaign: status, content, sender, segment count and schedule.',
    inputSchema: z.object({ id: id('SMS campaign') }),
  },
  {
    name: 'create-sms-campaign',
    title: 'Create SMS Campaign',
    scope: 'write',
    method: 'POST',
    path: '/sms/campaigns',
    description: `Create an SMS campaign. ${AUDIENCE_NOTE} ${DRAFT_NOTE}`,
    inputSchema: z.object({
      name: z.string().min(1).max(100).describe('Internal campaign name.'),
      ...smsFields,
    }),
  },
  {
    name: 'update-sms-campaign',
    title: 'Update SMS Campaign',
    scope: 'write',
    destructive: true,
    method: 'PATCH',
    path: '/sms/campaigns/{id}',
    description: `Update an SMS campaign. ${EDITABLE_NOTE}`,
    inputSchema: z.object({
      id: id('SMS campaign'),
      name: z.string().max(100).optional(),
      ...smsFields,
    }),
  },

  {
    name: 'list-push-campaigns',
    title: 'List Push Campaigns',
    scope: 'read',
    method: 'GET',
    path: '/push/campaigns',
    description: `List push notification campaigns, optionally by name or status. ${QUIET_IDS}`,
    inputSchema: z.object(listFields([...DELIVERY_STATUSES, 'archived'])),
  },
  {
    name: 'get-push-campaign',
    title: 'Get Push Campaign',
    scope: 'read',
    method: 'GET',
    path: '/push/campaigns/{id}',
    description:
      'Get one push campaign: status, notification content, targeting and schedule.',
    inputSchema: z.object({ id: id('push campaign') }),
  },
  {
    name: 'create-push-campaign',
    title: 'Create Push Campaign',
    scope: 'write',
    method: 'POST',
    path: '/push/campaigns',
    description: `Create a push notification campaign for the organization's app users. ${AUDIENCE_NOTE} ${DRAFT_NOTE}`,
    inputSchema: z.object({
      name: z.string().min(1).max(100).describe('Internal campaign name.'),
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(1000),
      ...pushFields,
    }),
  },
  {
    name: 'update-push-campaign',
    title: 'Update Push Campaign',
    scope: 'write',
    destructive: true,
    method: 'PATCH',
    path: '/push/campaigns/{id}',
    description: `Update a push campaign. ${EDITABLE_NOTE}`,
    inputSchema: z.object({
      id: id('push campaign'),
      name: z.string().max(100).optional(),
      title: z.string().min(1).max(200).optional(),
      body: z.string().min(1).max(1000).optional(),
      ...pushFields,
    }),
  },

  {
    name: 'list-in-app-campaigns',
    title: 'List In-App Campaigns',
    scope: 'read',
    method: 'GET',
    path: '/in-app/campaigns',
    description: `List in-app message campaigns (messages shown inside the organization's app or website), optionally by name or status. ${QUIET_IDS}`,
    inputSchema: z.object(
      listFields(['draft', 'scheduled', 'active', 'paused', 'ended', 'archived']),
    ),
  },
  {
    name: 'get-in-app-campaign',
    title: 'Get In-App Campaign',
    scope: 'read',
    method: 'GET',
    path: '/in-app/campaigns/{id}',
    description:
      'Get one in-app campaign: status, layout, content, trigger and targeting.',
    inputSchema: z.object({ id: id('in-app campaign') }),
  },
  {
    name: 'create-in-app-campaign',
    title: 'Create In-App Campaign',
    scope: 'write',
    method: 'POST',
    path: '/in-app/campaigns',
    description: `Create an in-app message campaign. ${DRAFT_NOTE}`,
    inputSchema: z.object({
      name: z.string().min(1).max(255).describe('Internal campaign name.'),
      layout: z.enum(IN_APP_LAYOUTS).describe('How the message is drawn.'),
      content: inAppContent,
      trigger: inAppTrigger,
      ...inAppFields,
    }),
  },
  {
    name: 'update-in-app-campaign',
    title: 'Update In-App Campaign',
    scope: 'write',
    destructive: true,
    method: 'PATCH',
    path: '/in-app/campaigns/{id}',
    description:
      'Update an in-app campaign. Unlike other channels an `active` campaign is editable, and devices show the change on their next fetch: before editing a live campaign you MUST confirm with the user. `ended` and `archived` campaigns cannot be edited. Omitted fields are unchanged.',
    inputSchema: z.object({
      id: id('in-app campaign'),
      name: z.string().max(255).optional(),
      layout: z.enum(IN_APP_LAYOUTS).optional(),
      content: inAppContent.optional(),
      trigger: inAppTrigger.optional(),
      ...inAppFields,
    }),
  },
  {
    name: 'clone-in-app-campaign',
    title: 'Clone In-App Campaign',
    scope: 'write',
    method: 'POST',
    path: '/in-app/campaigns/{id}/clone',
    description:
      'Copy an in-app campaign into a new `draft`, e.g. to rework a live or ended one without touching it.',
    inputSchema: z.object({ id: id('in-app campaign') }),
  },
];
