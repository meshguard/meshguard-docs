---
title: "CLI Reference"
description: "MeshGuard command-line interface reference"
---

# CLI Reference

The MeshGuard CLI provides commands for managing agents, policies, and audit logs from the command line.

## Installation

### macOS (Homebrew)

```bash
brew tap meshguard/tap
brew install meshguard
```

### npm

```bash
npm install -g meshguard-cli
```

### Direct Download

Download binaries from [GitHub Releases](https://github.com/meshguard/meshguard-cli/releases).

## Configuration

Set your API key:

```bash
# Environment variable (recommended)
export MESHGUARD_API_KEY=msk_xxx

# Or use the config command
meshguard config set api-key msk_xxx
```

Set gateway URL (optional, defaults to cloud):

```bash
export MESHGUARD_GATEWAY_URL=https://dashboard.meshguard.app

# Or for self-hosted
meshguard config set gateway-url https://meshguard.yourcompany.com
```

## Agent Commands

### List Agents

```bash
meshguard agent list
```

Output:
```
ID              NAME                TRUST       STATUS    CREATED
agent_abc123    customer-support    verified    active    2026-01-15
agent_def456    data-pipeline       trusted     active    2026-01-20
agent_ghi789    research-bot        basic       revoked   2026-01-10
```

Options:
- `--trust <tier>` — Filter by trust tier
- `--status <status>` — Filter by status (active/revoked)
- `--json` — Output as JSON

### Create Agent

```bash
meshguard agent create <name> [options]
```

Examples:
```bash
# Basic agent
meshguard agent create my-agent

# With trust tier and tags
meshguard agent create prod-agent --trust verified --tags production,api-access

# Output token to file
meshguard agent create my-agent --output token.txt
```

Options:
- `--trust <tier>` — Trust tier: `anonymous`, `basic`, `verified`, `trusted`, `privileged`
- `--tags <tags>` — Comma-separated tags
- `--output <file>` — Write token to file
- `--json` — Output as JSON

### Show Agent Details

```bash
meshguard agent show <agent-id>
```

### Revoke Agent

```bash
meshguard agent revoke <agent-id>
```

### Generate New Token

```bash
meshguard agent token <agent-id>
```

## Policy Commands

### List Policies

```bash
meshguard policy list
```

Options:
- `--json` — Output as JSON

### Show Policy

```bash
meshguard policy show <policy-name>
```

### Apply Policy

```bash
meshguard policy apply <file.yaml>
```

Apply all policies from a directory:
```bash
meshguard policy apply ./policies/
```

### Validate Policy

Check policy syntax without applying:

```bash
meshguard policy validate <file.yaml>
```

### Test Policy

Test how a policy evaluates for a specific agent and action:

```bash
meshguard policy test <agent-id> <action> [options]
```

Examples:
```bash
# Test read action
meshguard policy test agent_abc123 read:contacts

# Test with resource
meshguard policy test agent_abc123 write:email --resource "user@external.com"

# Test with context
meshguard policy test agent_abc123 execute:command \
  --context '{"command": "rm -rf /"}'
```

Output:
```
Decision: DENY
Policy:   production-policy
Rule:     block-destructive-commands
Reason:   Destructive commands are not allowed
```

### Delete Policy

```bash
meshguard policy delete <policy-name>
```

## Audit Commands

### Tail Audit Log

Stream recent audit entries:

```bash
meshguard audit tail
```

Options:
- `-n <count>` — Number of entries (default: 20)
- `-f, --follow` — Follow mode (stream new entries)

### Query Audit Log

Search audit entries with filters:

```bash
meshguard audit query [options]
```

Options:
- `--agent <name>` — Filter by agent name or ID
- `--action <action>` — Filter by action
- `--decision <allow|deny>` — Filter by decision
- `--from <date>` — Start date (ISO 8601)
- `--to <date>` — End date (ISO 8601)
- `--limit <n>` — Max results (default: 100)
- `--json` — Output as JSON

Examples:
```bash
# Recent denials
meshguard audit query --decision deny --limit 20

# Agent activity this week
meshguard audit query --agent prod-agent --from 2026-01-27

# Email actions today
meshguard audit query --action "write:email" --from 2026-02-01
```

### Trace Request

Follow a complete request trace:

```bash
meshguard audit trace <trace-id>
```

### Audit Statistics

```bash
meshguard audit stats [options]
```

Options:
- `--period <hours>` — Time period in hours (default: 24)

### Export Audit Log

Export for compliance/reporting:

```bash
meshguard audit export [options]
```

Options:
- `--from <date>` — Start date (required)
- `--to <date>` — End date (defaults to now)
- `--format <csv|json|parquet>` — Output format (default: csv)
- `--output <file>` — Output file (defaults to stdout)

Example:
```bash
meshguard audit export --from 2026-01-01 --to 2026-01-31 \
  --format csv --output january-audit.csv
```

## Config Commands

### View Configuration

```bash
meshguard config list
```

### Set Configuration

```bash
meshguard config set <key> <value>
```

Available keys:
- `api-key` — MeshGuard API key
- `gateway-url` — Gateway URL
- `output-format` — Default output format (text/json)

### Get Configuration Value

```bash
meshguard config get <key>
```

## Global Options

These options work with all commands:

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--quiet` | Suppress non-essential output |
| `--verbose` | Show detailed output |
| `--gateway <url>` | Override gateway URL |
| `--api-key <key>` | Override API key |
| `--help` | Show help |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Authentication error |
| 4 | Policy denied |
| 5 | Network error |

## Examples

### Complete Workflow

```bash
# 1. Create an agent
meshguard agent create prod-bot --trust verified --tags production

# 2. Create a policy file
cat > policy.yaml << 'EOF'
name: prod-bot-policy
version: "1.0"
appliesTo:
  tags:
    - production
rules:
  - effect: allow
    actions:
      - "read:*"
  - effect: deny
    actions:
      - "delete:*"
    reason: "Deletion not allowed in production"
defaultEffect: deny
EOF

# 3. Apply the policy
meshguard policy apply policy.yaml

# 4. Test it
meshguard policy test <agent-id> delete:records
# Output: Decision: DENY

# 5. Monitor activity
meshguard audit tail -f
```

## Related

- [Getting Started](/guide/getting-started) — Full setup guide
- [Policies](/guide/policies) — Policy format and syntax
- [Audit Logging](/guide/audit) — Audit configuration
- [API Reference](/api/overview) — REST API documentation
