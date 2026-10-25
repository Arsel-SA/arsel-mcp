# Changelog

All notable changes to `@arsel.sa/mcp`. Format follows [Keep a Changelog](https://keepachangelog.com/),
versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.1.0] - 2026-10-21

### Added

- `create-automation`, `update-automation` and `clone-automation`: build an automation as a draft, from a trigger and steps that send email, SMS, WhatsApp, push or in-app messages, wait, branch on a condition, wait for an event, tag, list or update the contact. The automation comes back with the `issues` left before it can be enabled; you enable it from the dashboard.
- `list-automations`, `get-automation`, `list-automation-runs` and `get-automation-run`: read automations, and each contact's run through one, step by step, with the reason a message was skipped.

### Changed

- `message_engagement` rules point the agent at `list-automations` for automation ids, and at a step `key` for `automation_step`.

## [1.0.0] - 2026-10-12

The first stable release. Tool names and inputs now follow semantic versioning.

### Added

- `create-segment` and `update-segment`: build a segment from the same rules as the dashboard's segment builder (contact fields and custom properties, lists and tags, channel status, engagement counts and dates, engagement with one campaign or automation, and events with conditions on their data), in `and` / `or` groups that nest.
- `get-segment` and `list-segments` return a segment's rules and whether its members are still being computed, and `list-contacts` takes `segment_id` to list a segment's members.
- `get-email-campaign-stats`, `get-sms-campaign-stats`, `get-push-campaign-stats` and `get-in-app-campaign-stats`: a campaign's delivery, engagement and attributed conversions.
- `get-email-domain`, `create-email-domain` and `verify-email-domain`: register a sending domain, read the DNS records to publish and check them.
- `list-whatsapp-templates`, `get-whatsapp-template`, `create-whatsapp-template` and `update-whatsapp-template`: write a WhatsApp template, submit it to Meta and follow its review.

### Changed

- A record that is not found below another one, such as a campaign's stats, now points the agent at the list tool for that record.
- `npm run openapi:update` keeps the snapshot's key order, so its diff shows only what changed in the API.

## [0.2.0] - 2026-10-05

### Added

- `list-segments` and `get-segment`: find the segments a campaign can target. Segment rules stay in the dashboard.
- `list-email-domains` and `list-sms-senders`: find a verified sending domain or an approved SMS sender for a campaign's `from`.
- `get-usage`: this month's usage against the plan's limits.

### Changed

- Campaign tools point the agent at these tools for senders and segments instead of asking the user.

## [0.1.0] - 2026-09-30

### Added

- stdio and stateless Streamable HTTP transports. In HTTP mode each request authenticates with a Bearer token: an OAuth access token from signing in with your Arsel account, or an API key.
- Sign in with your Arsel account: the hosted server supports OAuth 2.1, so clients connect by URL with no API key. API keys still work for headless and local use.
- `--public-url` and `--auth-server` options for HTTP mode.
- 33 read tools and 26 create/update tools covering contacts, lists, tags, the data model, email/SMS/push/in-app campaigns, templates, message logs and push devices.
- Error results that tell the agent how to recover: which input to fix, which list tool to call, or how long to wait.
- A contract test that holds every tool to the Arsel OpenAPI document.
