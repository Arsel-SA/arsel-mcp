import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/cli.js';
import { DEFAULT_API_URL } from '../src/client.js';
import { DEFAULT_AUTH_SERVER, DEFAULT_PUBLIC_URL } from '../src/transports/http.js';

describe('resolveConfig', () => {
  it('serves stdio with the key from the environment', () => {
    expect(resolveConfig([], { ARSEL_API_KEY: 'be_1' })).toEqual({
      transport: 'stdio',
      apiKey: 'be_1',
      apiUrl: DEFAULT_API_URL,
    });
  });

  it('refuses stdio without a key', () => {
    expect(() => resolveConfig([], {})).toThrow(/ARSEL_API_KEY/);
  });

  it('serves HTTP without a server-side key', () => {
    expect(
      resolveConfig(['--http', '--port', '9000', '--host', '0.0.0.0', '--allowed-hosts', 'mcp.arsel.sa, localhost'], {
        ARSEL_API_URL: 'https://api.example/v1',
      }),
    ).toEqual({
      transport: 'http',
      port: 9000,
      host: '0.0.0.0',
      allowedHosts: ['mcp.arsel.sa', 'localhost'],
      apiUrl: 'https://api.example/v1',
      publicUrl: DEFAULT_PUBLIC_URL,
      authServer: DEFAULT_AUTH_SERVER,
    });
  });

  it('rejects an invalid port', () => {
    expect(() => resolveConfig(['--http', '--port', 'abc'], {})).toThrow(/Invalid port/);
  });

  it('reads the OAuth URLs for HTTP mode', () => {
    expect(
      resolveConfig(
        ['--http', '--public-url', 'https://mcp.staging.test/', '--auth-server', 'https://api.staging.test'],
        {},
      ),
    ).toMatchObject({ publicUrl: 'https://mcp.staging.test/', authServer: 'https://api.staging.test' });
    expect(resolveConfig(['--http'], {})).toMatchObject({
      publicUrl: DEFAULT_PUBLIC_URL,
      authServer: DEFAULT_AUTH_SERVER,
    });
  });
});
