#!/usr/bin/env node
import { HELP, resolveConfig } from './cli.js';
import { runHttp } from './transports/http.js';
import { runStdio } from './transports/stdio.js';

function fail(error: unknown): never {
  console.error(error instanceof Error ? error.message : 'Unexpected error');
  process.exit(1);
}

let config: ReturnType<typeof resolveConfig>;
try {
  config = resolveConfig(process.argv.slice(2), process.env);
} catch (error: unknown) {
  fail(error);
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

if (config.transport === 'help') {
  console.log(HELP);
} else if (config.transport === 'http') {
  runHttp(config)
    .then(() =>
      // stderr, like every other diagnostic: stdout is reserved in stdio mode.
      console.error(`Arsel MCP server listening on http://${config.host}:${config.port}/mcp`),
    )
    .catch(fail);
} else {
  runStdio(config.apiKey, config.apiUrl);
}
