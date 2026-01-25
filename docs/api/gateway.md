# Gateway Endpoints

The gateway handles agent requests and policy enforcement.

## Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-25T18:00:00.000Z",
  "version": "0.1.0",
  "mode": "enforce"
}
```

## Gateway Info

```bash
GET /
```

Returns gateway information and capabilities.

## Proxy Requests

```bash
ALL /proxy/*
```

Routes requests through governance:

1. Validates agent token
2. Evaluates policy for the action
3. Logs to audit trail
4. Proxies to target if allowed

### Required Headers

- `Authorization: Bearer <token>` — Agent JWT
- `X-MeshGuard-Action: <action>` — Action for policy evaluation

### Optional Headers

- `X-MeshGuard-Resource: <resource>` — Resource identifier
- `X-MeshGuard-Trace-ID: <id>` — Correlation ID

### Example

```bash
# Allowed request
curl https://dashboard.meshguard.app/proxy/api/contacts \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-MeshGuard-Action: read:contacts"

# Denied request (returns 403)
curl https://dashboard.meshguard.app/proxy/api/admin \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-MeshGuard-Action: admin:delete"
```

### Denial Response

```json
{
  "error": "Forbidden",
  "message": "Denied by rule: deny admin:*",
  "action": "admin:delete",
  "policy": "default",
  "rule": "deny-admin"
}
```
