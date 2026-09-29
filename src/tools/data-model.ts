import { z } from 'zod';
import type { ArselTool } from './define.js';
import { id, pagination, QUIET_IDS, search } from './shared.js';

const DATA_TYPES = ['string', 'number', 'boolean', 'date'] as const;

const eventSchema = z
  .object({
    fields: z.array(
      z.object({
        name: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
          .describe('Payload key; unique within the event.'),
        type: z.enum(DATA_TYPES),
        required: z.boolean(),
      }),
    ),
  })
  .describe('The fields each occurrence of this event carries.');

const conversion = z
  .object({
    enabled: z.boolean().describe('`false` clears the conversion setup.'),
    value_field: z
      .string()
      .nullable()
      .optional()
      .describe(
        'Schema field holding the revenue value; required when enabled, `null` for count-only.',
      ),
    currency_field: z
      .string()
      .nullable()
      .optional()
      .describe(
        'Schema field holding the ISO 4217 currency; required when more than one currency is accepted.',
      ),
    currencies: z
      .array(z.string())
      .optional()
      .describe('Accepted ISO 4217 currencies, e.g. ["SAR"].'),
  })
  .describe('Count this event as a conversion when attributing revenue to campaigns.');

export const dataModelTools: ArselTool[] = [
  {
    name: 'list-contact-properties',
    title: 'List Contact Properties',
    scope: 'read',
    method: 'GET',
    path: '/properties',
    description: `List the organization's custom contact fields: the keys a contact's \`properties\` can hold, also usable as merge tags in messages. ${QUIET_IDS}`,
    inputSchema: z.object({
      ...pagination,
      search: search('field key or display name'),
    }),
  },
  {
    name: 'get-contact-property',
    title: 'Get Contact Property',
    scope: 'read',
    method: 'GET',
    path: '/properties/{id}',
    description: 'Get one custom contact field.',
    inputSchema: z.object({ id: id('property') }),
  },
  {
    name: 'create-contact-property',
    title: 'Create Contact Property',
    scope: 'write',
    method: 'POST',
    path: '/properties',
    description:
      'Define a custom contact field. `field_key` and `data_type` cannot be changed later.',
    inputSchema: z.object({
      field_key: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-z][a-z0-9_]*$/)
        .describe('snake_case key, e.g. lifetime_value.'),
      display_name: z.string().min(1).max(255),
      data_type: z.enum(DATA_TYPES).optional().describe('Defaults to string.'),
      description: z.string().max(500).optional(),
      fallback_value: z
        .string()
        .max(2000)
        .optional()
        .describe('Used in merge tags when a contact has no value.'),
    }),
  },
  {
    name: 'update-contact-property',
    title: 'Update Contact Property',
    scope: 'write',
    destructive: true,
    method: 'PATCH',
    path: '/properties/{id}',
    description:
      "Change a custom field's display name, description or fallback value. Pass `null` to clear the last two.",
    inputSchema: z.object({
      id: id('property'),
      display_name: z.string().max(255).optional(),
      description: z.string().max(500).nullable().optional(),
      fallback_value: z.string().max(2000).nullable().optional(),
    }),
  },

  {
    name: 'list-events',
    title: 'List Events',
    scope: 'read',
    method: 'GET',
    path: '/events',
    description: `List the event types the organization tracks from its apps (e.g. order.completed), with their payload schemas and conversion setup. ${QUIET_IDS}`,
    inputSchema: z.object({ ...pagination, search: search('event name') }),
  },
  {
    name: 'get-event',
    title: 'Get Event',
    scope: 'read',
    method: 'GET',
    path: '/events/{id}',
    description: 'Get one event type.',
    inputSchema: z.object({ id: id('event') }),
  },
  {
    name: 'create-event',
    title: 'Create Event',
    scope: 'write',
    method: 'POST',
    path: '/events',
    description:
      'Define an event type that apps can send and automations can react to. The name cannot be changed later.',
    inputSchema: z.object({
      name: z
        .string()
        .min(1)
        .max(80)
        .describe('Unique event name, e.g. order.completed.'),
      description: z.string().max(2000).optional(),
      schema: eventSchema.optional(),
      conversion: conversion.optional(),
    }),
  },
  {
    name: 'update-event',
    title: 'Update Event',
    scope: 'write',
    destructive: true,
    method: 'PATCH',
    path: '/events/{id}',
    description:
      "Change an event type's description, schema or conversion setup. `schema` replaces the whole field list.",
    inputSchema: z.object({
      id: id('event'),
      description: z.string().max(2000).optional(),
      schema: eventSchema.optional(),
      conversion: conversion.optional(),
    }),
  },
];
