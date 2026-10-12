import { z } from 'zod';
import type { ArselTool } from './define.js';
import { FILTER_GUIDE, segmentFilter } from './segment-filter.js';
import { AUTOMATION_NOTE, id, ids, pagination, QUIET_IDS, search } from './shared.js';

const contactIds = ids('Contact ids, from list-contacts.').min(1);

const tagName = z
  .string()
  .max(100)
  .regex(/^[a-zA-Z0-9\s\-_]+$/)
  .describe('Letters, digits, spaces, hyphens and underscores only.');

export const audienceTools: ArselTool[] = [
  {
    name: 'list-lists',
    title: 'List Contact Lists',
    scope: 'read',
    method: 'GET',
    path: '/lists',
    description: `List contact lists with their contact counts. Lists are static audiences that campaigns target. ${QUIET_IDS}`,
    inputSchema: z.object({ ...pagination, search: search('list name') }),
  },
  {
    name: 'get-list',
    title: 'Get Contact List',
    scope: 'read',
    method: 'GET',
    path: '/lists/{id}',
    description:
      'Get one contact list and its contact count. To see its members, call list-contacts with `list_id`.',
    inputSchema: z.object({ id: id('list') }),
  },
  {
    name: 'create-list',
    title: 'Create Contact List',
    scope: 'write',
    method: 'POST',
    path: '/lists',
    description: 'Create an empty contact list.',
    inputSchema: z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
    }),
  },
  {
    name: 'update-list',
    title: 'Update Contact List',
    scope: 'write',
    destructive: true,
    method: 'PATCH',
    path: '/lists/{id}',
    description: 'Rename a contact list or change its description.',
    inputSchema: z.object({
      id: id('list'),
      name: z.string().max(255).optional(),
      description: z.string().optional(),
    }),
  },
  {
    name: 'add-contacts-to-list',
    title: 'Add Contacts to List',
    scope: 'write',
    method: 'POST',
    path: '/lists/{id}/contacts',
    description: `Add contacts to a list, keeping their other memberships. ${AUTOMATION_NOTE}`,
    inputSchema: z.object({ id: id('list'), contact_ids: contactIds }),
  },
  {
    name: 'remove-contacts-from-list',
    title: 'Remove Contacts from List',
    scope: 'write',
    destructive: true,
    method: 'DELETE',
    path: '/lists/{id}/contacts',
    description:
      'Remove contacts from a list. The contacts themselves are kept. Confirm with the user first, naming the list.',
    inputSchema: z.object({ id: id('list'), contact_ids: contactIds }),
  },

  {
    name: 'list-tags',
    title: 'List Tags',
    scope: 'read',
    method: 'GET',
    path: '/tags',
    description: `List tags with their contact counts. ${QUIET_IDS}`,
    inputSchema: z.object({ ...pagination, search: search('tag name') }),
  },
  {
    name: 'get-tag',
    title: 'Get Tag',
    scope: 'read',
    method: 'GET',
    path: '/tags/{id}',
    description:
      'Get one tag and its contact count. To see who has it, call list-contacts with `tag_id`.',
    inputSchema: z.object({ id: id('tag') }),
  },
  {
    name: 'create-tag',
    title: 'Create Tag',
    scope: 'write',
    method: 'POST',
    path: '/tags',
    description: 'Create a tag.',
    inputSchema: z.object({
      name: tagName.min(1),
      description: z.string().optional(),
    }),
  },
  {
    name: 'update-tag',
    title: 'Update Tag',
    scope: 'write',
    destructive: true,
    method: 'PATCH',
    path: '/tags/{id}',
    description: 'Rename a tag or change its description.',
    inputSchema: z.object({
      id: id('tag'),
      name: tagName.optional(),
      description: z.string().optional(),
    }),
  },
  {
    name: 'add-tag-to-contacts',
    title: 'Tag Contacts',
    scope: 'write',
    method: 'POST',
    path: '/tags/{id}/contacts',
    description: `Add a tag to contacts. ${AUTOMATION_NOTE}`,
    inputSchema: z.object({ id: id('tag'), contact_ids: contactIds }),
  },
  {
    name: 'remove-tag-from-contacts',
    title: 'Untag Contacts',
    scope: 'write',
    destructive: true,
    method: 'DELETE',
    path: '/tags/{id}/contacts',
    description: `Remove a tag from contacts. ${AUTOMATION_NOTE}`,
    inputSchema: z.object({ id: id('tag'), contact_ids: contactIds }),
  },

  {
    name: 'list-segments',
    title: 'List Segments',
    scope: 'read',
    method: 'GET',
    path: '/segments',
    description: `List segments with their rules and contact counts. Segments are dynamic audiences: a \`filter\` of rules decides who is in, and campaigns target them through \`segment_ids\`. \`status\` is \`processing\` while the members are being computed and \`ready\` after. \`contact_count\` is as of \`counted_at\`, and null while the segment is \`processing\`. ${QUIET_IDS}`,
    inputSchema: z.object({ ...pagination, search: search('segment name') }),
  },
  {
    name: 'get-segment',
    title: 'Get Segment',
    scope: 'read',
    method: 'GET',
    path: '/segments/{id}',
    description:
      'Get one segment: its `status`, its last contact count and its `filter`, in the format create-segment and update-segment accept. To see its members, call list-contacts with `segment_id`.',
    inputSchema: z.object({ id: id('segment') }),
  },
  {
    name: 'create-segment',
    title: 'Create Segment',
    scope: 'write',
    method: 'POST',
    path: '/segments',
    description: `Create a segment: a dynamic audience defined by rules, which campaigns target through \`segment_ids\`. Its members are recomputed regularly, and again before a campaign sends to it.

${FILTER_GUIDE}

The segment comes back with \`status: processing\` while its members are computed in the background. Call get-segment until it is \`ready\`, then tell the user its \`contact_count\`. Creating a segment messages nobody.`,
    inputSchema: z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      filter: segmentFilter,
    }),
  },
  {
    name: 'update-segment',
    title: 'Update Segment',
    scope: 'write',
    destructive: true,
    method: 'PATCH',
    path: '/segments/{id}',
    description: `Rename a segment, change its description or replace its rules. Omitted fields are unchanged.

\`filter\` REPLACES the whole rule tree: to change one rule, read the tree with get-segment, edit it and send all of it back. New rules change who the campaigns and automations using the segment reach, scheduled campaigns included, so before sending \`filter\` you MUST confirm with the user, naming the segment. The members are then recomputed in the background, and \`status\` is \`processing\` until they are.

${FILTER_GUIDE}`,
    inputSchema: z.object({
      id: id('segment'),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      filter: segmentFilter.optional(),
    }),
  },
];
