# Authentication

MeshGuard uses different authentication methods depending on what you're doing:

| Use Case | Auth Method | Headers |
|----------|-------------|---------|
| Agent governance (proxy) | Agent JWT | `Authorization: Bearer <agent-token>` |
| Dashboard (web UI) | Magic link JWT | `Authorization: Bearer <jwt>` |
| Admin API (CLI/SDK) | API Key + Admin Token | `X-MeshGuard-API-Key` + `X-Admin-Token` |

## Credentials Overview

When you sign up for MeshGuard, you receive:

| Credential | Format | Purpose |
|------------|--------|---------|
| **API Key** | `msk_xxx...` | Identifies your organization |
| **Admin Token** | `msat_xxx...` | Authenticates admin operations |
| **Agent Tokens** | JWT | Per-agent auth for governed requests |

::: warning Save Your Credentials
Your API Key and Admin Token are shown **only once** at signup (and in your welcome email). 
Store them securely. You can regenerate them via the Settings page, but the old ones will stop working.
:::

## Agent Tokens (for Governed Requests)

Agent tokens are JWTs issued to registered agents. Use them for requests through the governance proxy (`/proxy/*`).

```bash
# Agent making a governed request
curl https://dashboard.meshguard.app/proxy/your-endpoint \
  -H "Authorization: Bearer <agent-jwt>"
```

Token payload:
```json
{
  "sub": "agent_abc123",
  "name": "my-agent",
  "tier": "verified",
  "tags": ["production"],
  "orgId": "org_xyz",
  "iat": 1706000000,
  "exp": 1706086400,
  "iss": "meshguard"
}
```

## Admin API Authentication

For management operations (agents, policies, audit logs), use **both** headers:

```bash
# List agents in your org
curl https://dashboard.meshguard.app/admin/agents \
  -H "X-MeshGuard-API-Key: msk_xxx" \
  -H "X-Admin-Token: msat_xxx"

# Create an agent
curl -X POST https://dashboard.meshguard.app/admin/agents \
  -H "X-MeshGuard-API-Key: msk_xxx" \
  -H "X-Admin-Token: msat_xxx" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-agent", "trustTier": "verified"}'
```

### Why Two Headers?

- **`X-MeshGuard-API-Key`** — Identifies which organization you're accessing
- **`X-Admin-Token`** — Proves you're authorized to manage that organization

This separation enables:
- Multiple orgs with one admin token (future)
- Read-only API keys (future)
- Granular access control

### Versioned API Paths

You can also use versioned endpoints:

```bash
# Both work identically
curl https://dashboard.meshguard.app/admin/agents ...
curl https://dashboard.meshguard.app/api/v1/admin/agents ...
```

## Dashboard Authentication (Web UI)

The dashboard uses magic link email authentication:

1. Enter your email on the login page
2. Receive a 6-digit code via email
3. Enter the code to get a JWT session

The JWT is stored in your browser and sent automatically.

## Trust Tiers

Agents are assigned trust tiers that policies can reference:

| Tier | Description | Use Case |
|------|-------------|----------|
| `unverified` | New agent, no trust established | Testing, sandboxed |
| `verified` | Identity confirmed | Standard operations |
| `trusted` | Established track record | Elevated permissions |
| `privileged` | Maximum trust | Admin operations |

## CLI Configuration

Configure your credentials in `~/.meshguard/config`:

```bash
# ~/.meshguard/config
MESHGUARD_URL="https://dashboard.meshguard.app"
MESHGUARD_API_KEY="msk_xxx"
MESHGUARD_ADMIN_TOKEN="msat_xxx"
```

Then use the CLI:

```bash
meshguard status
meshguard agents list
meshguard policies list
```

## SDK Configuration

### Python

```python
from meshguard import MeshGuard

guard = MeshGuard(
    api_key="msk_xxx",
    admin_token="msat_xxx",  # Only for admin operations
)
```

### JavaScript

```typescript
import { MeshGuard } from 'meshguard';

const guard = new MeshGuard({
  apiKey: 'msk_xxx',
  adminToken: 'msat_xxx',  // Only for admin operations
});
```

## Troubleshooting

### "Missing X-Admin-Token or Authorization header"

You're calling an admin endpoint without authentication. Include both headers:
```bash
-H "X-MeshGuard-API-Key: msk_xxx" -H "X-Admin-Token: msat_xxx"
```

### "Invalid admin token. For org access, include X-MeshGuard-API-Key header."

You provided an admin token but forgot the API key. Include both headers.

### "Invalid API key"

Your API key doesn't match any organization. Check for typos or regenerate in Settings.

### "Invalid admin token for this organization"

Your admin token doesn't match the organization identified by your API key. Make sure both credentials are from the same signup.
