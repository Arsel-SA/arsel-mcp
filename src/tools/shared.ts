import { z } from 'zod';

export const id = (resource: string) =>
  z.guid().describe(`The ${resource} id.`);

export const pagination = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Items per page, 1-100. Defaults to 20.'),
  after: z
    .string()
    .optional()
    .describe(
      'Cursor for the next page: the `id` of the last item on this page. Cannot be combined with `before`.',
    ),
  before: z
    .string()
    .optional()
    .describe(
      'Cursor for the previous page: the `id` of the first item on this page.',
    ),
};

export const search = (what: string) =>
  z.string().optional().describe(`Case-insensitive search by ${what}.`);

export const ids = (description: string) =>
  z.array(z.string()).describe(description);

export const PLATFORMS = ['android', 'ios', 'web'] as const;

export const QUIET_IDS =
  "Don't read ids or timestamps back to the user unless they ask for them.";

export const AUDIENCE_NOTE =
  'The audience is the union of `list_ids`, `tag_ids` and `segment_ids`. Find lists with list-lists and tags with list-tags; segments are managed in the Arsel dashboard.';

export const DRAFT_NOTE =
  'The campaign is saved as a `draft`. This server cannot send or schedule it: the user does that from the Arsel dashboard.';

export const AUTOMATION_NOTE =
  "This can start the organization's active automations, which may send messages.";
