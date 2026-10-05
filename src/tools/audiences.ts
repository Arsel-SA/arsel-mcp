import { z } from 'zod';
import type { ArselTool } from './define.js';
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
    description: `List segments with their contact counts. Segments are dynamic audiences defined by rules; the rules are managed in the Arsel dashboard and this server only reads them. \`contact_count\` is as of \`counted_at\`, and null for a segment that has not been counted yet or whose rules changed since. ${QUIET_IDS}`,
    inputSchema: z.object({ ...pagination, search: search('segment name') }),
  },
  {
    name: 'get-segment',
    title: 'Get Segment',
    scope: 'read',
    method: 'GET',
    path: '/segments/{id}',
    description:
      'Get one segment and its last contact count. Its rules are not returned.',
    inputSchema: z.object({ id: id('segment') }),
  },
];
