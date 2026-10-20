import { z } from 'zod';

const TEXT_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'exists',
  'does_not_exist',
] as const;
const ORDERING_OPERATORS = [
  'greater_than',
  'greater_than_or_equal',
  'less_than',
  'less_than_or_equal',
] as const;
const COMPARISON_OPERATORS = ['equals', 'not_equals', ...ORDERING_OPERATORS] as const;
const ACTIONS = ['sent', 'delivered', 'opened', 'clicked'] as const;
const CHANNELS = ['email', 'sms', 'whatsapp', 'push', 'in_app'] as const;

const DATE =
  'A date (`YYYY-MM-DD`, standing for that whole UTC day) or an ISO 8601 timestamp. With a date, `greater_than` starts the day after; use `greater_than_or_equal` to include the day itself.';

const scalar = z.union([z.string(), z.number(), z.boolean()]);

// Rules are strict objects: a misspelled key is refused here rather than
// dropped, which would save a segment with different rules than were asked for.
const timeWindow = z
  .strictObject({
    value: z.int().min(1).max(365),
    unit: z.enum(['days', 'weeks', 'months']),
  })
  .describe(
    'A rolling window ending now, e.g. the last 30 days. Omit to cover all time.',
  );

const attribute = z
  .strictObject({
    type: z.literal('attribute'),
    field: z
      .string()
      .describe(
        'A built-in field (`email`, `first_name`, `last_name`, `phone_number`, `external_id`, `source`, `created_at`) or a custom property written `properties.<key>`, with the key from list-contact-properties.',
      ),
    operator: z
      .enum([...TEXT_OPERATORS, ...ORDERING_OPERATORS, 'date_is_same_month_day'])
      .describe(
        "`email`, `first_name`, `last_name`, `phone_number` and `external_id` take `equals`, `not_equals`, `contains`, `not_contains`, `starts_with`, `ends_with`, `exists` and `does_not_exist`. `source` takes only `equals` and `not_equals`. `created_at` takes `equals`, `not_equals`, the four ordering operators and `date_is_same_month_day`. A custom property takes any operator. `date_is_same_month_day` matches when the month and day are today's, which is how a birthday segment is built.",
      ),
    value: scalar
      .optional()
      .describe(
        'Omit for `exists`, `does_not_exist` and `date_is_same_month_day`; required otherwise. For `source`, one of `import`, `manual`, `transactional`, `api`, `event`. For `created_at`, a date (`YYYY-MM-DD`) or an ISO 8601 timestamp. On a custom property the ordering operators need a number or a date.',
      ),
  })
  .describe(
    'Matches on who the contact is: a built-in field or a custom property. Subscription state is not a field here; use a `channel_status` rule.',
  );

const listMembership = z
  .strictObject({
    type: z.literal('list_membership'),
    list_ids: z.array(z.string().min(1)).min(1).describe('List ids, from list-lists.'),
    negate: z
      .boolean()
      .optional()
      .describe('`true` matches contacts in none of the lists.'),
  })
  .describe('Matches contacts in any of the lists.');

const tag = z
  .strictObject({
    type: z.literal('tag'),
    tag_ids: z.array(z.string().min(1)).min(1).describe('Tag ids, from list-tags.'),
    negate: z
      .boolean()
      .optional()
      .describe('`true` matches contacts carrying none of the tags.'),
  })
  .describe('Matches contacts carrying any of the tags.');

const engagementCount = z
  .strictObject({
    type: z.literal('engagement_count'),
    channel: z.enum(['email', 'sms', 'push']),
    action: z
      .enum(ACTIONS)
      .describe(
        '`email` counts all four. `sms` has no `opened`, and `push` has no `delivered`.',
      ),
    operator: z.enum(COMPARISON_OPERATORS),
    value: z.int().min(0).describe('The number of messages to compare with.'),
    time_window: timeWindow.optional(),
  })
  .describe(
    'Matches by how many messages on a channel the contact was sent, received, opened or clicked, e.g. opened at least 3 emails in the last 90 days. The rule to use for recent activity: it is one of the two with a rolling window.',
  );

const lastEngagement = z
  .strictObject({
    type: z.literal('last_engagement'),
    channel: z.enum(CHANNELS),
    action: z
      .enum(ACTIONS)
      .describe('`sms` has no `opened`, and `in_app` has only `opened` and `clicked`.'),
    operator: z
      .enum([...COMPARISON_OPERATORS, 'exists', 'does_not_exist'])
      .describe(
        '`does_not_exist` matches contacts who never did the action, `exists` those who did at least once. The others compare the date it last happened with `value`.',
      ),
    value: z
      .string()
      .optional()
      .describe(`${DATE} Omit for \`exists\` and \`does_not_exist\`.`),
  })
  .describe(
    'Matches by the date the contact last received, opened or clicked a message on a channel, or by whether they ever did. The date is fixed, not rolling.',
  );

const messageEngagement = z
  .strictObject({
    type: z.literal('message_engagement'),
    target_type: z.enum(['campaign', 'automation', 'automation_step']),
    target_id: z
      .string()
      .min(1)
      .describe(
        "The campaign id, from the channel's campaign list tool (e.g. list-email-campaigns); the automation id, from list-automations; or, for `automation_step`, a step `key` as get-automation shows it. Inside an automation's condition or wait, `automation_step` names an earlier send step of that same automation.",
      ),
    channel: z.enum(CHANNELS).optional().describe("The message's channel."),
    action: z.enum(ACTIONS),
    negate: z
      .boolean()
      .optional()
      .describe('`true` matches contacts who did not do the action.'),
  })
  .describe(
    'Matches by what the contact did with one specific campaign or automation, e.g. clicked the March newsletter.',
  );

const eventData = z.strictObject({
  field: z
    .string()
    .regex(/^[A-Za-z0-9_.-]{1,80}$/)
    .describe("A field declared in the event's `schema`, as list-events returns it."),
  operator: z
    .enum([...TEXT_OPERATORS, ...ORDERING_OPERATORS])
    .describe(
      'A `string` field takes `equals`, `not_equals`, `contains`, `not_contains`, `starts_with` and `ends_with`. A `number` or `date` field takes `equals`, `not_equals` and the four ordering operators. A `boolean` field takes `equals` and `not_equals`. Every type also takes `exists` and `does_not_exist`.',
    ),
  value: scalar
    .optional()
    .describe('Omit for `exists` and `does_not_exist`; required otherwise.'),
  value_type: z
    .enum(['string', 'number', 'boolean', 'date'])
    .describe("The field's `type` in the event's schema."),
});

const event = z
  .strictObject({
    type: z.literal('event'),
    event_name: z
      .string()
      .min(1)
      .max(255)
      .describe('The `name` of an event, from list-events.'),
    count: z
      .strictObject({
        operator: z.enum(['at_least', 'at_most', 'exactly']),
        value: z.int().min(0),
      })
      .optional()
      .describe('How many times the event happened. Omit for at least once.'),
    time_window: timeWindow.optional(),
    where: z
      .array(eventData)
      .max(10)
      .optional()
      .describe(
        "Conditions on the event's own data. An occurrence counts only when all of them hold, e.g. orders whose `total` is over 500. With `where`, `time_window` cannot reach back further than the event's retention period.",
      ),
    negate: z
      .boolean()
      .optional()
      .describe(
        '`true` inverts the rule, matching the contacts it would leave out, e.g. no order in the last 90 days.',
      ),
  })
  .describe(
    "Matches by the events the contact triggered in the organization's app, site or store, e.g. placed at least 2 orders in the last 6 months. Has a rolling window.",
  );

const channelStatus = z
  .strictObject({
    type: z.literal('channel_status'),
    channel: z.enum(['email', 'sms', 'whatsapp', 'push']),
    consent: z.enum(['subscribed', 'unsubscribed']).optional(),
    deliverability: z
      .enum(['deliverable', 'undeliverable'])
      .optional()
      .describe('Whether messages on the channel can currently reach the contact.'),
  })
  .describe(
    'Matches by whether a channel can reach the contact. Set `consent`, `deliverability`, or both.',
  );

const rules = [
  attribute,
  listMembership,
  tag,
  engagementCount,
  lastEngagement,
  messageEngagement,
  event,
  channelStatus,
] as const;

type Rule = z.infer<(typeof rules)[number]>;
interface Group {
  type: 'group';
  operator: 'and' | 'or';
  conditions: Node[];
}
type Node = Group | Rule;

// The annotations break the inference cycle between a group and its children.
const group = z
  .strictObject({
    type: z.literal('group'),
    operator: z
      .enum(['and', 'or'])
      .describe('`and`: a contact must match every condition. `or`: any one of them.'),
    get conditions(): z.ZodType<Node[]> {
      return z
        .array(node)
        .describe('Rules, and groups to nest a different `and` / `or` inside this one.');
    },
  })
  .meta({
    id: 'SegmentFilterGroup',
    description:
      'A group of rules joined by `and` or `or`. The root of a filter is always a group, even for a single rule.',
  });

const node: z.ZodType<Node> = z.discriminatedUnion('type', [group, ...rules]);

export const segmentFilter = group;

export const FILTER_GUIDE = `**Look up what the rules will name before writing them.** Property keys come from list-contact-properties, event names and their fields from list-events, list and tag ids from list-lists and list-tags, and campaign ids from the channel's campaign list tool. A filter naming a property or an event field the organization has not defined is refused.

**Shape.** \`filter\` is a tree whose root is always a group. A group joins its \`conditions\` with \`and\` or \`or\`, and a condition is a rule or another group, so "A and (B or C)" is an \`and\` group holding A and an \`or\` group of B and C. A filter needs at least one rule and holds at most 100, in groups nested at most 10 deep.

**Choosing a rule.**
- Who they are, or a custom property: \`attribute\`.
- The lists they are in or the tags they carry: \`list_membership\`, \`tag\`.
- Whether a channel can reach them (subscribed, deliverable): \`channel_status\`.
- How often they engaged with messages, optionally in a recent window: \`engagement_count\`.
- When they last engaged, or that they never did: \`last_engagement\`.
- What they did with one specific campaign or automation: \`message_engagement\`.
- What they did in the app, site or store: \`event\`.

**Recent activity.** Only \`engagement_count\` and \`event\` take a rolling \`time_window\`. Dates in \`attribute\` and \`last_engagement\` are fixed and do not move with time, so "opened an email in the last 30 days" is an \`engagement_count\` of at least 1 with a 30-day window, not a \`last_engagement\` date.

**Absence.** \`negate: true\` on \`list_membership\`, \`tag\`, \`message_engagement\` or \`event\` matches the contacts the rule would leave out, and \`last_engagement\` with \`does_not_exist\` matches contacts who never did the action. "Ordered before, but not in the last 90 days" is an \`and\` group of a plain \`event\` rule and the same rule with a 90-day window and \`negate: true\`.

**Reaching people.** A segment holds every contact its rules match, whatever their consent. Add a \`channel_status\` rule when it should hold only contacts a channel can message.

**If the filter is refused**, the error gives the path of each problem inside the tree (e.g. \`conditions.1.operator\`). Fix those and call again.`;
