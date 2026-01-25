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
