import { z } from 'zod';
import type { ArselTool } from './define.js';
import { id } from './shared.js';

const CONFIRM =
  'This reaches real people, and a message that has gone out cannot be recalled. Before calling it, show the user what will go out and to whom, and wait for their go-ahead.';

// The campaign GETs return no list, tag or segment ids, so the agent can only vouch for an audience it set itself.
const AUDIENCE_CHECK =
  "Tell the user the audience: if you set it in this conversation, name those lists, tags and segments and their sizes (get-list, get-segment). The campaign's own record doesn't include its audience, so otherwise ask the user to confirm it in the Arsel dashboard.";

const variables = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .optional()
  .describe('Values for `{{key}}` placeholders in the content.');

const category = z
  .string()
  .optional()
  .describe('Label for grouping in analytics, e.g. `order_update` or `otp`.');

const scheduledAt = z
  .string()
  .optional()
  .describe(
    "ISO 8601 date-time in the future, with the user's UTC offset (e.g. 2026-12-01T09:00:00+03:00 for Saudi Arabia), to schedule the campaign. Omit to send now.",
  );

const contactIdentifiers = {
  contact_id: z
    .guid()
    .optional()
    .describe(
      'Arsel contact id, from list-contacts. Cannot be combined with `external_id`, `email` or `phone_number`.',
    ),
  external_id: z
    .string()
    .optional()
    .describe("The organization's own user id for the contact."),
  email: z.email().optional(),
  phone_number: z
    .string()
    .optional()
    .describe('E.164 phone number, e.g. +966501234567.'),
};

const campaignSend = (
  channel: string,
  slug: string,
  reaches: string,
  cost = '',
): ArselTool => ({
  name: `send-${slug}-campaign`,
  title: `Send ${channel} Campaign`,
  scope: 'send',
  destructive: true,
  method: 'POST',
  path: `/${slug}/campaigns/{id}/send`,
  description: `Send the ${channel === 'SMS' ? channel : channel.toLowerCase()} campaign now, or schedule it with \`scheduled_at\`. It goes to ${reaches}. The campaign must be a \`draft\` or \`scheduled\` with every required field set. Call get-${slug}-campaign first and show the user its content. ${AUDIENCE_CHECK}${cost} ${CONFIRM} A scheduled, queued or sending campaign can be stopped with cancel-${slug}-campaign.`,
  inputSchema: z.object({
    id: id(`${slug} campaign`),
    scheduled_at: scheduledAt,
  }),
});

const campaignCancel = (channel: string, slug: string): ArselTool => ({
  name: `cancel-${slug}-campaign`,
  title: `Cancel ${channel} Campaign`,
  scope: 'send',
  destructive: true,
  method: 'POST',
  path: `/${slug}/campaigns/{id}/cancel`,
  description: `Cancel the ${channel === 'SMS' ? channel : channel.toLowerCase()} campaign if it is \`scheduled\`, \`queued\` or \`sending\`. Messages already delivered stay delivered. Confirm with the user first, naming the campaign.`,
  inputSchema: z.object({ id: id(`${slug} campaign`) }),
});

export const sendTools: ArselTool[] = [
  {
    name: 'send-email',
    title: 'Send Email',
    scope: 'send',
    destructive: true,
    method: 'POST',
    path: '/email/send',
    description: `Send a transactional email: a one-off message such as a receipt, an order update or a password reset, not a marketing campaign. Give the content as \`html\` and/or \`text\` with a \`subject\`, or as a \`template_id\` from list-templates. Up to 50 recipients across \`to\`, \`cc\` and \`bcc\`; one malformed address rejects the whole request. ${CONFIRM} See what was sent with list-emails.`,
    inputSchema: z.object({
      from: z
        .email()
        .describe(
          "Sender address at one of the organization's `verified` domains, from list-email-domains.",
        ),
      from_name: z.string().describe('Sender display name.'),
      to: z.array(z.email()).min(1).max(50),
      subject: z
        .string()
        .optional()
        .describe('Required with `html` or `text`; with `template_id` it defaults to the template subject.'),
      html: z.string().optional().describe('Cannot be combined with `template_id`.'),
      text: z.string().optional().describe('Plain-text body; alone or alongside `html`.'),
      template_id: z
        .guid()
        .optional()
        .describe('Template to send, from list-templates. Cannot be combined with `html` or `text`.'),
      variables,
      reply_to: z.email().optional(),
      cc: z.array(z.email()).optional(),
      bcc: z.array(z.email()).optional(),
      attachments: z
        .array(
          z.object({
            filename: z.string().describe('File name with extension.'),
            content: z.string().describe('Base64-encoded file content.'),
            content_type: z.string().optional().describe('MIME type, e.g. application/pdf.'),
            content_id: z
              .string()
              .optional()
              .describe('Sends the file inline, for an image the HTML references as `cid:<content_id>`.'),
          }),
        )
        .max(10)
        .optional()
        .describe('Up to 10 files, 30 MB in total once decoded.'),
      category,
    }),
  },
  {
    name: 'send-sms',
    title: 'Send SMS',
    scope: 'send',
    destructive: true,
    method: 'POST',
    path: '/sms/send',
    description: `Send a transactional SMS, such as a one-time code or a delivery update, to up to 100 numbers in one country. Each number is billed per part: 70 characters for Arabic or emoji text, 160 for Latin. ${CONFIRM} See what was sent with list-sms-messages.`,
    inputSchema: z.object({
      from: z
        .string()
        .max(11)
        .describe(
          'Approved sender name, 3-11 characters, from list-sms-senders. It must be approved for the recipients\' country.',
        ),
      to: z
        .array(z.string())
        .min(1)
        .max(100)
        .describe('E.164 mobile numbers, e.g. +966512345678, all in the same country.'),
      content: z.string().describe('Message text, up to 10 parts. Supports `{{key}}` placeholders.'),
      variables,
      category,
    }),
  },
  {
    name: 'send-whatsapp',
    title: 'Send WhatsApp Message',
    scope: 'send',
    destructive: true,
    method: 'POST',
    path: '/whatsapp/send',
    description: `Send one WhatsApp message from an \`approved\` template; WhatsApp allows no free text to start a conversation. Find templates and the \`parameters\` each needs with list-whatsapp-templates and get-whatsapp-template. Each message is charged to the organization's WhatsApp balance. ${CONFIRM} See what was sent with list-whatsapp-messages.`,
    inputSchema: z.object({
      to: z.string().describe('Recipient in E.164 format, e.g. +966501234567.'),
      template_name: z.string().describe('Name of an `approved` template.'),
      language: z
        .string()
        .optional()
        .describe('Template language code; omit when only one approved template has this name.'),
      parameters: z
        .record(z.string(), z.string())
        .optional()
        .describe(
          'Values for the template placeholders, keyed by placeholder name. For an authentication template, the one-time code goes in `code`.',
        ),
    }),
  },
  {
    name: 'send-push',
    title: 'Send Push Notification',
    scope: 'send',
    destructive: true,
    method: 'POST',
    path: '/push/send',
    description: `Send a push notification to one contact; every active device they registered receives it. Identify the contact with \`contact_id\` alone, or with any of \`external_id\`, \`email\` and \`phone_number\`. Contacts who turned push off are skipped. ${CONFIRM} See what was sent with list-push-notifications.`,
    inputSchema: z.object({
      ...contactIdentifiers,
      title: z.string(),
      body: z.string(),
      image_url: z.url().optional().describe('Large image, https only.'),
      icon_url: z.url().optional().describe('Small icon, https only.'),
      deep_link: z.string().optional().describe('Opened when the notification is tapped.'),
      android_channel_id: z.string().optional(),
      category,
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
            action_id: z.string().describe('Stable id reported back when the button is tapped.'),
            label: z.string(),
            deep_link: z.string().optional(),
          }),
        )
        .optional(),
      data_payload: z
        .record(z.string(), z.string())
        .optional()
        .describe('Flat string map delivered to the app. Keys reserved by Arsel or Firebase are rejected.'),
    }),
  },
  campaignSend('Email', 'email', 'every subscribed contact in its lists, tags and segments'),
  campaignSend(
    'SMS',
    'sms',
    'every subscribed contact in its lists, tags and segments',
    ' Every recipient is billed for each part of the message, so tell the user how many parts it is (`num_segments` on the campaign).',
  ),
  campaignSend('Push', 'push', "its audience's app users who allow push; the rest are skipped"),
  campaignCancel('Email', 'email'),
  campaignCancel('SMS', 'sms'),
  campaignCancel('Push', 'push'),
  {
    name: 'activate-in-app-campaign',
    title: 'Activate In-App Campaign',
    scope: 'send',
    destructive: true,
    method: 'POST',
    path: '/in-app/campaigns/{id}/activate',
    description: `Make an in-app campaign live: devices pick it up on their next app open and show it to its audience. Call get-in-app-campaign first and tell the user its content and audience (\`list_ids\`, \`tag_ids\`, \`segment_ids\`). Before calling it, wait for their go-ahead. It stays live until the user pauses or ends it in the Arsel dashboard.`,
    inputSchema: z.object({ id: id('in-app campaign') }),
  },
  {
    name: 'send-event',
    title: 'Send Event',
    scope: 'send',
    destructive: true,
    method: 'POST',
    path: '/events/send',
    description: `Record that a contact did something, e.g. \`order.completed\`. The event must be defined (list-events) and \`data\` must match its schema. Enabled automations triggered by this event run for the contact and may message them, and a contact that doesn't exist yet is created. Before calling it, check list-automations for enabled automations with this trigger, tell the user what they will do, and wait for their go-ahead.`,
    inputSchema: z.object({
      event: z.string().describe('Name of a defined event, from list-events.'),
      ...contactIdentifiers,
      data: z
        .record(z.string(), z.unknown())
        .describe("Event payload, matching the event's schema."),
      timestamp: z
        .string()
        .optional()
        .describe('ISO 8601 time the event happened; defaults to now.'),
    }),
    withheld: ['anonymous_id'],
  },
];
