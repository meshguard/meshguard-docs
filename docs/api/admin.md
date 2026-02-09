# Admin Endpoints

Management API for agents, policies, and audit logs.

All endpoints require `X-Admin-Token` header.

## Agents

### List Agents

```bash
GET /admin/agents
```

Response:
```json
{
  "agents": [
    {
      "id": "agent_abc123",
      "name": "my-agent",
      "trustTier": "verified",
      "tags": ["production"],
      "createdAt": "2026-01-25T18:00:00.000Z"
    }
  ]
}
```

### Create Agent

```bash
POST /admin/agents
Content-Type: application/json

{
  "name": "new-agent",
  "trustTier": "verified",
  "tags": ["demo"]
}
```

Response:
```json
{
  "id": "agent_xyz789",
  "name": "new-agent",
  "token": "eyJhbGciOiJIUzI1NiJ9..."
}
```

### Get Agent

```bash
GET /admin/agents/:id
```

### Update Agent

<Badge type="tip" text="v1.1.0" />

Partially update an agent's properties.

```bash
PATCH /admin/agents/:id
Content-Type: application/json

{
  "name": "updated-name",
  "trustTier": "trusted",
  "tags": ["production", "api-access"],
  "metadata": {
    "team": "platform",
    "owner": "alice@example.com"
  }
}
```

All fields are optional — only include what you want to update.

**Trust Tiers:**
| Tier | Description |
|------|-------------|
| `unverified` | New agents, minimal permissions |
| `verified` | Identity confirmed, standard permissions |
| `trusted` | Elevated trust, expanded permissions |
| `privileged` | Highest trust, administrative access |

**Response (200):**
```json
{
  "id": "agent_abc123",
  "name": "updated-name",
  "trustTier": "trusted",
  "tags": ["production", "api-access"],
  "metadata": {
    "team": "platform",
    "owner": "alice@example.com"
  },
  "updatedAt": "2026-02-09T17:30:00.000Z"
}
```

**Errors:**
| Code | Reason |
|------|--------|
| `404` | Agent not found |
| `403` | Agent belongs to different organization |
| `400` | Invalid trust tier or malformed request |

Changes are logged to the admin audit log with the previous and new values.

### Revoke Agent

```bash
DELETE /admin/agents/:id
```

## Policies

### List Policies

```bash
GET /admin/policies
```

### Get Policy

```bash
GET /admin/policies/:name
```

## Audit

### Query Audit Log

```bash
GET /admin/audit?limit=50&decision=deny
```

Parameters:
- `limit` — Max entries (default: 50)
- `decision` — Filter by decision (allow/deny)
- `from` — Start timestamp
- `to` — End timestamp

### Audit Statistics

```bash
GET /admin/audit/stats
```

Response:
```json
{
  "total": 1234,
  "allowed": 1100,
  "denied": 134,
  "period": "24h"
}
```
