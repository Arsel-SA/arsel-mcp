import { McpServer } from '@modelcontextprotocol/server';
import type { ArselClient } from './client.js';
import { type ArselTool, registerTools, type ToolScope } from './tools/define.js';
import { ALL_TOOLS } from './tools/index.js';
import { VERSION } from './version.js';

export { ArselClient, DEFAULT_API_URL } from './client.js';
export type { ArselTool, ToolScope } from './tools/define.js';

/** Every credential gets read, draft and send tools; nothing deletes. */
export const DEFAULT_SCOPES: readonly ToolScope[] = ['read', 'write', 'send'];

const INSTRUCTIONS = [
  'Arsel is a marketing engagement platform: email, SMS, WhatsApp, push and in-app messaging.',
  'Every tool acts on one organization: the one the user connected, or the one that owns the API key.',
  'List tools are cursor-paginated: while `has_more` is true, pass the last item `id` as `after`.',
  'Campaigns created here are drafts until a send tool sends or schedules them. Every send reaches real people and cannot be undone: show the user what will go out and to whom, and send only on their explicit go-ahead.',
  'Automations cannot be enabled or disabled here; the user does that from the Arsel dashboard.',
].join('\n');

export interface ServerOptions {
  scopes?: readonly ToolScope[];
  tools?: readonly ArselTool[];
}

export function createMcpServer(
  client: ArselClient,
  options: ServerOptions = {},
): McpServer {
  const scopes = new Set(options.scopes ?? DEFAULT_SCOPES);
  const server = new McpServer(
    { name: 'arsel', version: VERSION },
    { instructions: INSTRUCTIONS },
  );
  // Set from `initialize` on a 2025-era connection, and from each request's envelope on 2026-era
  // ones; a stateless 2025-era HTTP request has neither, and the HTTP User-Agent stands in.
  client.identifyClient(() => server.server.getClientVersion());
  registerTools(
    server,
    client,
    (options.tools ?? ALL_TOOLS).filter((tool) => scopes.has(tool.scope)),
  );
  return server;
}
