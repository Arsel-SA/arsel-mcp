import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runHttp } from '../src/transports/http.js';
import { fakeApi, textOf } from './helpers.js';

const PUBLIC_URL = 'https://mcp.test';
const AUTH_SERVER = 'https://api.test';

describe('HTTP transport', () => {
  const api = fakeApi((request) => ({ body: { key: request.headers.get('authorization') } }));
  let server: Server;
  let base: string;
  let sign: (claims?: { aud?: string; iss?: string; exp?: number }) => Promise<string>;

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'ES256' };
    sign = ({ aud = PUBLIC_URL, iss = AUTH_SERVER, exp } = {}) =>
      new SignJWT({ org_id: 'org-1', grant_id: 'g1', client_id: 'c', scope: 'full_access' })
        .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
        .setSubject('user-1')
        .setIssuer(iss)
        .setAudience(aud)
        .setIssuedAt()
        .setExpirationTime(exp ?? '15m')
        .sign(privateKey);

    server = await runHttp({
      port: 0,
      apiUrl: 'https://api.test/v1',
      fetch: api.fetch,
      publicUrl: PUBLIC_URL,
      authServer: AUTH_SERVER,
      jwks: createLocalJWKSet({ keys: [jwk] }),
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const connect = async (token: string) => {
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    return client;
  };

  const initialize = (token?: string) =>
    fetch(`${base}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } },
      }),
    });

  it('answers the health check', async () => {
    expect((await fetch(`${base}/health`)).status).toBe(200);
  });

  it('answers nothing else outside /mcp', async () => {
    expect((await fetch(`${base}/orgs/1/api-keys`)).status).toBe(404);
  });

  it.each([
    ['/.well-known/oauth-protected-resource', PUBLIC_URL],
    ['/.well-known/oauth-protected-resource/mcp', `${PUBLIC_URL}/mcp`],
  ])('serves the protected resource metadata at %s', async (path, resource) => {
    const res = await fetch(`${base}${path}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(await res.json()).toEqual({
      resource,
      authorization_servers: [AUTH_SERVER],
      scopes_supported: ['full_access'],
      bearer_methods_supported: ['header'],
    });
  });

  it('challenges a request without credentials towards OAuth', async () => {
    const res = await initialize();
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe(
      `Bearer resource_metadata="${PUBLIC_URL}/.well-known/oauth-protected-resource"`,
    );
  });

  it.each([
    ['a forged token', async () => `${await sign()}x`],
    ['a token for another resource', () => sign({ aud: 'https://other.test' })],
    ['a token from another issuer', () => sign({ iss: 'https://evil.test' })],
    ['an expired token', () => sign({ exp: Math.floor(Date.now() / 1000) - 60 })],
  ])('refuses %s before initialize', async (_label, token) => {
    const res = await initialize(await token());
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('error="invalid_token"');
  });

  it('forwards a valid access token to the API', async () => {
    const token = await sign();
    const client = await connect(token);
    const result = await client.callTool({ name: 'list-tags', arguments: {} });
    expect(JSON.parse(textOf(result))).toEqual({ key: `Bearer ${token}` });
    await client.close();
  });

  it('still serves each caller with their own API key', async () => {
    const alice = await connect('be_alice');
    const bob = await connect('be_bob');

    const fromAlice = await alice.callTool({ name: 'list-tags', arguments: {} });
    const fromBob = await bob.callTool({ name: 'list-tags', arguments: {} });

    expect(JSON.parse(textOf(fromAlice))).toEqual({ key: 'Bearer be_alice' });
    expect(JSON.parse(textOf(fromBob))).toEqual({ key: 'Bearer be_bob' });
    await alice.close();
    await bob.close();
  });

  it('lists the tools over HTTP', async () => {
    const client = await connect('be_alice');
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(64);
    await client.close();
  });
});
