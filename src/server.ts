import { McpServer } from '@modelcontextprotocol/server';
import type { ArselClient } from './client.js';
import { type ArselTool, registerTools, type ToolScope } from './tools/define.js';
import { ALL_TOOLS } from './tools/index.js';
import { VERSION } from './version.js';

export { ArselClient, DEFAULT_API_URL } from './client.js';
export type { ArselTool, ToolScope } from './tools/define.js';

/** Every credential gets read and draft tools and nothing that sends or deletes. */
export const DEFAULT_SCOPES: readonly ToolScope[] = ['read', 'write'];

const INSTRUCTIONS = [
  'Arsel is a marketing engagement platform: email, SMS, WhatsApp, push and in-app messaging.',
  'Every tool acts on one organization: the one the user connected, or the one that owns the API key.',
  'List tools are cursor-paginated: while `has_more` is true, pass the last item `id` as `after`.',
  'Campaigns created here stay drafts. This server cannot send or schedule messages; the user sends them from the Arsel dashboard.',
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
  registerTools(
    server,
    client,
    (options.tools ?? ALL_TOOLS).filter((tool) => scopes.has(tool.scope)),
  );
  return server;
}
