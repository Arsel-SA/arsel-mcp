import { z } from 'zod';
import type { ArselTool } from './define.js';
import { id, pagination, PLATFORMS, QUIET_IDS } from './shared.js';

const TRANSACTIONAL =
  'Transactional messages are the one-off sends an application makes through the API (receipts, one-time passwords), not campaigns.';

const log = (
  channel: string,
  plural: string,
  path: string,
  resource: string,
): ArselTool[] => [
  {
    name: `list-${plural}`,
    title: `List Transactional ${channel}`,
    scope: 'read',
    method: 'GET',
    path,
    description: `List transactional ${channel.toLowerCase()} with their delivery status. ${TRANSACTIONAL} ${QUIET_IDS}`,
    inputSchema: z.object(pagination),
  },
  {
    name: `get-${resource}`,
    title: `Get Transactional ${channel}`,
    scope: 'read',
    method: 'GET',
    path: `${path}/{id}`,
    description: `Get one transactional ${channel.toLowerCase()} message with its delivery status.`,
    inputSchema: z.object({ id: id(resource.replace(/-/g, ' ')) }),
  },
];

export const messageTools: ArselTool[] = [
  ...log('Emails', 'emails', '/email', 'email'),
  ...log('SMS', 'sms-messages', '/sms', 'sms-message'),
  ...log('WhatsApp', 'whatsapp-messages', '/whatsapp', 'whatsapp-message'),
  ...log('Push', 'push-notifications', '/push', 'push-notification'),
  {
    name: 'list-contact-push-devices',
    title: 'List Contact Push Devices',
    scope: 'read',
    method: 'GET',
    path: '/push/contacts/{contact_id}/devices',
    description:
      "List a contact's registered push devices, to check whether they can receive push notifications.",
    inputSchema: z.object({
      contact_id: id('contact'),
      ...pagination,
      platform: z.enum(PLATFORMS).optional(),
      status: z
        .enum(['active', 'expired', 'revoked', 'failed'])
        .optional()
        .describe('Defaults to every status, revoked and expired included.'),
    }),
  },
  {
    name: 'get-push-device-import',
    title: 'Get Push Device Import',
    scope: 'read',
    method: 'GET',
    path: '/push/imports/{import_job_id}',
    description:
      'Get the progress and per-row errors of a bulk push-device import.',
    inputSchema: z.object({ import_job_id: id('import job') }),
  },
];
