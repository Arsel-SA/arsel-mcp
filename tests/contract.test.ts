import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { type ArselTool, pathParams } from '../src/tools/define.js';
import { ALL_TOOLS } from '../src/tools/index.js';

/**
 * The tools are handwritten; this keeps them honest against the API's
 * published OpenAPI document (refresh with `npm run openapi:update`).
 */
interface Schema {
  $ref?: string;
  $defs?: Record<string, Schema>;
  type?: string;
  const?: string;
  enum?: string[];
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  allOf?: Schema[];
  anyOf?: Schema[];
  oneOf?: Schema[];
}
interface Operation {
  parameters?: { name: string; in: string; required?: boolean; schema?: Schema }[];
  requestBody?: { content: Record<string, { schema: Schema }> };
}

const spec = JSON.parse(
  readFileSync(new URL('../openapi/arsel-api.json', import.meta.url), 'utf8'),
) as {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema> };
};

const shape = (path: string) => path.replace(/\{[^}]+\}/g, '{}');

function operationFor(tool: ArselTool): Operation | undefined {
  const specPath = Object.keys(spec.paths).find(
    (p) => shape(p) === shape(`/v1${tool.path}`),
  );
  return specPath ? spec.paths[specPath]?.[tool.method.toLowerCase()] : undefined;
}

type Defs = Record<string, Schema>;

/** Follows `$ref`s and the single-branch wrappers both generators emit for nullable or described fields. */
function resolve(schema: Schema | undefined, defs: Defs): Schema {
  if (!schema) return {};
  if (schema.$ref) return resolve(defs[schema.$ref.split('/').pop() ?? ''], defs);
  const branches = schema.allOf ?? schema.anyOf ?? schema.oneOf;
  const branch = branches?.filter((b) => b.type !== 'null');
  if (branch?.length === 1) return resolve({ ...schema, ...branch[0], allOf: undefined, anyOf: undefined, oneOf: undefined }, defs);
  return schema;
}

/** The branches of a union keyed by their `type` tag, or nothing when it is not a tagged union. */
function variants(schema: Schema, defs: Defs): Map<string, Schema> | undefined {
  const branches = schema.oneOf ?? schema.anyOf;
  if (!branches || branches.length < 2) return undefined;
  const tagged = new Map<string, Schema>();
  for (const branch of branches) {
    const tag = resolve(branch, defs).properties?.type;
    const value = tag?.const ?? (tag?.enum?.length === 1 ? tag.enum[0] : undefined);
    if (value === undefined) return undefined;
    tagged.set(value, branch);
  }
  return tagged;
}

/** Query parameters for GET as one object schema, the request body otherwise. */
function specInput(tool: ArselTool, operation: Operation): Schema {
  if (tool.method !== 'GET') {
    return resolve(operation.requestBody?.content['application/json']?.schema, spec.components.schemas);
  }
  const query = (operation.parameters ?? []).filter((p) => p.in === 'query');
  return {
    type: 'object',
    properties: Object.fromEntries(query.map((p) => [p.name, p.schema ?? {}])),
    required: query.filter((p) => p.required).map((p) => p.name),
  };
}

function toolInput(tool: ArselTool): Schema {
  const json = z.toJSONSchema(tool.inputSchema, { io: 'input' }) as Schema;
  const params = new Set(pathParams(tool));
  return {
    ...json,
    properties: Object.fromEntries(
      Object.entries(json.properties ?? {}).filter(([name]) => !params.has(name)),
    ),
    required: (json.required ?? []).filter((name) => !params.has(name)),
  };
}

type Kind = 'fields' | 'required' | 'enums';

interface Walk {
  kind: Kind;
  /** The tool schema's own `$defs`; the API side resolves against the spec. */
  defs: Defs;
  /** Pairs of `$ref`s already compared, so a recursive schema ends. */
  seen: Set<string>;
}

/** Walks both schemas side by side, into nested objects, arrays and tagged unions, and reports where they disagree. */
function mismatches(ours: Schema, theirs: Schema, walk: Walk, at = 'input'): string[] {
  if (ours.$ref && theirs.$ref) {
    const pair = `${ours.$ref} ${theirs.$ref}`;
    if (walk.seen.has(pair)) return [];
    walk.seen.add(pair);
  }
  const { kind } = walk;
  const a = resolve(ours, walk.defs);
  const b = resolve(theirs, spec.components.schemas);
  if (a.items || b.items) return mismatches(a.items ?? {}, b.items ?? {}, walk, `${at}[]`);

  const problems: string[] = [];
  const mine = variants(a, walk.defs);
  const api = variants(b, spec.components.schemas);
  if (mine && api) {
    const tags = [...mine.keys()].sort();
    const apiTags = [...api.keys()].sort();
    if (kind === 'fields' && tags.join() !== apiTags.join()) {
      problems.push(`${at}: tool has the variants [${tags}], API has [${apiTags}]`);
    }
    for (const tag of tags.filter((t) => api.has(t))) {
      problems.push(...mismatches(mine.get(tag) ?? {}, api.get(tag) ?? {}, walk, `${at}<${tag}>`));
    }
    return problems;
  }

  if (kind === 'enums' && a.enum && b.enum) {
    const extra = a.enum.filter((v) => !b.enum?.includes(v));
    if (extra.length) problems.push(`${at}: the API rejects ${extra.join(', ')}`);
  }
  if (!a.properties || !b.properties) return problems;

  const fields = Object.keys(a.properties).sort();
  const apiFields = Object.keys(b.properties).sort();
  if (kind === 'fields' && fields.join() !== apiFields.join()) {
    problems.push(`${at}: tool has [${fields}], API has [${apiFields}]`);
  }
  if (kind === 'required') {
    const r1 = [...(a.required ?? [])].sort();
    const r2 = [...(b.required ?? [])].sort();
    if (r1.join() !== r2.join()) problems.push(`${at}: tool requires [${r1}], API requires [${r2}]`);
  }
  for (const name of fields.filter((n) => apiFields.includes(n))) {
    problems.push(
      ...mismatches(a.properties[name] ?? {}, b.properties[name] ?? {}, walk, `${at}.${name}`),
    );
  }
  return problems;
}

/** The API's input less the fields the tool withholds, each of which must still exist there. */
function offeredInput(tool: ArselTool, operation: Operation): Schema {
  const api = specInput(tool, operation);
  const withheld = tool.withheld ?? [];
  const missing = withheld.filter((name) => !api.properties?.[name]);
  if (missing.length) throw new Error(`${tool.name} withholds [${missing}], which the API does not have`);
  return {
    ...api,
    properties: Object.fromEntries(
      Object.entries(api.properties ?? {}).filter(([name]) => !withheld.includes(name)),
    ),
    required: (api.required ?? []).filter((name) => !withheld.includes(name)),
  };
}

function check(tool: ArselTool, kind: Kind): string[] {
  const operation = operationFor(tool);
  if (!operation) return [];
  const input = toolInput(tool);
  return mismatches(input, offeredInput(tool, operation), { kind, defs: input.$defs ?? {}, seen: new Set() });
}

const cases = ALL_TOOLS.map((tool) => [tool.name, tool] as const);

describe('tools match the Arsel API OpenAPI document', () => {
  it.each(cases)('%s: calls an operation the API has', (_name, tool) => {
    expect(operationFor(tool)).toBeDefined();
  });

  it.each(cases)('%s: declares every path parameter', (_name, tool) => {
    const specParams = (tool.path.match(/\{[^}]+\}/g) ?? []).length;
    expect(pathParams(tool)).toHaveLength(specParams);
    for (const param of pathParams(tool)) {
      expect(Object.keys(tool.inputSchema.shape)).toContain(param);
    }
  });

  it.each(cases)('%s: input fields are exactly the API fields', (_name, tool) => {
    expect(check(tool, 'fields')).toEqual([]);
  });

  it.each(cases)('%s: required fields agree with the API', (_name, tool) => {
    expect(check(tool, 'required')).toEqual([]);
  });

  it.each(cases)('%s: enums offer only values the API accepts', (_name, tool) => {
    expect(check(tool, 'enums')).toEqual([]);
  });
});
