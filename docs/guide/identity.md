# Agent Identity

MeshGuard provides cryptographic identity for every agent.

## Trust Tiers

Agents are assigned a trust tier that determines their base capabilities:

| Tier | Description | Typical Use |
|------|-------------|-------------|
| `untrusted` | New/unknown agents | Testing, sandboxed |
| `verified` | Identity confirmed | Standard agents |
| `trusted` | Established agents | Production workloads |
| `privileged` | Full access | Admin agents |

## Creating Agents

### Via CLI

```bash
meshguard agent create my-agent \
  --trust verified \
  --tags production,sales
```

### Via API

```bash
curl -X POST https://dashboard.meshguard.app/admin/agents \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-agent", "trustTier": "verified", "tags": ["production"]}'
```

### Via Python SDK

```python
from meshguard import MeshGuardClient

client = MeshGuardClient(admin_token="...")
result = client.create_agent("my-agent", trust_tier="verified")
print(f"Token: {result['token']}")
```

## Token Structure

Agent tokens are JWTs containing:

```json
{
  "sub": "agent_abc123",
  "name": "my-agent",
  "tier": "verified",
  "tags": ["production", "sales"],
  "iat": 1706000000,
  "exp": 1706086400,
  "iss": "meshguard"
}
```

## Revoking Agents

Revoked agents can no longer authenticate:

```bash
meshguard agent revoke agent_abc123
```

Revocation is immediate and permanent.
