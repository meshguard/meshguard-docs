# Role-Based Access Control

MeshGuard includes a built-in RBAC system that controls who can manage agents, policies, alerts, trust settings, and billing within an organization. Every dashboard user is assigned a role, and every API action is gated by permission checks.

## Built-in Roles

MeshGuard ships with five roles, ordered by privilege level:

| Role | Hierarchy | Description |
|------|-----------|-------------|
| `owner` | 100 | Full access. Automatically assigned to the org creator. Cannot be removed. |
| `admin` | 80 | Everything except `billing:write`. Can manage members and roles. |
| `editor` | 60 | Read + write on agents, policies, alerts, and trust. Read-only on audit and billing. |
| `approver` | 40 | Read-only across the board, plus `alerts:write` for acknowledging and resolving alerts. |
| `viewer` | 20 | Read-only access to all resources. |

## Permissions

There are 13 permission scopes available:

| Permission | Description |
|------------|-------------|
| `agents:read` | View agents and their details |
| `agents:write` | Create and update agents |
| `agents:delete` | Revoke and delete agents |
| `policies:read` | View policies |
| `policies:write` | Create and update policies |
| `policies:delete` | Delete policies |
| `audit:read` | View audit logs |
| `alerts:read` | View alerts |
| `alerts:write` | Acknowledge and resolve alerts |
| `trust:read` | View trust scores and relationships |
| `trust:write` | Modify trust settings and trigger recomputes |
| `billing:read` | View billing and subscription details |
| `billing:write` | Modify billing settings and subscriptions |

## Role-Permission Matrix

| Permission | owner | admin | editor | approver | viewer |
|------------|-------|-------|--------|----------|--------|
| `agents:read` | yes | yes | yes | yes | yes |
| `agents:write` | yes | yes | yes | -- | -- |
| `agents:delete` | yes | yes | -- | -- | -- |
| `policies:read` | yes | yes | yes | yes | yes |
| `policies:write` | yes | yes | yes | -- | -- |
| `policies:delete` | yes | yes | -- | -- | -- |
| `audit:read` | yes | yes | yes | yes | yes |
| `alerts:read` | yes | yes | yes | yes | yes |
| `alerts:write` | yes | yes | yes | yes | -- |
| `trust:read` | yes | yes | yes | yes | yes |
| `trust:write` | yes | yes | yes | -- | -- |
| `billing:read` | yes | yes | yes | yes | yes |
| `billing:write` | yes | -- | -- | -- | -- |

## Role Hierarchy Rules

The hierarchy number determines what a user can do to other users:

- A user can only assign roles **lower** than their own. An `admin` (80) can assign `editor` (60), `approver` (40), or `viewer` (20), but not `admin` or `owner`.
- A user can only remove users whose role is **lower** than their own.
- The org creator always has `owner` access, regardless of any explicit role assignment. This cannot be overridden.
- Super admins bypass all RBAC checks.

## API Endpoints

All RBAC endpoints are mounted at `/admin/rbac` and require a valid dashboard JWT in the `Authorization: Bearer <token>` header.

### List Available Roles

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://your-meshguard/admin/rbac/roles
```

Returns all built-in roles with their permissions and hierarchy values, plus any custom roles defined for the organization.

### List Org Members

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://your-meshguard/admin/rbac/members
```

**Response:**

```json
{
  "members": [
    {
      "email": "founder@company.com",
      "role": "owner",
      "assignedBy": "system",
      "assignedAt": "2026-01-15T00:00:00.000Z"
    },
    {
      "email": "ops@company.com",
      "role": "admin",
      "assignedBy": "founder@company.com",
      "assignedAt": "2026-02-01T10:00:00.000Z"
    }
  ],
  "count": 2
}
```

### Assign a Role

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  https://your-meshguard/admin/rbac/members \
  -d '{"email": "newuser@company.com", "role": "editor"}'
```

::: warning
You must be `admin` or higher to assign roles. You cannot assign a role equal to or higher than your own.
:::

### Change a User's Role

```bash
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  https://your-meshguard/admin/rbac/members/user@company.com/role \
  -d '{"role": "approver"}'
```

### Remove a User

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  https://your-meshguard/admin/rbac/members/user@company.com
```

### View Your Effective Permissions

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://your-meshguard/admin/rbac/permissions
```

**Response:**

```json
{
  "email": "ops@company.com",
  "orgId": "org_abc",
  "role": "admin",
  "permissions": [
    "agents:read", "agents:write", "agents:delete",
    "policies:read", "policies:write", "policies:delete",
    "audit:read", "alerts:read", "alerts:write",
    "trust:read", "trust:write", "billing:read"
  ],
  "isSuperAdmin": false
}
```

## Custom Roles

Organizations can define custom roles with a hand-picked set of permissions. This is useful when the built-in roles do not match your team structure.

### Configuration

Custom roles are enabled by default. The RBAC configuration controls:

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Whether RBAC enforcement is active |
| `allowCustomRoles` | `true` | Whether custom roles can be created |
| `maxCustomRolesPerOrg` | `10` | Maximum number of custom roles per organization |

### Creating a Custom Role

Custom roles are created via the database API. Each custom role specifies:

- **name** -- A unique name within the organization (e.g., `security-analyst`)
- **permissions** -- An array of permission scopes from the 13 available

Custom roles have a hierarchy value of `0`, which means they are always outranked by any built-in role.

### Resolution Order

When MeshGuard evaluates permissions for a user, it follows this resolution order:

1. **Org creator check** -- If the user is the org creator, grant all permissions (owner-level).
2. **Built-in role lookup** -- If the user's assigned role is a built-in role, use its permission map.
3. **Custom role fallback** -- If the role name matches a custom role, use the custom role's permissions.

## Middleware Integration

MeshGuard provides a Hono middleware factory for protecting routes:

```typescript
import { requirePermission } from './rbac/engine';

// Protect a route with a specific permission
app.post('/agents', requirePermission('agents:write'), handler);
app.delete('/policies/:id', requirePermission('policies:delete'), handler);
```

The middleware:

1. Extracts the JWT from the `Authorization: Bearer <token>` header
2. Verifies the token
3. Checks if the user is a super admin (bypasses RBAC)
4. Verifies the user has the required permission in their org context
5. Returns `401` for missing/invalid tokens, `403` for insufficient permissions

## Best Practices

1. **Use least privilege** -- Assign the lowest role that gives a user what they need. Start with `viewer` and escalate only when necessary.
2. **Reserve `owner` for the org creator** -- The owner role has `billing:write` and cannot be revoked. Use `admin` for day-to-day management.
3. **Prefer built-in roles** -- Custom roles are powerful but harder to audit. Use them sparingly for specific use cases.
4. **Audit role assignments** -- Periodically review the members list to remove unused accounts and verify role assignments are still appropriate.
5. **Use `approver` for incident responders** -- The `approver` role gives read access everywhere plus the ability to acknowledge alerts, making it ideal for on-call staff.
