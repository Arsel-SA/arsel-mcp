import { parseArgs } from 'node:util';
import { DEFAULT_API_URL } from './client.js';
import { DEFAULT_AUTH_SERVER, DEFAULT_PUBLIC_URL } from './transports/http.js';

export const HELP = `arsel-mcp — the Arsel MCP server

Usage:
  arsel-mcp                     Serve over stdio (local clients). Needs ARSEL_API_KEY.
  arsel-mcp --http [--port N]   Serve Streamable HTTP. Clients sign in with OAuth, or
                                send an API key as "Authorization: Bearer <key>".

Options:
  --key <key>             Arsel API key for stdio mode (default: $ARSEL_API_KEY)
  --http                  Serve over HTTP instead of stdio
  --port <n>              HTTP port (default: $PORT or 8077)
  --host <host>           HTTP bind address (default: 127.0.0.1; 0.0.0.0 behind a proxy)
  --allowed-hosts <list>  Comma-separated Host header names to accept
  --api-url <url>         Arsel API base URL (default: $ARSEL_API_URL or ${DEFAULT_API_URL})
  --public-url <url>      Public URL of this server; the OAuth token audience
                          (default: $ARSEL_MCP_PUBLIC_URL or ${DEFAULT_PUBLIC_URL})
  --auth-server <url>     OAuth authorization server
                          (default: $ARSEL_AUTH_SERVER or ${DEFAULT_AUTH_SERVER})
  -h, --help              Show this help
`;

export type Config =
  | { transport: 'stdio'; apiKey: string; apiUrl: string }
  | {
      transport: 'http';
      port: number;
      host: string;
      allowedHosts?: string[];
      apiUrl: string;
      publicUrl: string;
      authServer: string;
    }
  | { transport: 'help' };

export function resolveConfig(
  argv: string[],
  env: Record<string, string | undefined>,
): Config {
  const { values } = parseArgs({
    args: argv,
    options: {
      key: { type: 'string' },
      http: { type: 'boolean' },
      port: { type: 'string' },
      host: { type: 'string' },
      'allowed-hosts': { type: 'string' },
      'api-url': { type: 'string' },
      'public-url': { type: 'string' },
      'auth-server': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) return { transport: 'help' };
  const apiUrl = values['api-url'] ?? env.ARSEL_API_URL ?? DEFAULT_API_URL;

  if (values.http) {
    const port = Number(values.port ?? env.PORT ?? 8077);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      throw new Error(`Invalid port: ${values.port ?? env.PORT}`);
    }
    return {
      transport: 'http',
      port,
      host: values.host ?? '127.0.0.1',
      allowedHosts: values['allowed-hosts']
        ?.split(',')
        .map((h) => h.trim())
        .filter(Boolean),
      apiUrl,
      publicUrl: values['public-url'] ?? env.ARSEL_MCP_PUBLIC_URL ?? DEFAULT_PUBLIC_URL,
      authServer: values['auth-server'] ?? env.ARSEL_AUTH_SERVER ?? DEFAULT_AUTH_SERVER,
    };
  }

  const apiKey = values.key ?? env.ARSEL_API_KEY;
  if (!apiKey) {
    throw new Error(
      'No API key. Set ARSEL_API_KEY or pass --key. Create one in the Arsel dashboard under Settings → API keys.',
    );
  }
  return { transport: 'stdio', apiKey, apiUrl };
}
