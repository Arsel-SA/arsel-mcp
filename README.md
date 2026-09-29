# Arsel MCP Server

An [MCP](https://modelcontextprotocol.io) server for [Arsel](https://arsel.sa). It lets AI agents such as Claude Code, Cursor and Claude Desktop read your contacts, lists, campaigns, templates and message logs, and draft campaigns for you to review and send.

It is a thin client over the [Arsel API](https://docs.arsel.sa). Every tool is one API call made as you, on the organization you connect, so the agent sees exactly what you'd see through the API.

> **Preview.** The hosted server at `mcp.arsel.sa` and the `@arsel.sa/mcp` npm package are not live yet, so the setup steps below don't work today. Running from source needs Arsel API 1.0, which is coming in the next API release.

> **Drafts only.** This server cannot send or schedule messages. Campaigns it creates are saved as drafts, and you send them from the Arsel dashboard.

## Requirements

- An Arsel account that is an admin of the organization you want to connect.

## Setup

### Connect with your Arsel account (recommended)

Add the server by its URL. Your client opens a browser window: sign in to Arsel, pick the organization and click **Allow**.

**Claude (claude.ai and Claude Desktop):** Settings → Connectors → Add custom connector → `https://mcp.arsel.sa/mcp`.

**Claude Code:**

```bash
claude mcp add --transport http arsel https://mcp.arsel.sa/mcp
```

Then run `/mcp` and choose **Authenticate**.

**Cursor, VS Code and other clients:** add `https://mcp.arsel.sa/mcp` as a remote (HTTP) server.

The connection has full access to that organization. An admin can see and disconnect it in the dashboard under **Integration → Connected Apps**.

### Headless and local setup (API key)

Where nobody can sign in in a browser (CI, servers, scripts) or to run the server on your own machine, use an API key. Create one in the dashboard under **API keys**.

Node.js 22 or later is needed to run the server locally.

#### Claude Code

```bash
claude mcp add arsel -e ARSEL_API_KEY=be_xxxxxxxx -- npx -y @arsel.sa/mcp
```

#### Cursor

Add this to `~/.cursor/mcp.json`, or to `.cursor/mcp.json` in a project:

```json
{
  "mcpServers": {
    "arsel": {
      "command": "npx",
      "args": ["-y", "@arsel.sa/mcp"],
      "env": { "ARSEL_API_KEY": "be_xxxxxxxx" }
    }
  }
}
```

#### Claude Desktop

Open **Settings → Developer → Edit Config** and add the same `mcpServers` entry as for Cursor.

#### Remote (Streamable HTTP)

Clients that support remote servers can connect over HTTP and send the key as a Bearer token. They don't need Node.

```bash
claude mcp add --transport http arsel https://mcp.arsel.sa/mcp \
  --header "Authorization: Bearer be_xxxxxxxx"
```

```json
{
  "mcpServers": {
    "arsel": {
      "url": "https://mcp.arsel.sa/mcp",
      "headers": { "Authorization": "Bearer be_xxxxxxxx" }
    }
  }
}
```

## Tools

| Area | Tools |
| --- | --- |
| Contacts | `list-contacts` `get-contact` `create-contact` `update-contact` |
| Lists | `list-lists` `get-list` `create-list` `update-list` `add-contacts-to-list` `remove-contacts-from-list` |
| Tags | `list-tags` `get-tag` `create-tag` `update-tag` `add-tag-to-contacts` `remove-tag-from-contacts` |
| Data model | `list-contact-properties` `get-contact-property` `create-contact-property` `update-contact-property` `list-events` `get-event` `create-event` `update-event` |
| Email campaigns | `list-email-campaigns` `get-email-campaign` `create-email-campaign` `update-email-campaign` |
| SMS campaigns | `list-sms-campaigns` `get-sms-campaign` `create-sms-campaign` `update-sms-campaign` |
| Push campaigns | `list-push-campaigns` `get-push-campaign` `create-push-campaign` `update-push-campaign` |
| In-app campaigns | `list-in-app-campaigns` `get-in-app-campaign` `create-in-app-campaign` `update-in-app-campaign` `clone-in-app-campaign` |
| Templates | `list-templates` `get-template` `create-template` `update-template` `list-gallery-categories` `list-gallery-templates` `get-gallery-template` `copy-gallery-template` |
| Message logs | `list-emails` `get-email` `list-sms-messages` `get-sms-message` `list-whatsapp-messages` `get-whatsapp-message` `list-push-notifications` `get-push-notification` |
| Push devices | `list-contact-push-devices` `get-push-device-import` |

There are no delete, cancel or send tools. Read tools are marked read-only, so clients can run them without asking you each time. Create and update tools ask for your approval first.

## Security

- **One organization per connection.** The API scopes every call to the organization you connected or that owns the key, and the server holds no data of its own.
- **Rate limits** are the API's own limits for your organization. When one is hit, the agent is told how long to wait.
- **Remote mode keeps no sessions.** Each request is handled with the credential it carries and then forgotten.
- OAuth access tokens last 15 minutes and are tied to this server; disconnecting an app in the dashboard stops it on its next request.
- Treat your API key like a password. Give the agent a key you can revoke from the dashboard at any time.

## Running the server yourself

```bash
ARSEL_API_KEY=be_xxxxxxxx npx @arsel.sa/mcp        # stdio, for one user
npx @arsel.sa/mcp --http --port 8077               # HTTP; clients sign in with OAuth or send a key
```

| Option | Default | |
| --- | --- | --- |
| `--key` | `$ARSEL_API_KEY` | API key for stdio mode |
| `--http` | off | Serve Streamable HTTP at `/mcp` instead of stdio |
| `--port` | `$PORT` or `8077` | HTTP port |
| `--host` | `127.0.0.1` | Bind address. Use `0.0.0.0` behind a load balancer |
| `--allowed-hosts` | | Comma-separated `Host` names to accept, e.g. `mcp.example.com` |
| `--api-url` | `$ARSEL_API_URL` or `https://api.arsel.sa/v1` | Arsel API base URL |
| `--public-url` | `$ARSEL_MCP_PUBLIC_URL` or `https://mcp.arsel.sa` | Public URL of this server; the OAuth token audience |
| `--auth-server` | `$ARSEL_AUTH_SERVER` or `https://api.arsel.sa` | OAuth authorization server |

On `127.0.0.1` the server rejects foreign `Host` and `Origin` headers, which blocks DNS rebinding. When you bind to `0.0.0.0` behind a proxy, set `--allowed-hosts`. `GET /health` answers `200` for load-balancer checks. The repo includes a `Dockerfile` for this mode.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
npm run inspector      # try the tools in the MCP Inspector
```

`tests/contract.test.ts` checks every tool against `openapi/arsel-api.json`: the operation exists, and the tool's parameters, required fields and enums match the API. `npm run openapi:update` refreshes the snapshot from the live API, and the test then shows any drift.

## License

MIT
