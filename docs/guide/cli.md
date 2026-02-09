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

<Badge type="tip" text="Enhanced in v1.1.0" />

Test how policies evaluate for agents and actions. Supports interactive testing, batch testing from files, and CI/CD integration.

```bash
meshguard policy test [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--agent <id>` | Agent ID or name to test |
| `--action <action>` | Action to test (e.g., `read:contacts`) |
| `--context <json>` | JSON context for the request |
| `--file <path>` | YAML file with test cases for batch testing |
| `--policy <name>` | Test against specific policy (skips other policies) |
| `--json` | Output results as JSON (for CI/CD) |
| `--verbose` | Show detailed evaluation trace |

#### Interactive Testing

```bash
# Basic test
meshguard policy test --agent agent_abc123 --action read:contacts

# Test with context
meshguard policy test --agent agent_abc123 --action execute:command \
  --context '{"command": "rm -rf /"}'

# Test against specific policy
meshguard policy test --agent agent_abc123 --action write:email \
  --policy email-restrictions
```

Output:
```
Decision: DENY
Policy:   production-policy
Rule:     block-destructive-commands
Reason:   Destructive commands are not allowed
```

#### Batch Testing from YAML

Create a test file (`tests.yaml`):
```yaml
tests:
  - name: "Allow reading contacts"
    agent: agent_abc123
    action: read:contacts
    expect: allow

  - name: "Block destructive commands"
    agent: agent_abc123
    action: execute:command
    context:
      command: "rm -rf /"
    expect: deny

  - name: "Allow trusted agent to send email"
    agent: agent_trusted
    action: write:email
    context:
      recipient: "user@company.com"
    expect: allow
```

Run batch tests:
```bash
meshguard policy test --file tests.yaml
```

Output:
```
Running 3 tests...

✓ Allow reading contacts                    PASS (allowed)
✓ Block destructive commands                PASS (denied)
✗ Allow trusted agent to send email         FAIL (expected: allow, got: deny)

Results: 2 passed, 1 failed
```

#### CI/CD Integration

Use `--json` output for automated pipelines:

```bash
meshguard policy test --file tests.yaml --json
```

```json
{
  "summary": {
    "total": 3,
    "passed": 2,
    "failed": 1
  },
  "results": [
    {
      "name": "Allow reading contacts",
      "passed": true,
      "decision": "allow",
      "expected": "allow"
    },
    {
      "name": "Block destructive commands", 
      "passed": true,
      "decision": "deny",
      "expected": "deny"
    },
    {
      "name": "Allow trusted agent to send email",
      "passed": false,
      "decision": "deny",
      "expected": "allow",
      "policy": "email-policy",
      "reason": "External emails require privileged tier"
    }
  ]
}
```

**Exit Codes for CI/CD:**
| Code | Meaning |
|------|---------|
| `0` | All tests passed (or single test allowed) |
| `1` | One or more tests failed (or single test denied) |
| `2` | Error (invalid file, bad syntax, etc.) |

**GitHub Actions Example:**
```yaml
- name: Test MeshGuard Policies
  run: meshguard policy test --file policy-tests.yaml --json
  env:
    MESHGUARD_API_KEY: ${{ secrets.MESHGUARD_API_KEY }}
```

#### Verbose Output

Use `--verbose` for detailed evaluation trace:

```bash
meshguard policy test --agent agent_abc123 --action delete:records --verbose
```

```
Evaluating: agent_abc123 → delete:records
Agent Trust Tier: verified
Matching Policies: production-policy, data-retention

Policy: production-policy
  Rule 1: allow read:* → SKIP (action mismatch)
  Rule 2: deny delete:* → MATCH
    Effect: deny
    Reason: Deletion not allowed in production

Final Decision: DENY
Matched Policy: production-policy
Matched Rule: Rule 2
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
