import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { ArselClient } from '../client.js';
import { createMcpServer } from '../server.js';

export function runStdio(apiKey: string, baseUrl: string) {
  return serveStdio(() =>
    createMcpServer(new ArselClient({ token: apiKey, baseUrl })),
  );
}
