import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toRequest } from '../src/tools/define.js';
import { ALL_TOOLS } from '../src/tools/index.js';

const byName = (name: string) => {
  const tool = ALL_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool;
};

describe('tool catalogue', () => {
  it('has unique kebab-case names and titles', () => {
    const names = ALL_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const tool of ALL_TOOLS) {
      expect(tool.name).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(tool.title.length).toBeGreaterThan(0);
    }
  });

  it('exposes read and draft tools, and nothing that sends', () => {
    const count = (scope: string) =>
      ALL_TOOLS.filter((t) => t.scope === scope).length;
    expect(count('read')).toBe(38);
    expect(count('write')).toBe(26);
    expect(count('send')).toBe(0);
  });

  it('only reads with GET', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.method === 'GET').toBe(tool.scope === 'read');
    }
  });

  it.each([
    ['list-segments', '/segments'],
    ['get-segment', '/segments/{id}'],
    ['list-email-domains', '/email/domains'],
    ['list-sms-senders', '/sms/senders'],
    ['get-usage', '/usage'],
  ])('%s reads %s', (name, path) => {
    const tool = byName(name);
    expect(tool.scope).toBe('read');
    expect(tool.path).toBe(path);
  });

  it('only names tools that exist in its descriptions', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    const mentioned = (text: string) =>
      text.match(/\b(?:list|get|create|update)-[a-z]+(?:-[a-z]+)*\b/g) ?? [];
    for (const tool of ALL_TOOLS) {
      const fields = Object.values(
        z.toJSONSchema(tool.inputSchema, { io: 'input' }).properties ?? {},
      ) as { description?: string }[];
      const texts = [tool.description, ...fields.map((f) => f.description ?? '')];
      for (const name of texts.flatMap(mentioned)) {
        expect(names, `${tool.name} mentions ${name}`).toContain(name);
      }
    }
  });

  it('sends the agent to the discovery tools rather than to the user', () => {
    const describe = (tool: string, field: string) =>
      byName(tool).inputSchema.shape[field]?.description ?? '';

    for (const tool of ['create-email-campaign', 'update-email-campaign']) {
      expect(describe(tool, 'from')).toContain('list-email-domains');
    }
    for (const tool of ['create-sms-campaign', 'update-sms-campaign']) {
      expect(describe(tool, 'from')).toContain('list-sms-senders');
    }
    for (const tool of [
      'create-email-campaign',
      'create-sms-campaign',
      'create-push-campaign',
    ]) {
      expect(byName(tool).description).toContain('list-segments');
    }
  });
});

describe('toRequest', () => {
  it('fills path parameters and sends the rest of a GET as the query', () => {
    expect(
      toRequest(byName('list-contact-push-devices'), {
        contact_id: 'c/1',
        platform: 'ios',
      }),
    ).toEqual({
      method: 'GET',
      path: '/push/contacts/c%2F1/devices',
      query: { platform: 'ios' },
    });
  });

  it('sends the rest of a write as the JSON body, DELETE included', () => {
    expect(
      toRequest(byName('remove-contacts-from-list'), {
        id: 'list-1',
        contact_ids: ['c1'],
      }),
    ).toEqual({
      method: 'DELETE',
      path: '/lists/list-1/contacts',
      body: { contact_ids: ['c1'] },
    });
  });
});
