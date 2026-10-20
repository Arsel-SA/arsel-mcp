import type {
  CallToolResult,
  McpServer,
  ToolAnnotations,
} from '@modelcontextprotocol/server';
import type { z } from 'zod';
import {
  ArselApiError,
  type ArselClient,
  ArselNetworkError,
  type HttpMethod,
} from '../client.js';

export type ToolScope = 'read' | 'write' | 'send';

export interface ArselTool {
  name: string;
  title: string;
  description: string;
  scope: ToolScope;
  method: HttpMethod;
  path: string;
  inputSchema: z.ZodObject;
  destructive?: boolean;
  /** Body fields the API takes that this tool leaves out because they reach recipients, e.g. a `status` that starts sending. */
  withheld?: readonly string[];
}

const PATH_PARAM = /\{([a-z_]+)\}/g;

export function pathParams(tool: ArselTool): string[] {
  return [...tool.path.matchAll(PATH_PARAM)].map((match) => match[1] ?? '');
}

export function toRequest(tool: ArselTool, input: Record<string, unknown>) {
  const rest = { ...input };
  const path = tool.path.replace(PATH_PARAM, (_match, name: string) => {
    const value = rest[name];
    delete rest[name];
    return encodeURIComponent(String(value));
  });
  return tool.method === 'GET'
    ? { method: tool.method, path, query: rest }
    : { method: tool.method, path, body: rest };
}

export function registerTools(
  server: McpServer,
  client: ArselClient,
  tools: readonly ArselTool[],
): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: annotationsFor(tool),
      },
      (input: Record<string, unknown>) =>
        callTool(client, tool, input, listToolFor(tool, tools)),
    );
  }
}

function annotationsFor(tool: ArselTool): ToolAnnotations {
  const isReadOnly = tool.scope === 'read';
  return {
    title: tool.title,
    readOnlyHint: isReadOnly,
    destructiveHint: !isReadOnly && (tool.destructive ?? false),
    idempotentHint: isReadOnly,
    openWorldHint: tool.scope === 'send',
  };
}

function listToolFor(
  tool: ArselTool,
  tools: readonly ArselTool[],
): string | undefined {
  const collection = tool.path.match(/^(.*?)\/\{[a-z_]+\}/)?.[1];
  return collection
    ? tools.find((t) => t.method === 'GET' && t.path === collection)?.name
    : undefined;
}

async function callTool(
  client: ArselClient,
  tool: ArselTool,
  input: Record<string, unknown>,
  listTool: string | undefined,
): Promise<CallToolResult> {
  try {
    const result = await client.request(toRequest(tool, input));
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  } catch (error: unknown) {
    return { isError: true, content: [{ type: 'text', text: describeError(error, tool, listTool) }] };
  }
}

export function describeError(
  error: unknown,
  tool: ArselTool,
  listTool?: string,
): string {
  if (error instanceof ArselNetworkError) {
    return `${error.message}. Retrying shortly may succeed.`;
  }
  if (!(error instanceof ArselApiError)) {
    return 'Unexpected error while calling the Arsel API.';
  }
  const hint = recoveryHint(error, tool, listTool);
  return `Error ${error.status} ${error.code}: ${error.message}${hint ? `\n${hint}` : ''}`;
}

function recoveryHint(
  error: ArselApiError,
  tool: ArselTool,
  listTool?: string,
): string | undefined {
  if (error.status === 401) {
    return 'The credential was rejected: it may have expired or been revoked. Ask the user to reconnect, or provide a valid API key.';
  }
  if (error.code === 'monthly_quota_exceeded') {
    return "The organization's monthly quota is used up. Do not retry; tell the user.";
  }
  if (error.code === 'event_limit_reached') {
    return 'The organization has reached its limit of event definitions. Reuse one from list-events, or tell the user.';
  }
  if (error.code === 'segment_limit_reached') {
    return 'The organization has reached its limit of segments. Reuse one from list-segments, or tell the user.';
  }
  if (error.code === 'segment_not_ready') {
    return "The segment's members are still being computed. Call get-segment until its `status` is `ready`, then try again.";
  }
  if (error.code === 'domain_limit_reached' || error.code === 'domain_unavailable') {
    return 'This domain cannot be registered for this organization. Do not retry; tell the user.';
  }
  if (error.code === 'template_name_duplicate') {
    return 'A WhatsApp template with this name and language already exists. Find it with list-whatsapp-templates and its `name`, or choose another name.';
  }
  if (error.code === 'automation_graph_invalid') {
    return `The steps break a rule of the automation's shape, named above, and nothing was saved. Fix the graph and call ${tool.name} again.`;
  }
  if (error.code === 'automation_enabled') {
    return 'This automation is live, so its steps cannot be replaced. Ask the user to disable it in the Arsel dashboard first, or build the change on a copy from clone-automation.';
  }
  if (error.code === 'validation_error' || error.code === 'bad_request') {
    return `Correct the input named above and call ${tool.name} again.`;
  }
  if (error.status === 404) {
    return listTool
      ? `No such record in this organization. Call ${listTool} to find a valid id.`
      : 'No such record in this organization. Check the id.';
  }
  if (error.status === 409) {
    return 'This conflicts with the current state of the record. Fetch it again before retrying.';
  }
  if (error.status === 403) {
    return "This organization's plan or settings do not allow this. Do not retry; tell the user.";
  }
  if (error.status === 429) {
    return `Rate limited. Wait ${error.retryAfterSeconds ?? 60} seconds before retrying.`;
  }
  if (error.status >= 500) {
    return 'Arsel could not complete this request. Retrying shortly may succeed.';
  }
  return undefined;
}
