import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import {
  hostHeaderValidation,
  localhostHostValidation,
  localhostOriginValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ArselClient, DEFAULT_API_URL } from '../client.js';
import { createMcpServer, type ServerOptions } from '../server.js';

export interface HttpOptions extends ServerOptions {
  port: number;
  host?: string;
  allowedHosts?: string[];
  apiUrl?: string;
  fetch?: typeof fetch;
  /** The URL clients connect to, and the audience of the access tokens this server accepts. */
  publicUrl?: string;
  /** The OAuth authorization server that issues those tokens. */
  authServer?: string;
  /** Test seam; defaults to the authorization server's JWKS. */
  jwks?: JWTVerifyGetKey;
}

export const DEFAULT_PUBLIC_URL = 'https://mcp.arsel.sa';
export const DEFAULT_AUTH_SERVER = 'https://api.arsel.sa';

const API_KEY_PREFIX = 'be_';
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

const withoutTrailingSlash = (url: string) => url.replace(/\/+$/, '');

function bearerToken(header: string | null | undefined): string | null {
  const match = header?.match(/^Bearer\s+(\S+)\s*$/);
  return match?.[1] ?? null;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function runHttp(options: HttpOptions): Promise<Server> {
  const { port, host = '127.0.0.1', allowedHosts } = options;
  const apiUrl = options.apiUrl ?? DEFAULT_API_URL;
  const publicUrl = withoutTrailingSlash(options.publicUrl ?? DEFAULT_PUBLIC_URL);
  const authServer = withoutTrailingSlash(options.authServer ?? DEFAULT_AUTH_SERVER);
  const jwks = options.jwks ?? createRemoteJWKSet(new URL(`${authServer}/.well-known/jwks.json`));
  const resourceMetadataUrl = `${publicUrl}/.well-known/oauth-protected-resource`;

  // RFC 9728: the server-level document names the whole origin, the /mcp one names the endpoint.
  // The backend accepts either as `resource` and always mints aud = publicUrl, so both verify the same.
  const protectedResourceDocs = new Map<string, string>([
    ['/.well-known/oauth-protected-resource', publicUrl],
    ['/.well-known/oauth-protected-resource/mcp', `${publicUrl}/mcp`],
  ]);

  // API keys are checked by the API itself on each call; access tokens are
  // checked here too, so a bad one is refused before initialize, as the spec requires.
  const isAcceptedCredential = async (token: string): Promise<boolean> => {
    if (token.startsWith(API_KEY_PREFIX)) return true;
    try {
      await jwtVerify(token, jwks, { issuer: authServer, audience: publicUrl, algorithms: ['ES256'] });
      return true;
    } catch {
      return false;
    }
  };

  const challenge = (res: ServerResponse, invalidToken: boolean) => {
    res.setHeader(
      'WWW-Authenticate',
      `Bearer resource_metadata="${resourceMetadataUrl}"${invalidToken ? ', error="invalid_token"' : ''}`,
    );
    sendJson(res, 401, {
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: invalidToken
          ? 'Unauthorized: the access token is invalid or expired. Sign in again.'
          : 'Unauthorized: sign in to Arsel, or send an Arsel API key as Authorization: Bearer <key>',
      },
      id: null,
    });
  };

  const mcp = toNodeHandler(
    createMcpHandler((ctx) => {
      const token = bearerToken(ctx.requestInfo?.headers.get('authorization'));
      if (!token) throw new Error('Missing credentials');
      return createMcpServer(
        new ArselClient({ token, baseUrl: apiUrl, fetch: options.fetch }),
        options,
      );
    }),
  );

  const validateHost = allowedHosts
    ? hostHeaderValidation(allowedHosts)
    : LOOPBACK.has(host)
      ? localhostHostValidation()
      : null;
  const validateOrigin = LOOPBACK.has(host) ? localhostOriginValidation() : null;

  // Every request is served by a fresh server bound to the caller's own credential, be it an
  // OAuth access token or an API key; nothing is cached or shared between requests.
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;

    if (path === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    const resource = protectedResourceDocs.get(path);
    if (resource) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      sendJson(res, 200, {
        resource,
        authorization_servers: [authServer],
        scopes_supported: ['full_access'],
        bearer_methods_supported: ['header'],
      });
      return;
    }

    if (path !== '/mcp' && path !== '/') {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    if (validateHost && !validateHost(req, res)) return;
    if (validateOrigin && !validateOrigin(req, res)) return;

    const token = bearerToken(req.headers.authorization);
    if (!token) {
      challenge(res, false);
      return;
    }
    if (!(await isAcceptedCredential(token))) {
      challenge(res, true);
      return;
    }

    try {
      await mcp(req, res);
    } catch (error: unknown) {
      if (!res.headersSent) {
        sendJson(res, 500, {
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal error' },
          id: null,
        });
      }
      console.error('MCP request failed:', error instanceof Error ? error.message : error);
    }
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => resolve(server));
  });
}
