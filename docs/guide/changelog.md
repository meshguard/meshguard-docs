---
title: "Changelog"
description: "MeshGuard release history and version notes"
---

# Changelog

## v1.1.0

_Released February 9, 2026_

### New Features

#### Agent Update API

You can now partially update agent properties via the Admin API.

```bash
PATCH /admin/agents/:agentId
```

- Update `name`, `trustTier`, `tags`, and `metadata` fields
- All fields are optional — send only what you want to change
- Changes are logged to the admin audit log

See [Admin API Reference](/api/admin#update-agent) for details.

#### Policy Test CLI

The `meshguard policy test` command has been significantly enhanced for better testing workflows:

- **Batch testing**: Test multiple scenarios from a YAML file
- **CI/CD integration**: JSON output with proper exit codes
- **Verbose mode**: Detailed evaluation traces for debugging
- **Policy targeting**: Test against specific policies

```bash
# Batch test from file
meshguard policy test --file tests.yaml --json

# Verbose single test
meshguard policy test --agent my-agent --action delete:* --verbose
```

See [CLI Reference](/guide/cli#test-policy) for full documentation.

### Improvements

- Admin audit now includes before/after values for agent updates
- Better error messages for policy evaluation failures

---

## v1.0.0

_Released January 25, 2026_

Initial public release of MeshGuard.

### Features

- **Agent Identity**: Create, manage, and revoke agent credentials
- **Policy Engine**: YAML-based policy definitions with trust tiers
- **Audit Logging**: Full request history with search and export
- **Analytics Dashboard**: Real-time metrics and visualizations
- **Alerting**: Webhook and email notifications for policy violations
- **Multi-org Support**: Isolated environments for teams
- **SDKs**: Python, JavaScript, and .NET client libraries
- **Integrations**: LangChain, CrewAI, OpenClaw, and more

### API

- Gateway API for agent authorization checks
- Admin API for management operations
- Analytics API for metrics and reporting
- Billing API for subscription management

### CLI

- Full command-line interface for all operations
- Support for scripting and automation

---

## Version Support

| Version | Status | Support Until |
|---------|--------|---------------|
| v1.1.x | Current | — |
| v1.0.x | Supported | August 2026 |
