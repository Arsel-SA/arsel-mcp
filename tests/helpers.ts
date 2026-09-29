import { vi } from 'vitest';

export interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: unknown;
}

/** A stand-in for the Arsel API that records each request and answers from `respond`. */
export function fakeApi(
  respond: (request: RecordedRequest) => { status?: number; body?: unknown; headers?: Record<string, string> } = () => ({
    body: { ok: true },
  }),
) {
  const requests: RecordedRequest[] = [];
  const fetch = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const request: RecordedRequest = {
      method: init?.method ?? 'GET',
      url: new URL(String(input)),
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    requests.push(request);
    const { status = 200, body = null, headers = {} } = respond(request);
    return new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, requests };
}

export function textOf(result: unknown): string {
  const content = (result as { content: { type: string; text?: string }[] }).content;
  return content[0]?.text ?? '';
}
