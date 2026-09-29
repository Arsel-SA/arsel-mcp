import { z } from 'zod';
import type { ArselTool } from './define.js';
import { id, pagination, QUIET_IDS, search } from './shared.js';

const categoryIds = (what: string) =>
  z
    .string()
    .optional()
    .describe(`Comma-separated ${what} ids from list-gallery-categories.`);

export const templateTools: ArselTool[] = [
  {
    name: 'list-templates',
    title: 'List Templates',
    scope: 'read',
    method: 'GET',
    path: '/templates',
    description: `List the organization's own email templates. An email campaign uses one through its \`template_id\`. ${QUIET_IDS}`,
    inputSchema: z.object({ ...pagination, search: search('template name') }),
  },
  {
    name: 'get-template',
    title: 'Get Template',
    scope: 'read',
    method: 'GET',
    path: '/templates/{id}',
    description: 'Get one email template, including its HTML.',
    inputSchema: z.object({ id: id('template') }),
  },
  {
    name: 'create-template',
    title: 'Create Template',
    scope: 'write',
    method: 'POST',
    path: '/templates',
    description:
      'Create an email template from HTML. The HTML is sanitized and an unsubscribe link is added automatically. To start from a professionally designed layout instead, use copy-gallery-template.',
    inputSchema: z.object({
      name: z.string().min(1).max(255),
      html: z.string().min(1).describe('Full email body HTML.'),
    }),
  },
  {
    name: 'update-template',
    title: 'Update Template',
    scope: 'write',
    destructive: true,
    method: 'PATCH',
    path: '/templates/{id}',
    description: 'Rename an email template or replace its HTML.',
    inputSchema: z.object({
      id: id('template'),
      name: z.string().max(255).optional(),
      html: z.string().optional().describe('Replaces the whole body HTML.'),
    }),
  },

  {
    name: 'list-gallery-categories',
    title: 'List Gallery Categories',
    scope: 'read',
    method: 'GET',
    path: '/templates/gallery/categories',
    description:
      'List the filters (types, seasons, features, industries) that list-gallery-templates accepts.',
    inputSchema: z.object({}),
  },
  {
    name: 'list-gallery-templates',
    title: 'List Gallery Templates',
    scope: 'read',
    method: 'GET',
    path: '/templates/gallery',
    description:
      "Browse Arsel's gallery of ready-made email designs. Copy one into the organization with copy-gallery-template.",
    inputSchema: z.object({
      ...pagination,
      search: search('template name'),
      template_types: categoryIds('type'),
      template_seasons: categoryIds('season'),
      template_features: categoryIds('feature'),
      template_industries: categoryIds('industry'),
    }),
  },
  {
    name: 'get-gallery-template',
    title: 'Get Gallery Template',
    scope: 'read',
    method: 'GET',
    path: '/templates/gallery/{id}',
    description: 'Get one gallery design, including its HTML.',
    inputSchema: z.object({ id: id('gallery template') }),
  },
  {
    name: 'copy-gallery-template',
    title: 'Copy Gallery Template',
    scope: 'write',
    method: 'POST',
    path: '/templates/gallery/{id}/copy',
    description:
      "Copy a gallery design into the organization's templates, where it can be edited and used by campaigns.",
    inputSchema: z.object({
      id: id('gallery template'),
      name: z
        .string()
        .max(100)
        .optional()
        .describe("Defaults to the gallery design's name."),
    }),
  },
];
