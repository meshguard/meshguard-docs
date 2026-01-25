# What is MeshGuard?

MeshGuard is a **governance control plane** for AI agent ecosystems. It provides identity management, policy enforcement, and audit logging for agent-to-agent interactions.

## The Problem

As AI evolves from copilots to autonomous agents to agent meshes, a critical governance gap emerges:

| Era | Model | Governance |
|-----|-------|------------|
| **2022-2023** | Copilots | Human-in-the-loop |
| **2024-2025** | Agents | Task-level permissions |
| **2026+** | Agent Mesh | ??? |

When Agent A delegates to Agent B:
- 🚫 No identity verification for agent-to-agent calls
- 🚫 Zero policy enforcement at delegation boundaries
- 🚫 Incomplete audit trails across agent chains
- 🚫 Compliance risk exposure for regulated industries

## The Solution

MeshGuard sits between agents as a governance layer:

```
┌─────────────────────────────────────────────┐
│            MeshGuard Gateway                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐  │
│  │  Auth  │→│ Policy │→│ Audit  │→│ Proxy│  │
│  └────────┘ └────────┘ └────────┘ └──────┘  │
└─────────────────────────────────────────────┘
         ↑                              ↓
    Agent Request                 Target Service
```

### Core Components

**1. Agent Identity**
- JWT-based credentials for every agent
- Trust tiers: `untrusted` → `verified` → `trusted` → `privileged`
- Cryptographic verification at every request

**2. Policy Engine**
- YAML-based rule definitions
- Wildcard action matching (`read:*`, `write:email`)
- Delegation controls and permission ceilings

**3. Audit Trail**
- Every request logged with full context
- Trace IDs for cross-agent correlation
- Queryable via API or CLI

**4. Real-time Alerting**
- Webhook, Slack, and email notifications
- Trigger on denials, errors, or rate limits

## How It's Different

| Solution | Built For | Limitation |
|----------|-----------|------------|
| Traditional IAM | Human users | Session-based, no delegation chains |
| API Gateways | Sync requests | No context propagation |
| AI Governance | Model bias | No identity or policy enforcement |
| **MeshGuard** | **Agent ecosystems** | Native identity, policy & audit |

## Use Cases

- **Enterprise AI Teams** — Govern internal agent deployments
- **AI-Native Products** — Add governance to your agent platform
- **Regulated Industries** — HIPAA, SOC 2, GDPR compliance for AI
- **Multi-Agent Systems** — Control agent-to-agent delegation

## Next Steps

- [Getting Started](/guide/getting-started) — Install and run MeshGuard
- [Quick Start](/guide/quickstart) — 2-minute setup
- [Python SDK](/integrations/python) — Integrate with your agents
