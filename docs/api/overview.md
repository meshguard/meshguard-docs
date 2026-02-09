# API Reference

MeshGuard provides a REST API for agent governance and management.

## Base URL

Your MeshGuard gateway URL (provided when you sign up):

```
https://your-gateway.meshguard.app
```

For the public sandbox:

```
https://dashboard.meshguard.app
```

## Authentication

### Agent Authentication

Agents authenticate using JWT bearer tokens:

```bash
curl https://your-gateway.meshguard.app/proxy/endpoint \
  -H "Authorization: Bearer <agent-token>" \
  -H "X-MeshGuard-Action: read:contacts"
```

### Admin Authentication

Admin endpoints require an admin token header:

```bash
curl https://your-gateway.meshguard.app/admin/agents \
  -H "X-Admin-Token: <admin-token>"
```

## Gateway Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/` | Gateway info |
| ALL | `/proxy/*` | Governed proxy (requires auth) |

## Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/agents` | List agents |
| POST | `/admin/agents` | Create agent |
| GET | `/admin/agents/:id` | Get agent |
| PATCH | `/admin/agents/:id` | Update agent |
| DELETE | `/admin/agents/:id` | Revoke agent |
| GET | `/admin/policies` | List policies |
| GET | `/admin/policies/:name` | Get policy |
| GET | `/admin/audit` | Query audit log |
| GET | `/admin/audit/stats` | Audit statistics |

## Using the SDK

We recommend using the [Python SDK](/integrations/python) instead of calling the API directly:

```python
from meshguard import MeshGuardClient

client = MeshGuardClient()
decision = client.check("read:contacts")
```

## Detailed Documentation

- [Authentication](/api/authentication)
- [Gateway Endpoints](/api/gateway)
- [Admin Endpoints](/api/admin)
