---
layout: home

hero:
  name: MeshGuard
  text: Governance Control Plane for AI Agents
  tagline: Identity, policy, and audit infrastructure for enterprise AI agent ecosystems.
  image:
    src: /logo.png
    alt: MeshGuard
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/dbhurley/meshguard

features:
  - icon: 🔐
    title: Agent Identity
    details: Issue verifiable JWT credentials to agents with trust tiers. Know exactly who is making every request.
  - icon: 📋
    title: Policy Engine
    details: Define YAML-based rules for what agents can and cannot do. Enforce at delegation boundaries.
  - icon: 📊
    title: Audit Trail
    details: Capture complete execution traces with context propagation. Query and analyze agent behavior.
  - icon: ⚡
    title: Real-time Enforcement
    details: Sub-millisecond policy decisions. No performance penalty for governance.
  - icon: 🔗
    title: Easy Integration
    details: Python SDK with LangChain, CrewAI, and AutoGPT support. Or use the HTTP API directly.
  - icon: 🚨
    title: Alerting
    details: Get notified via webhook, Slack, or email when policies are violated.
---

## Quick Install

```bash
pip install meshguard
```

```python
from meshguard import MeshGuardClient

client = MeshGuardClient(
    gateway_url="https://dashboard.meshguard.app",
    agent_token="your-token"
)

# Check if an action is allowed
decision = client.check("read:contacts")
if decision.allowed:
    # Proceed with the action
    pass
```

## Why MeshGuard?

When Agent A delegates to Agent B, traditional identity controls break down:

- ❌ No identity verification for agent-to-agent calls
- ❌ Zero policy enforcement at delegation boundaries
- ❌ Incomplete audit trails across agent chains
- ❌ Compliance risk for regulated industries

MeshGuard fixes this by sitting between agents as a governance control plane.
