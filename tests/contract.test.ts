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
  type?: string;
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

/** Follows `$ref`s and the single-branch wrappers both generators emit for nullable or described fields. */
function resolve(schema: Schema | undefined): Schema {
  if (!schema) return {};
  if (schema.$ref) {
    return resolve(spec.components.schemas[schema.$ref.split('/').pop() ?? '']);
  }
  const branches = schema.allOf ?? schema.anyOf ?? schema.oneOf;
  const branch = branches?.filter((b) => b.type !== 'null');
  if (branch?.length === 1) return resolve({ ...schema, ...branch[0], allOf: undefined, anyOf: undefined, oneOf: undefined });
  return schema;
}

/** Query parameters for GET as one object schema, the request body otherwise. */
function specInput(tool: ArselTool, operation: Operation): Schema {
  if (tool.method !== 'GET') {
    return resolve(operation.requestBody?.content['application/json']?.schema);
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

/** Walks both schemas side by side, into nested objects and arrays, and reports where they disagree. */
function mismatches(ours: Schema, theirs: Schema, kind: Kind, at = 'input'): string[] {
  const a = resolve(ours);
  const b = resolve(theirs);
  if (a.items || b.items) return mismatches(a.items ?? {}, b.items ?? {}, kind, `${at}[]`);

  const problems: string[] = [];
  if (kind === 'enums' && a.enum && b.enum) {
    const extra = a.enum.filter((v) => !b.enum?.includes(v));
    if (extra.length) problems.push(`${at}: the API rejects ${extra.join(', ')}`);
  }
  if (!a.properties || !b.properties) return problems;

  const mine = Object.keys(a.properties).sort();
  const api = Object.keys(b.properties).sort();
  if (kind === 'fields' && mine.join() !== api.join()) {
    problems.push(`${at}: tool has [${mine}], API has [${api}]`);
  }
  if (kind === 'required') {
    const r1 = [...(a.required ?? [])].sort();
    const r2 = [...(b.required ?? [])].sort();
    if (r1.join() !== r2.join()) problems.push(`${at}: tool requires [${r1}], API requires [${r2}]`);
  }
  for (const name of mine.filter((n) => api.includes(n))) {
    problems.push(
      ...mismatches(a.properties[name] ?? {}, b.properties[name] ?? {}, kind, `${at}.${name}`),
    );
  }
  return problems;
}

function check(tool: ArselTool, kind: Kind): string[] {
  const operation = operationFor(tool);
  return operation ? mismatches(toolInput(tool), specInput(tool, operation), kind) : [];
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
