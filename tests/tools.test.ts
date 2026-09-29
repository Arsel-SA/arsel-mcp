import { describe, expect, it } from 'vitest';
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
    expect(count('read')).toBe(33);
    expect(count('write')).toBe(26);
    expect(count('send')).toBe(0);
  });

  it('only reads with GET', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.method === 'GET').toBe(tool.scope === 'read');
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
