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
    expect(count('read')).toBe(45);
    expect(count('write')).toBe(32);
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
    ['get-email-domain', '/email/domains/{id}'],
    ['get-email-campaign-stats', '/email/campaigns/{id}/stats'],
    ['get-sms-campaign-stats', '/sms/campaigns/{id}/stats'],
    ['get-push-campaign-stats', '/push/campaigns/{id}/stats'],
    ['get-in-app-campaign-stats', '/in-app/campaigns/{id}/stats'],
    ['list-whatsapp-templates', '/whatsapp/templates'],
    ['get-whatsapp-template', '/whatsapp/templates/{id}'],
  ])('%s reads %s', (name, path) => {
    const tool = byName(name);
    expect(tool.scope).toBe('read');
    expect(tool.path).toBe(path);
  });

  it.each([
    ['create-segment', 'POST', '/segments'],
    ['update-segment', 'PATCH', '/segments/{id}'],
    ['create-email-domain', 'POST', '/email/domains'],
    ['verify-email-domain', 'POST', '/email/domains/{id}/verify'],
    ['create-whatsapp-template', 'POST', '/whatsapp/templates'],
    ['update-whatsapp-template', 'PATCH', '/whatsapp/templates/{id}'],
  ])('%s writes with %s %s', (name, method, path) => {
    const tool = byName(name);
    expect(tool.scope).toBe('write');
    expect(tool.method).toBe(method);
    expect(tool.path).toBe(path);
  });

  it('marks the writes that change something live as destructive', () => {
    for (const name of [
      'update-segment',
      'create-whatsapp-template',
      'update-whatsapp-template',
    ]) {
      expect(byName(name).destructive, name).toBe(true);
    }
  });

  it('only names tools that exist in its descriptions', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    const mentioned = (text: string) =>
      text.match(/\b(?:list|get|create|update|verify)-[a-z]+(?:-[a-z]+)*\b/g) ?? [];
    for (const tool of ALL_TOOLS) {
      // The whole schema as text, so descriptions nested inside it count too.
      const schema = JSON.stringify(
        z.toJSONSchema(tool.inputSchema, { io: 'input' }),
      );
      for (const name of [tool.description, schema].flatMap(mentioned)) {
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

describe('segment filter', () => {
  const filter = byName('create-segment').inputSchema.shape.filter as z.ZodType;
  const group = (...conditions: unknown[]) => ({
    type: 'group',
    operator: 'and',
    conditions,
  });

  it('accepts every rule type, and groups inside groups', () => {
    const tree = group(
      { type: 'attribute', field: 'properties.plan', operator: 'equals', value: 'pro' },
      { type: 'attribute', field: 'properties.birthday', operator: 'date_is_same_month_day' },
      { type: 'list_membership', list_ids: ['l1'], negate: true },
      { type: 'tag', tag_ids: ['t1'] },
      {
        type: 'engagement_count',
        channel: 'email',
        action: 'opened',
        operator: 'greater_than_or_equal',
        value: 3,
        time_window: { value: 90, unit: 'days' },
      },
      { type: 'last_engagement', channel: 'sms', action: 'clicked', operator: 'does_not_exist' },
      { type: 'message_engagement', target_type: 'campaign', target_id: 'c1', action: 'clicked' },
      { type: 'channel_status', channel: 'email', consent: 'subscribed' },
      {
        type: 'group',
        operator: 'or',
        conditions: [
          {
            type: 'event',
            event_name: 'order_placed',
            count: { operator: 'at_least', value: 2 },
            time_window: { value: 6, unit: 'months' },
            where: [
              { field: 'total', operator: 'greater_than', value: 500, value_type: 'number' },
            ],
          },
          group({ type: 'event', event_name: 'order_placed', negate: true }),
        ],
      },
    );

    expect(filter.parse(tree)).toEqual(tree);
  });

  it.each([
    ['a rule at the root', { type: 'tag', tag_ids: ['t1'] }],
    ['an unknown rule type', group({ type: 'purchase', value: 1 })],
    [
      'a misspelled key, which would otherwise be dropped',
      group({
        type: 'engagement_count',
        channel: 'email',
        action: 'opened',
        operator: 'equals',
        value: 0,
        timeWindow: { value: 30, unit: 'days' },
      }),
    ],
    [
      'a misspelled key in a nested group',
      group(group({ type: 'tag', tag_ids: ['t1'], negated: true })),
    ],
  ])('refuses %s', (_what, tree) => {
    expect(filter.safeParse(tree).success).toBe(false);
  });

  it('is published as one named group that refers to itself', () => {
    const schema = z.toJSONSchema(byName('create-segment').inputSchema, {
      io: 'input',
    }) as unknown as {
      properties: { filter: { $ref: string } };
      $defs: Record<string, { properties: { conditions: { items: { oneOf: { $ref?: string }[] } } } }>;
    };

    const ref = schema.properties.filter.$ref;
    expect(ref).toBe('#/$defs/SegmentFilterGroup');
    const nested = schema.$defs.SegmentFilterGroup?.properties.conditions.items.oneOf;
    expect(nested).toHaveLength(9);
    expect(nested?.[0]?.$ref).toBe(ref);
  });

  it('tells the agent where the names in a rule come from', () => {
    for (const name of ['create-segment', 'update-segment']) {
      const { description } = byName(name);
      for (const source of [
        'list-contact-properties',
        'list-events',
        'list-lists',
        'list-tags',
      ]) {
        expect(description, name).toContain(source);
      }
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
