# Authentication

MeshGuard uses two authentication methods: Agent tokens (JWT) and Admin tokens.

## Agent Tokens

Agent tokens are JWTs issued by MeshGuard containing:

```json
{
  "sub": "agent_abc123",
  "name": "my-agent",
  "tier": "verified",
  "tags": ["production"],
  "iat": 1706000000,
  "exp": 1706086400,
  "iss": "meshguard"
}
```

### Using Agent Tokens

```bash
curl https://dashboard.meshguard.app/proxy/endpoint \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..."
```

### Token Expiration

By default, tokens expire after 24 hours. Configure with `JWT_EXPIRES_IN` environment variable.

## Admin Tokens

Admin tokens are simple strings for management API access.

```bash
curl https://dashboard.meshguard.app/admin/agents \
  -H "X-Admin-Token: your-admin-token"
```

## Trust Tiers

| Tier | Description |
|------|-------------|
| `untrusted` | New/unknown agents |
| `verified` | Identity confirmed |
| `trusted` | Established agents |
| `privileged` | Full access agents |

Policies can require specific trust tiers for actions.
