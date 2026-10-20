import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ArselClient } from '../src/client.js';
import { createMcpServer, type ServerOptions } from '../src/server.js';
import type { ArselTool } from '../src/tools/define.js';
import { fakeApi, textOf } from './helpers.js';

async function connect(fetch: typeof globalThis.fetch, options?: ServerOptions) {
  const server = createMcpServer(
    new ArselClient({ token: 'be_test', baseUrl: 'https://api.test/v1', fetch }),
    options,
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientTransport);
  return client;
}

describe('createMcpServer', () => {
  it('lists every read and draft tool with annotations', async () => {
    const client = await connect(fakeApi().fetch);

    const { tools } = await client.listTools();
    const get = tools.find((t) => t.name === 'get-contact');
    const update = tools.find((t) => t.name === 'update-contact');

    expect(tools).toHaveLength(84);
    expect(get?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(update?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
  });

  it('leaves out tools the scopes do not allow', async () => {
    const sendTool: ArselTool = {
      name: 'send-email',
      title: 'Send Email',
      description: 'x',
      scope: 'send',
      method: 'POST',
      path: '/email/send',
      inputSchema: z.object({}),
    };
    const client = await connect(fakeApi().fetch, { tools: [sendTool] });

    const { tools } = await client.listTools();

    expect(tools).toEqual([]);
  });

  it("calls the API as the caller's key and returns its JSON", async () => {
    const api = fakeApi(() => ({ body: { object: 'list', has_more: false, data: [] } }));
    const client = await connect(api.fetch);

    const result = await client.callTool({
      name: 'list-contacts',
      arguments: { email: 'a@b.co', limit: 5 },
    });

    const [request] = api.requests;
    expect(request?.method).toBe('GET');
    expect(request?.url.pathname).toBe('/v1/contacts');
    expect(Object.fromEntries(request?.url.searchParams ?? [])).toEqual({
      email: 'a@b.co',
      limit: '5',
    });
    expect(request?.headers.get('authorization')).toBe('Bearer be_test');
    expect(request?.headers.get('user-agent')).toMatch(/^arsel-mcp\//);
    expect(JSON.parse(textOf(result))).toEqual({ object: 'list', has_more: false, data: [] });
  });

  it('turns a not-found into a hint pointing at the list tool', async () => {
    const api = fakeApi(() => ({
      status: 404,
      body: { status_code: 404, name: 'not_found', message: 'Contact not found' },
    }));
    const client = await connect(api.fetch);

    const result = await client.callTool({
      name: 'get-contact',
      arguments: { id: '01957e3a-4b5c-7d8e-9f0a-1b2c3d4e5f6a' },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      'Error 404 not_found: Contact not found\nNo such record in this organization. Call list-contacts to find a valid id.',
    );
  });

  it('points a not-found below a record at the list tool for that record', async () => {
    const api = fakeApi(() => ({
      status: 404,
      body: { status_code: 404, name: 'not_found', message: 'Campaign not found' },
    }));
    const client = await connect(api.fetch);

    const result = await client.callTool({
      name: 'get-email-campaign-stats',
      arguments: { id: '01957e3a-4b5c-7d8e-9f0a-1b2c3d4e5f6a' },
    });

    expect(api.requests[0]?.url.pathname).toBe(
      '/v1/email/campaigns/01957e3a-4b5c-7d8e-9f0a-1b2c3d4e5f6a/stats',
    );
    expect(textOf(result)).toContain('Call list-email-campaigns to find a valid id.');
  });

  it('sends a segment filter to the API as it was given', async () => {
    const api = fakeApi(() => ({ status: 201, body: { id: 's1', status: 'processing' } }));
    const client = await connect(api.fetch);
    const filter = {
      type: 'group',
      operator: 'and',
      conditions: [
        { type: 'channel_status', channel: 'email', consent: 'subscribed' },
        {
          type: 'group',
          operator: 'or',
          conditions: [
            { type: 'tag', tag_ids: ['t1'] },
            { type: 'attribute', field: 'properties.plan', operator: 'equals', value: 'pro' },
          ],
        },
      ],
    };

    const result = await client.callTool({
      name: 'create-segment',
      arguments: { name: 'VIP', filter },
    });

    expect(result.isError).toBeFalsy();
    expect(api.requests[0]?.method).toBe('POST');
    expect(api.requests[0]?.url.pathname).toBe('/v1/segments');
    expect(api.requests[0]?.body).toEqual({ name: 'VIP', filter });
  });

  it('refuses a filter rule with a key the API does not have, without calling the API', async () => {
    const api = fakeApi();
    const client = await connect(api.fetch);

    const result = await client.callTool({
      name: 'create-segment',
      arguments: {
        name: 'Recent openers',
        filter: {
          type: 'group',
          operator: 'and',
          conditions: [
            {
              type: 'engagement_count',
              channel: 'email',
              action: 'opened',
              operator: 'greater_than_or_equal',
              value: 1,
              timeWindow: { value: 30, unit: 'days' },
            },
          ],
        },
      },
    });

    expect(result.isError).toBe(true);
    expect(api.requests).toHaveLength(0);
  });

  it('tells the agent to wait for a segment that is still being computed', async () => {
    const api = fakeApi(() => ({
      status: 409,
      body: { status_code: 409, name: 'segment_not_ready', message: 'Segment is processing' },
    }));
    const client = await connect(api.fetch);

    const result = await client.callTool({
      name: 'list-contacts',
      arguments: { segment_id: 's1' },
    });

    expect(textOf(result)).toContain('Call get-segment until its `status` is `ready`');
  });

  it('passes on the wait a rate limit asks for', async () => {
    const api = fakeApi(() => ({
      status: 429,
      body: { status_code: 429, name: 'rate_limit_exceeded', message: 'Too many requests' },
      headers: { 'Retry-After': '17' },
    }));
    const client = await connect(api.fetch);

    const result = await client.callTool({ name: 'list-tags', arguments: {} });

    expect(textOf(result)).toContain('Wait 17 seconds before retrying.');
  });

  it('does not suggest waiting out a monthly quota', async () => {
    const api = fakeApi(() => ({
      status: 429,
      body: { status_code: 429, name: 'monthly_quota_exceeded', message: 'Monthly quota reached' },
    }));
    const client = await connect(api.fetch);

    const result = await client.callTool({ name: 'list-tags', arguments: {} });

    expect(textOf(result)).toContain('Do not retry');
    expect(textOf(result)).not.toContain('Wait');
  });

  it('rejects input the schema rejects without calling the API', async () => {
    const api = fakeApi();
    const client = await connect(api.fetch);

    const result = await client.callTool({
      name: 'create-tag',
      arguments: { name: 'no/slashes' },
    });

    expect(result.isError).toBe(true);
    expect(api.requests).toHaveLength(0);
  });
});
