# CLAUDE.md

The Arsel MCP server (`@arsel.sa/mcp`). It is a thin client over the public Arsel REST API, the
same shape as Resend's and Stripe's MCP servers. It runs over stdio (`npx`, one key) or over
stateless Streamable HTTP (hosted, a key per request).

This repo is public. Don't reference private Arsel repos, internal paths, tickets or infrastructure.

## Commands

```bash
npm run typecheck      # tsc --noEmit
npm test               # Vitest: contract, catalogue, server, HTTP, CLI
npm run build          # dist/
npm run openapi:update # refresh openapi/arsel-api.json from the live API
```

## Rules

- **Every tool is exactly one REST call** (`src/tools/define.ts` → `toRequest`). Path params fill
  `{name}` segments; GET sends the rest as the query string, and any other method sends it as the
  JSON body. Don't add business logic or multi-call tools. If a tool needs it, the API is missing an
  endpoint.
- **Input schemas are handwritten zod** and use the API's own field names. The contract test holds
  them to `openapi/arsel-api.json`: when it fails, fix the tool, not the test.
- **Scopes gate what is registered.** `read` is GET, `write` creates or edits drafts, and `send`
  reaches recipients. `DEFAULT_SCOPES` is `read` + `write` because API keys carry no scopes yet. Add
  `send`, delete or cancel tools only once keys can be scoped to them.
- **Tool names** are kebab-case verb-noun (`list-contacts`), and the catalogue test enforces it.
  `get-x` / `update-x` 404 hints point at `list-x`, which must exist at the parent path.
- **Errors are results, not throws.** `describeError` turns API errors into text that tells the agent
  what to do next. Keep new hints actionable.
- **HTTP mode is stateless**: a fresh `McpServer` per request, bound to that request's Bearer key.
  Never cache a client or key across requests.
- MCP SDK v2 (`@modelcontextprotocol/server` / `node`). `serveStdio` comes from the
  `@modelcontextprotocol/server/stdio` subpath.
- Pin dependency versions exactly, and pick releases at least 7 days old.
