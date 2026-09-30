# Changelog

All notable changes to `@arsel.sa/mcp`. Format follows [Keep a Changelog](https://keepachangelog.com/),
versioning follows [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-09-30

### Added

- stdio and stateless Streamable HTTP transports. In HTTP mode each request authenticates with a Bearer token: an OAuth access token from signing in with your Arsel account, or an API key.
- Sign in with your Arsel account: the hosted server supports OAuth 2.1, so clients connect by URL with no API key. API keys still work for headless and local use.
- `--public-url` and `--auth-server` options for HTTP mode.
- A Docker image for each release at `ghcr.io/arsel-sa/arsel-mcp` (linux/amd64 and linux/arm64).
- 33 read tools and 26 create/update tools covering contacts, lists, tags, the data model, email/SMS/push/in-app campaigns, templates, message logs and push devices.
- Error results that tell the agent how to recover: which input to fix, which list tool to call, or how long to wait.
- A contract test that holds every tool to the Arsel OpenAPI document.
