import { z } from 'zod';
import type { ArselTool } from './define.js';
import { AUTOMATION_NOTE, id, pagination, QUIET_IDS } from './shared.js';

export const contactTools: ArselTool[] = [
  {
    name: 'list-contacts',
    title: 'List Contacts',
    scope: 'read',
    method: 'GET',
    path: '/contacts',
    description: `**Purpose:** List contacts, or look one person up.

**Use when:** the user asks "is X a contact?", "who is in this list?", "who has this tag?". Pass an exact \`email\`, \`phone_number\` or \`external_id\` to find one person, or \`list_id\` / \`tag_id\` to see an audience.

**Not for:** counting a list or tag (get-list and get-tag return \`contact_count\`). ${QUIET_IDS}`,
    inputSchema: z.object({
      ...pagination,
      email: z.string().optional().describe('Exact email, case-insensitive.'),
      phone_number: z
        .string()
        .optional()
        .describe('Exact phone number; normalized to E.164 before matching.'),
      external_id: z
        .string()
        .optional()
        .describe("Exact match on the organization's own identifier."),
      list_id: z.string().optional().describe('Only contacts in this list.'),
      tag_id: z.string().optional().describe('Only contacts with this tag.'),
    }),
  },
  {
    name: 'get-contact',
    title: 'Get Contact',
    scope: 'read',
    method: 'GET',
    path: '/contacts/{id}',
    description:
      'Get one contact by id, with its custom properties and whether it is suppressed (unreachable because of a bounce, complaint or unsubscribe).',
    inputSchema: z.object({ id: id('contact') }),
  },
  {
    name: 'create-contact',
    title: 'Create Contact',
    scope: 'write',
    method: 'POST',
    path: '/contacts',
    description: `Create a contact. At least one of \`email\`, \`phone_number\` or \`external_id\` is required. Custom fields go in \`properties\`, keyed by the field keys list-contact-properties returns. ${AUTOMATION_NOTE}`,
    inputSchema: z.object({
      email: z.email().optional().describe('Email address.'),
      phone_number: z
        .string()
        .optional()
        .describe('Phone number in E.164 format, e.g. +966512345678.'),
      external_id: z
        .string()
        .max(255)
        .optional()
        .describe(
          "The organization's own identifier for this person; unique per organization.",
        ),
      first_name: z.string().max(100).optional(),
      last_name: z.string().max(100).optional(),
      properties: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Custom field values, e.g. { "city": "Riyadh" }.'),
      list_ids: z
        .array(z.string())
        .optional()
        .describe('Lists to add the contact to.'),
    }),
  },
  {
    name: 'update-contact',
    title: 'Update Contact',
    scope: 'write',
    destructive: true,
    method: 'PATCH',
    path: '/contacts/{id}',
    description: `Update a contact. Omitted fields are unchanged and \`null\` clears one, but the contact must keep an email, phone number or external id.

\`list_ids\` REPLACES the contact's list memberships: an empty array removes it from every list. To add without removing, use add-contacts-to-list. ${AUTOMATION_NOTE}`,
    inputSchema: z.object({
      id: id('contact'),
      email: z.email().nullable().optional(),
      phone_number: z
        .string()
        .nullable()
        .optional()
        .describe('E.164 format.'),
      external_id: z.string().max(255).nullable().optional(),
      first_name: z.string().max(100).nullable().optional(),
      last_name: z.string().max(100).nullable().optional(),
      properties: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Custom field values to set.'),
      list_ids: z
        .array(z.string())
        .optional()
        .describe('The complete set of lists the contact should be in.'),
    }),
  },
];
