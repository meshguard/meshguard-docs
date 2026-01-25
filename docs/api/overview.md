# API Reference

MeshGuard provides both a Gateway API for agent requests and an Admin API for management.

## Base URLs

| Environment | URL |
|-------------|-----|
| Sandbox | `https://dashboard.meshguard.app` |
| Self-hosted | `http://localhost:3100` (default) |

## Authentication

### Agent Authentication

Agents authenticate using JWT bearer tokens:

```bash
curl https://dashboard.meshguard.app/proxy/endpoint \
  -H "Authorization: Bearer <agent-token>" \
  -H "X-MeshGuard-Action: read:contacts"
```

### Admin Authentication

Admin endpoints require an admin token header:

```bash
curl https://dashboard.meshguard.app/admin/agents \
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
| DELETE | `/admin/agents/:id` | Revoke agent |
| GET | `/admin/policies` | List policies |
| GET | `/admin/policies/:name` | Get policy |
| GET | `/admin/audit` | Query audit log |
| GET | `/admin/audit/stats` | Audit statistics |

## Request Headers

| Header | Description | Required |
|--------|-------------|----------|
| `Authorization` | Bearer token for agent auth | Yes (proxy) |
| `X-Admin-Token` | Admin token | Yes (admin) |
| `X-MeshGuard-Action` | Action for policy evaluation | Yes (proxy) |
| `X-MeshGuard-Resource` | Resource identifier | No |
| `X-MeshGuard-Trace-ID` | Trace ID for correlation | No |

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 401 | Invalid or missing authentication |
| 403 | Policy denied the action |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

## Detailed Documentation

- [Authentication](/api/authentication)
- [Gateway Endpoints](/api/gateway)
- [Admin Endpoints](/api/admin)
- [CLI Reference](/api/cli)
