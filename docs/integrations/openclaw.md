---
title: "OpenClaw Integration"
description: "Integrate MeshGuard governance with OpenClaw AI agents using the official extension"
---

# OpenClaw Integration

Integrate MeshGuard's governance control plane with [OpenClaw](https://openclaw.ai) agents using the official `meshguard-openclaw` extension. Enforce policies on every tool invocation with zero code changes.

::: tip OpenClaw = Clawdbot
OpenClaw is the open-source rebrand of Clawdbot. Existing Clawdbot users can continue using the [Clawdbot integration guide](/integrations/clawdbot) — the SDK-based approach works for both.
:::

## Installation

Install the official MeshGuard extension for OpenClaw:

```bash
# npm
npm install meshguard-openclaw

# pnpm
pnpm add meshguard-openclaw

# Or via OpenClaw CLI
openclaw plugins install meshguard-openclaw
```

## Quick Start

### 1. Get MeshGuard Credentials

Sign up at [meshguard.app](https://meshguard.app) and create an agent to get:
- **API Key** (`msk_xxx`)
- **Agent ID** (`agent_xxx`)

### 2. Configure OpenClaw

Add to your `openclaw.json`:

```json
{
  "plugins": ["meshguard-openclaw"],
  "meshguard": {
    "apiKey": "${MESHGUARD_API_KEY}",
    "agentId": "agent_xxx",
    "mode": "enforce"
  }
}
```

Or use environment variables:

```bash
export MESHGUARD_API_KEY=msk_xxx
export MESHGUARD_AGENT_ID=agent_xxx
```

### 3. Define Policies

Create policies in the MeshGuard dashboard or via YAML:

```yaml
name: openclaw-agent-policy
version: "1.0"
appliesTo:
  agentIds:
    - agent_xxx
rules:
  - effect: allow
    actions:
      - "tool:read"
      - "tool:web_search"
      - "tool:web_fetch"
    description: Allow read operations
    
  - effect: deny
    actions:
      - "tool:exec"
    conditions:
      command_pattern: "rm -rf /*"
    description: Block destructive commands
    alert: critical
    
  - effect: allow
    actions:
      - "tool:*"
    description: Allow all other tools
```

### 4. Run Your Agent

That's it! MeshGuard now:
- Evaluates policies before each tool call
- Blocks actions that violate policies (in enforce mode)
- Logs all actions to the audit trail
- Sends alerts for policy violations

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable governance |
| `apiKey` | string | required | MeshGuard API key |
| `agentId` | string | required | MeshGuard agent ID |
| `gatewayUrl` | string | `https://dashboard.meshguard.app` | MeshGuard gateway URL |
| `mode` | string | `"enforce"` | `enforce`, `audit`, or `bypass` |
| `auditLevel` | string | `"standard"` | `minimal`, `standard`, or `verbose` |
| `cacheTimeoutMs` | number | `60000` | Policy cache duration (ms) |
| `failOpen` | boolean | `false` | Allow actions if MeshGuard is unreachable |

## Governance Modes

| Mode | Behavior |
|------|----------|
| **enforce** | Block policy violations, log all actions |
| **audit** | Log all actions, but don't block violations (shadow mode) |
| **bypass** | Disable governance entirely |

::: warning Production Recommendation
Always start with `audit` mode to validate your policies before switching to `enforce`.
:::

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                      OpenClaw Agent                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Tool Invocation                       ││
│  └────────────────────────┬────────────────────────────────┘│
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              before_tool_call hook                       ││
│  │         ┌─────────────────────────────┐                 ││
│  │         │   MeshGuard Extension       │                 ││
│  │         │   - Evaluate policy         │                 ││
│  │         │   - Check cache             │                 ││
│  │         │   - Block if denied         │                 ││
│  │         └─────────────────────────────┘                 ││
│  └────────────────────────┬────────────────────────────────┘│
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │               Tool Execution (if allowed)               ││
│  └────────────────────────┬────────────────────────────────┘│
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │               after_tool_call hook                       ││
│  │         ┌─────────────────────────────┐                 ││
│  │         │   MeshGuard Extension       │                 ││
│  │         │   - Log to audit trail      │                 ││
│  │         │   - Record duration         │                 ││
│  │         │   - Capture result/error    │                 ││
│  │         └─────────────────────────────┘                 ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    MeshGuard Cloud                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Policy    │  │   Audit     │  │  Dashboard  │         │
│  │   Engine    │  │   Store     │  │     UI      │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Tool Action Mapping

OpenClaw tools are mapped to MeshGuard actions:

| OpenClaw Tool | MeshGuard Action |
|---------------|------------------|
| `exec` | `tool:exec` |
| `read` / `write` | `tool:read`, `tool:write` |
| `web_search` | `tool:web_search` |
| `web_fetch` | `tool:web_fetch` |
| `browser` | `tool:browser` |
| `message` | `tool:message` |
| Custom tools | `tool:<name>` |

## Policy Examples

### Restrict Shell Commands

```yaml
name: shell-governance
rules:
  - effect: deny
    actions: ["tool:exec"]
    conditions:
      command_pattern: "rm -rf *"
    reason: "Destructive commands blocked"
    alert: critical
    
  - effect: deny
    actions: ["tool:exec"]  
    conditions:
      command_contains:
        - "sudo"
        - "chmod 777"
    reason: "Privileged commands require approval"
```

### Limit External Communication

```yaml
name: comms-governance
rules:
  - effect: allow
    actions: ["tool:message"]
    conditions:
      channel:
        in: ["slack", "telegram"]
    
  - effect: deny
    actions: ["tool:message"]
    reason: "Messaging to other channels requires approval"
```

### Restrict File Access

```yaml
name: file-governance
rules:
  - effect: allow
    actions: ["tool:read"]
    conditions:
      path_pattern: "/workspace/*"
      
  - effect: deny
    actions: ["tool:write"]
    conditions:
      path_pattern: "/etc/*"
    reason: "System file modification blocked"
```

## Audit Trail

Every tool invocation is logged to MeshGuard's audit trail:

```bash
# View recent audit entries
meshguard audit tail -n 20

# Filter by agent
meshguard audit query --agent my-openclaw-agent

# Export for compliance
meshguard audit export --from 2026-01-01 --format csv
```

### Audit Entry Structure

```json
{
  "timestamp": "2026-02-05T12:30:00Z",
  "agentId": "agent_xxx",
  "agentName": "my-openclaw-agent",
  "action": "tool:exec",
  "resource": "ls -la /workspace",
  "decision": "allow",
  "durationMs": 142,
  "traceId": "trace_abc123",
  "metadata": {
    "tool": "exec",
    "exitCode": 0
  }
}
```

## Alerting

Configure alerts for policy violations:

```json
{
  "meshguard": {
    "alerting": {
      "webhook": {
        "url": "https://your-server.com/alerts",
        "events": ["deny", "anomaly"]
      },
      "email": {
        "to": ["security@yourcompany.com"],
        "events": ["critical"]
      }
    }
  }
}
```

## Security Considerations

- **Sensitive data redaction**: Passwords, tokens, and API keys are automatically redacted from audit logs
- **Local caching**: Policies are cached locally to minimize latency
- **Fail-safe defaults**: Actions are blocked if MeshGuard is unreachable (`failOpen: false`)

## Troubleshooting

### Extension Not Loading

```bash
# Verify installation
npm list meshguard-openclaw

# Check OpenClaw recognizes it
openclaw plugins list
```

### Policy Denials

```bash
# Test policy evaluation
meshguard policy test <agent-id> tool:exec --resource "ls -la"

# Check audit log for details
meshguard audit query --agent <name> --decision deny
```

### Connection Issues

```bash
# Test gateway connectivity
curl https://dashboard.meshguard.app/health

# Verify API key
meshguard agent list
```

## Related

- [Clawdbot Integration](/integrations/clawdbot) — SDK-based integration (works for OpenClaw too)
- [Policies](/guide/policies) — Policy format and syntax
- [Audit Logging](/guide/audit) — Audit log configuration
- [Alerting](/guide/alerting) — Alert rules and notifications
- [API Reference](/api/overview) — Full API documentation
