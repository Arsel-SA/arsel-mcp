import { z } from 'zod';
import type { ArselTool } from './define.js';
import { pagination, QUIET_IDS } from './shared.js';

export const accountTools: ArselTool[] = [
  {
    name: 'list-email-domains',
    title: 'List Email Sending Domains',
    scope: 'read',
    method: 'GET',
    path: '/email/domains',
    description: `List the organization's sending domains and their verification status. Any address at a \`verified\` domain can be an email campaign's \`from\`. Domains are added and verified in the Arsel dashboard. ${QUIET_IDS}`,
    inputSchema: z.object(pagination),
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
