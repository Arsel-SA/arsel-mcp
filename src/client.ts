import { VERSION } from './version.js';

export const DEFAULT_API_URL = 'https://api.arsel.sa/v1';

const REQUEST_TIMEOUT_MS = 30_000;

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface ArselRequest {
  method: HttpMethod;
  path: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

export class ArselApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ArselApiError';
  }
}

export class ArselNetworkError extends Error {
  constructor(readonly url: string, cause: unknown) {
    super(`Could not reach the Arsel API at ${url}`, { cause });
    this.name = 'ArselNetworkError';
  }
}

export interface ArselClientOptions {
  token: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

/** A thin client over the Arsel REST API, authenticated as the caller (an OAuth access token or an API key). */
export class ArselClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ArselClientOptions) {
    this.token = options.token;
    this.baseUrl = (options.baseUrl ?? DEFAULT_API_URL).replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? fetch;
  }

  async request(request: ArselRequest): Promise<unknown> {
    const url = new URL(this.baseUrl + request.path);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: request.method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
          'User-Agent': `arsel-mcp/${VERSION}`,
          ...(request.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error: unknown) {
      throw new ArselNetworkError(this.baseUrl, error);
    }

    const text = await response.text();
    const payload: unknown = text ? safeJson(text) : null;
    if (response.ok) return payload;

    const envelope = (payload ?? {}) as { name?: unknown; message?: unknown };
    const retryAfter = Number(response.headers.get('retry-after'));
    throw new ArselApiError(
      response.status,
      typeof envelope.name === 'string' ? envelope.name : 'error',
      typeof envelope.message === 'string'
        ? envelope.message
        : `HTTP ${response.status}`,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    );
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}
