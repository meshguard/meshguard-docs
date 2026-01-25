# Getting Started with MeshGuard

This guide walks you through setting up and running MeshGuard from scratch.

## Prerequisites

- **Bun** v1.1+ (JavaScript runtime)
- **Git** (to clone the repo)
- macOS, Linux, or WSL on Windows

### Install Bun

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version
```

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/dbhurley/meshguard.git
cd meshguard
```

### 2. Install Dependencies

```bash
bun install
```

This installs all required packages (~12 dependencies).

### 3. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Gateway Configuration
PORT=3100                    # Port to run on
HOST=0.0.0.0                 # Listen address
MODE=enforce                 # enforce | audit | bypass

# Security (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=your-secret-key-min-32-chars
ADMIN_TOKEN=your-admin-token

# Policy Directory
POLICIES_DIR=./policies

# Audit Database
AUDIT_DB_PATH=./data/audit.db

# Proxy Target (where allowed requests go)
PROXY_TARGET=https://httpbin.org
```

### 4. Create Data Directory

```bash
mkdir -p data
```

## Running MeshGuard

### Start the Gateway

```bash
# Using bun directly
bun run src/index.ts

# Or using the CLI
bun run src/cli/index.ts serve
```

You should see:

```
╔═══════════════════════════════════════════╗
║          MeshGuard Gateway v0.1           ║
╠═══════════════════════════════════════════╣
║  Mode:   enforce                          ║
║  Port:   3100                             ║
║  Target: https://httpbin.org              ║
╚═══════════════════════════════════════════╝

Gateway listening on http://0.0.0.0:3100
```

### Verify It's Running

```bash
curl http://localhost:3100/health
```

Expected response:
```json
{"status":"healthy","timestamp":"...","version":"0.1.0","mode":"enforce"}
```

## Your First Agent

### 1. Create an Agent

```bash
# Using the CLI
bun run src/cli/index.ts agent create my-first-agent --trust verified

# Or via Admin API
curl -X POST http://localhost:3100/admin/agents \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: your-admin-token" \
  -d '{"name": "my-first-agent", "trust_tier": "verified"}'
```

**Save the token!** You'll need it for authentication.

Example output:
```
✓ Agent created

Agent ID: agent_abc123xyz
Name: my-first-agent
Trust: verified

Token:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Save this token - it cannot be retrieved later.
```

### 2. Test the Agent

Make a request through the gateway:

```bash
# Set your token
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Make a proxied request (should succeed)
curl http://localhost:3100/proxy/get \
  -H "Authorization: Bearer $TOKEN"

# Try a blocked action (should fail with 403)
curl -X DELETE http://localhost:3100/proxy/anything \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Check the Audit Log

```bash
bun run src/cli/index.ts audit tail -n 10
```

## Understanding Policies

Policies control what agents can do. They're YAML files in the `policies/` directory.

### Default Policy Structure

```yaml
name: my-policy
version: "1.0"
description: What this policy does

# Who this policy applies to
appliesTo:
  trustTiers:          # Trust levels
    - verified
    - trusted
  tags:                # Agent tags
    - myapp
  agentIds:            # Specific agents
    - agent_abc123
  orgIds:              # Organizations
    - org_xyz

# Rules (evaluated in order, first match wins)
rules:
  - effect: allow      # or 'deny'
    actions:
      - "read:*"       # Wildcards supported
      - "write:contacts"

  - effect: deny
    actions:
      - "delete:*"
      - "execute:*"

# Default if no rules match
defaultEffect: deny

# Optional: Delegation controls
delegation:
  maxDepth: 2
  permissionCeiling:
    - "read:*"
```

### Action Format

Actions follow the pattern: `verb:resource`

- `read:contacts` — Read contacts
- `write:calendar` — Write to calendar
- `delete:*` — Delete anything
- `*:contacts` — Any action on contacts
- `*` — Everything

### Reload Policies

After editing policy files:

```bash
bun run src/cli/index.ts policy reload
```

## Gateway Modes

| Mode | Behavior |
|------|----------|
| `enforce` | Block denied requests (production) |
| `audit` | Allow all, but log what would be denied |
| `bypass` | Allow all, minimal logging (development) |

Change mode in `.env` or via CLI:

```bash
bun run src/cli/index.ts serve --mode audit
```

## Running with Docker

### Build and Run

```bash
cd docker
docker compose up --build
```

### With Custom Config

```bash
JWT_SECRET=production-secret \
ADMIN_TOKEN=production-admin \
docker compose up
```

## CLI Reference

### Agent Commands

```bash
# Create agent
meshguard agent create <name> [--trust <tier>] [--org <org>] [--tags <tags>]

# List agents
meshguard agent list [--trust <tier>] [--org <org>] [--revoked]

# Show agent details
meshguard agent show <id>

# Revoke agent
meshguard agent revoke <id>

# Generate new token
meshguard agent token <id>
```

### Policy Commands

```bash
# List policies
meshguard policy list

# Show policy details
meshguard policy show <name>

# Validate policy file
meshguard policy validate <file.yaml>

# Apply/load policy
meshguard policy apply <file.yaml>

# Test if agent can do action
meshguard policy test <agent_id> <action>

# Show allowed actions for agent
meshguard policy allowed <agent_id>
```

### Audit Commands

```bash
# Tail recent entries
meshguard audit tail [-n <lines>] [--agent <id>] [--follow]

# Query with filters
meshguard audit query [--from <date>] [--to <date>] [--decision <allow|deny>]

# Follow a trace
meshguard audit trace <trace_id>

# Show statistics
meshguard audit stats [--period <hours>]

# Export data
meshguard audit export [--format json|csv]
```

## Admin API Reference

All admin endpoints require the `X-Admin-Token` header.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/agents` | GET | List agents |
| `/admin/agents` | POST | Create agent |
| `/admin/agents/:id` | GET | Get agent |
| `/admin/agents/:id` | DELETE | Revoke agent |
| `/admin/policies` | GET | List policies |
| `/admin/policies/:name` | GET | Get policy |
| `/admin/audit` | GET | Query audit log |
| `/admin/audit/stats` | GET | Get statistics |
| `/admin/info` | GET | Gateway info |

## Troubleshooting

### "Port already in use"

```bash
# Find what's using the port
lsof -i :3100

# Use a different port
PORT=3200 bun run src/index.ts
```

### "Token expired"

Generate a new token:

```bash
bun run src/cli/index.ts agent token <agent_id>
```

### "Policy not found"

Check that your policy file:
1. Is in the `policies/` directory
2. Has `.yaml` or `.yml` extension
3. Has valid YAML syntax
4. Includes required fields (`name`, `appliesTo`, `rules`)

Validate it:
```bash
bun run src/cli/index.ts policy validate ./policies/my-policy.yaml
```

### "Agent revoked"

An agent was revoked. Create a new one or check your agent ID.

## Next Steps

1. **Create custom policies** for your use case
2. **Integrate with your agents** using the JWT tokens
3. **Monitor the audit log** for security insights
4. **Deploy with Docker** for production

## Support

- **Documentation:** https://meshguard.app/docs
- **Contact:** david@meshguard.app

---

*MeshGuard © 2026*
