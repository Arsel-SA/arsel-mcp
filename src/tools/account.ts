import { z } from 'zod';
import type { ArselTool } from './define.js';
import { id, pagination, QUIET_IDS } from './shared.js';

export const accountTools: ArselTool[] = [
  {
    name: 'list-email-domains',
    title: 'List Email Sending Domains',
    scope: 'read',
    method: 'GET',
    path: '/email/domains',
    description: `List the organization's sending domains and their verification status. Any address at a \`verified\` domain can be an email campaign's \`from\`. Register a new one with create-email-domain. ${QUIET_IDS}`,
    inputSchema: z.object(pagination),
  },
  {
    name: 'get-email-domain',
    title: 'Get Email Sending Domain',
    scope: 'read',
    method: 'GET',
    path: '/email/domains/{id}',
    description:
      'Get one sending domain with the DNS records to publish and the status of each as of the last check. The domain is `verified` once every `required` record is; the other records are recommended for deliverability. To check the records again now, call verify-email-domain.',
    inputSchema: z.object({ id: id('domain') }),
  },
  {
    name: 'create-email-domain',
    title: 'Register Email Sending Domain',
    scope: 'write',
    method: 'POST',
    path: '/email/domains',
    description:
      "Register a domain to send email from and get the DNS records to publish at its DNS provider. The domain starts `pending` and cannot send until it is `verified`. This server cannot change DNS: give the user every record exactly as returned (type, name and value), saying which are `required`, then call verify-email-domain once they have published them. Registering a domain the organization already has returns its current state, and only one domain can be registered at a time.",
    inputSchema: z.object({
      name: z
        .string()
        .min(1)
        .max(255)
        .describe('The domain to send from, e.g. mail.acme.com.'),
    }),
  },
  {
    name: 'verify-email-domain',
    title: 'Verify Email Sending Domain',
    scope: 'write',
    method: 'POST',
    path: '/email/domains/{id}/verify',
    description:
      "Check a sending domain's DNS records now, instead of waiting for the periodic check, and return the result. A record published minutes ago can still read `pending` while DNS catches up: tell the user and try again later rather than calling in a loop.",
    inputSchema: z.object({ id: id('domain') }),
  },
  {
    name: 'list-sms-senders',
    title: 'List SMS Senders',
    scope: 'read',
    method: 'GET',
    path: '/sms/senders',
    description: `List the organization's approved SMS sender names, the country each one sends to and what it is registered for. Use a \`sender_name\` as an SMS campaign's \`from\`; campaigns need a sender whose \`purposes\` include \`marketing\`. ${QUIET_IDS}`,
    inputSchema: z.object(pagination),
  },
  {
    name: 'get-usage',
    title: 'Get Usage',
    scope: 'read',
    method: 'GET',
    path: '/usage',
    description:
      "Get this month's usage against the organization's plan limits: emails, SMS credits, WhatsApp, push and in-app messages, automation runs and contacts. The period is the UTC calendar month, not the billing cycle. A `limit` of null means the plan sets no limit. `contacts` is the current total, not a monthly count.",
    inputSchema: z.object({}),
  },
];
