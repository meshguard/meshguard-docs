---
title: "JavaScript SDK"
description: "Official MeshGuard JavaScript/TypeScript SDK for governing AI agents"
---

# JavaScript SDK

The official MeshGuard JavaScript SDK for governing AI agents from Node.js, Deno, and browser environments.

[![npm version](https://badge.fury.io/js/meshguard.svg)](https://www.npmjs.com/package/meshguard)

## Installation

```bash
npm install meshguard
```

```bash
yarn add meshguard
```

```bash
pnpm add meshguard
```

## Quick Start

```typescript
import { MeshGuard } from 'meshguard';

const mg = new MeshGuard({
  gatewayUrl: 'https://dashboard.meshguard.app',
  agentToken: 'your-agent-token',
});

// Check if an action is allowed
const decision = await mg.check('read:contacts');

if (decision.allowed) {
  console.log('Access granted!');
} else {
  console.log(`Denied: ${decision.reason}`);
}
```

## Client Initialization

### With Explicit Configuration

```typescript
import { MeshGuard } from 'meshguard';

const mg = new MeshGuard({
  gatewayUrl: 'https://dashboard.meshguard.app',
  agentToken: 'your-agent-token',
  adminToken: 'your-admin-token',  // Optional, for admin operations
  timeout: 10_000,                 // Request timeout in ms (default: 10000)
  retries: 3,                      // Retry count on transient errors (default: 0)
  traceId: 'custom-trace-id',      // Optional global trace ID
});
```

### With Environment Variables

```bash
export MESHGUARD_GATEWAY_URL="https://dashboard.meshguard.app"
export MESHGUARD_AGENT_TOKEN="your-agent-token"
export MESHGUARD_ADMIN_TOKEN="your-admin-token"
```

```typescript
const mg = new MeshGuard(); // Reads from env vars
```

### Configuration Options

| Option | Env Variable | Default | Description |
|--------|-------------|---------|-------------|
| `gatewayUrl` | `MESHGUARD_GATEWAY_URL` | — | Gateway URL (required) |
| `agentToken` | `MESHGUARD_AGENT_TOKEN` | — | Agent JWT token (required) |
| `adminToken` | `MESHGUARD_ADMIN_TOKEN` | — | Admin token for management APIs |
| `timeout` | `MESHGUARD_TIMEOUT` | `10000` | Request timeout in milliseconds |
| `retries` | — | `0` | Number of retries on transient errors |
| `traceId` | — | auto-generated | Trace ID for correlation |

## Agent Registration

Register new agents programmatically (requires admin token):

```typescript
const mg = new MeshGuard({
  gatewayUrl: 'https://dashboard.meshguard.app',
  adminToken: 'your-admin-token',
});

// Create a new agent
const agent = await mg.createAgent({
  name: 'my-agent',
  trustTier: 'verified',
  tags: ['production', 'sales'],
});

console.log(`Agent ID: ${agent.id}`);
console.log(`Token: ${agent.token}`);

// List all agents
const agents = await mg.listAgents();
for (const a of agents) {
  console.log(`${a.name} (${a.trustTier})`);
}

// Revoke an agent
await mg.revokeAgent('agent_abc123');
```

## Policy Evaluation

### check(action)

Non-throwing check — returns a decision object:

```typescript
const decision = await mg.check('read:contacts');

console.log(decision.allowed);   // true or false
console.log(decision.action);    // "read:contacts"
console.log(decision.decision);  // "allow" or "deny"
console.log(decision.policy);    // Policy name that matched
console.log(decision.reason);    // Reason for denial (if denied)
console.log(decision.traceId);   // Trace ID for correlation
```

### check with resource and context

```typescript
const decision = await mg.check('write:email', {
  resource: 'user@external.com',
  context: {
    subject: 'Sales outreach',
    recipientDomain: 'external.com',
  },
});
```

### enforce(action)

Throws `PolicyDeniedError` if the action is denied:

```typescript
import { PolicyDeniedError } from 'meshguard';

try {
  await mg.enforce('delete:database');
  // Action allowed — proceed
  await deleteDatabase();
} catch (err) {
  if (err instanceof PolicyDeniedError) {
    console.log(`Denied: ${err.reason}`);
    console.log(`Policy: ${err.policy}`);
    console.log(`Trace: ${err.traceId}`);
  }
}
```

### checkPermission(action)

Alias for `check()` — provided for readability in permission-check contexts:

```typescript
const { allowed, reason } = await mg.checkPermission('send:message');

if (!allowed) {
  return { error: 'Permission denied', reason };
}
```

## Audit Logging

### Automatic Logging

Every `check()` and `enforce()` call is automatically logged in MeshGuard's audit trail.

### Manual Audit Entries

```typescript
await mg.auditLog({
  action: 'custom:data-export',
  decision: 'allow',
  metadata: {
    format: 'csv',
    rows: 1500,
    destination: 's3://exports/',
  },
});
```

### Querying Audit Logs

```typescript
// Recent entries
const entries = await mg.getAuditLog({ limit: 50 });

// Only denials
const denials = await mg.getAuditLog({
  limit: 100,
  decision: 'deny',
});

// By agent
const agentLogs = await mg.getAuditLog({
  agentId: 'agent_abc123',
  from: '2026-01-01',
  to: '2026-01-31',
});

for (const entry of denials) {
  console.log(`${entry.timestamp}: ${entry.action} → ${entry.decision}`);
}
```

## Delegation Chains

MeshGuard supports agent-to-agent delegation with permission ceilings:

```typescript
// Agent A delegates a subset of permissions to Agent B
const delegation = await mg.delegate({
  toAgent: 'agent_b_id',
  permissions: ['read:contacts', 'read:calendar'],
  maxDepth: 1,               // Agent B cannot further delegate
  expiresIn: '24h',          // Delegation expires after 24 hours
  reason: 'Task handoff',
});

console.log(`Delegation ID: ${delegation.id}`);
console.log(`Chain depth: ${delegation.depth}`);

// Agent B uses the delegation
const mgAgentB = new MeshGuard({
  gatewayUrl: 'https://dashboard.meshguard.app',
  agentToken: 'agent-b-token',
  delegationId: delegation.id,
});

const decision = await mgAgentB.check('read:contacts');
// Allowed — within delegated permissions

const denied = await mgAgentB.check('write:email');
// Denied — not in delegated permissions
```

### Listing Delegations

```typescript
const delegations = await mg.listDelegations();

for (const d of delegations) {
  console.log(`${d.fromAgent} → ${d.toAgent}: ${d.permissions.join(', ')}`);
  console.log(`  Depth: ${d.depth}/${d.maxDepth}`);
  console.log(`  Expires: ${d.expiresAt}`);
}
```

### Revoking Delegations

```typescript
await mg.revokeDelegation('delegation_abc123');
```

## Error Handling

```typescript
import {
  MeshGuardError,
  AuthenticationError,
  PolicyDeniedError,
  RateLimitError,
  ConnectionError,
} from 'meshguard';

try {
  await mg.enforce('dangerous:action');
} catch (err) {
  if (err instanceof PolicyDeniedError) {
    // Action blocked by policy
    console.log(`Action: ${err.action}`);
    console.log(`Policy: ${err.policy}`);
    console.log(`Reason: ${err.reason}`);
    console.log(`Trace: ${err.traceId}`);
  } else if (err instanceof AuthenticationError) {
    // Invalid or expired token
    console.log('Re-authenticate and retry');
  } else if (err instanceof RateLimitError) {
    // Rate limit hit — retry after delay
    console.log(`Retry after: ${err.retryAfter}ms`);
  } else if (err instanceof ConnectionError) {
    // Network error — gateway unreachable
    console.log('Check gateway URL and network');
  } else if (err instanceof MeshGuardError) {
    // Generic MeshGuard error
    console.log(`Error: ${err.message}`);
  }
}
```

### Error Classes

| Class | Description |
|-------|-------------|
| `MeshGuardError` | Base error class for all SDK errors |
| `AuthenticationError` | Invalid or expired token (HTTP 401) |
| `PolicyDeniedError` | Action denied by policy (HTTP 403) |
| `RateLimitError` | Rate limit exceeded (HTTP 429) |
| `ConnectionError` | Network error or gateway unreachable |
| `ValidationError` | Invalid request parameters (HTTP 400) |

## TypeScript Support

The SDK is written in TypeScript and exports full type definitions:

```typescript
import type {
  MeshGuardConfig,
  Decision,
  Agent,
  AuditEntry,
  Delegation,
  PolicyRule,
  CheckOptions,
} from 'meshguard';

// All methods are fully typed
const config: MeshGuardConfig = {
  gatewayUrl: 'https://dashboard.meshguard.app',
  agentToken: 'token',
};

const mg = new MeshGuard(config);

const decision: Decision = await mg.check('read:contacts');
const agents: Agent[] = await mg.listAgents();
const entries: AuditEntry[] = await mg.getAuditLog({ limit: 10 });
```

### Decision Type

```typescript
interface Decision {
  allowed: boolean;
  action: string;
  decision: 'allow' | 'deny';
  policy?: string;
  rule?: string;
  reason?: string;
  traceId: string;
  timestamp: string;
}
```

### Agent Type

```typescript
interface Agent {
  id: string;
  name: string;
  trustTier: 'untrusted' | 'basic' | 'verified' | 'trusted';
  tags: string[];
  createdAt: string;
  revokedAt?: string;
}
```

### AuditEntry Type

```typescript
interface AuditEntry {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  action: string;
  resource?: string;
  decision: 'allow' | 'deny';
  policy?: string;
  rule?: string;
  reason?: string;
  traceId: string;
  metadata?: Record<string, unknown>;
}
```

## Full API Reference

### Core Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `check(action, opts?)` | `Promise<Decision>` | Check if an action is allowed |
| `checkPermission(action, opts?)` | `Promise<Decision>` | Alias for `check()` |
| `enforce(action, opts?)` | `Promise<void>` | Enforce policy — throws on deny |
| `auditLog(entry)` | `Promise<void>` | Log a custom audit entry |
| `getAuditLog(opts?)` | `Promise<AuditEntry[]>` | Query audit log |
| `health()` | `Promise<HealthStatus>` | Check gateway health |
| `isHealthy()` | `Promise<boolean>` | Quick health check |

### Agent Management (Admin)

| Method | Returns | Description |
|--------|---------|-------------|
| `createAgent(opts)` | `Promise<Agent & { token: string }>` | Register a new agent |
| `listAgents()` | `Promise<Agent[]>` | List all agents |
| `getAgent(id)` | `Promise<Agent>` | Get agent details |
| `revokeAgent(id)` | `Promise<void>` | Revoke an agent |

### Policy Management (Admin)

| Method | Returns | Description |
|--------|---------|-------------|
| `listPolicies()` | `Promise<Policy[]>` | List all policies |
| `getPolicy(name)` | `Promise<Policy>` | Get policy details |
| `applyPolicy(yaml)` | `Promise<void>` | Apply a policy from YAML string |
| `deletePolicy(name)` | `Promise<void>` | Delete a policy |

### Delegation

| Method | Returns | Description |
|--------|---------|-------------|
| `delegate(opts)` | `Promise<Delegation>` | Create a delegation |
| `listDelegations()` | `Promise<Delegation[]>` | List active delegations |
| `revokeDelegation(id)` | `Promise<void>` | Revoke a delegation |

### Proxy

| Method | Returns | Description |
|--------|---------|-------------|
| `get(path, opts?)` | `Promise<Response>` | Governed GET request |
| `post(path, opts?)` | `Promise<Response>` | Governed POST request |
| `put(path, opts?)` | `Promise<Response>` | Governed PUT request |
| `delete(path, opts?)` | `Promise<Response>` | Governed DELETE request |
| `request(method, path, opts?)` | `Promise<Response>` | Governed HTTP request |

## Express.js Middleware

Use MeshGuard as Express middleware for API governance:

```typescript
import express from 'express';
import { MeshGuard, meshguardMiddleware } from 'meshguard';

const app = express();
app.use(express.json());

// Initialize MeshGuard
const mg = new MeshGuard({
  gatewayUrl: 'https://dashboard.meshguard.app',
  adminToken: process.env.MESHGUARD_ADMIN_TOKEN,
});

// Apply governance middleware globally
app.use(meshguardMiddleware(mg, {
  // Map routes to actions
  actionMap: {
    'GET /api/contacts': 'read:contacts',
    'POST /api/contacts': 'write:contacts',
    'DELETE /api/contacts/:id': 'delete:contacts',
    'GET /api/emails': 'read:email',
    'POST /api/emails': 'write:email',
  },
  // Extract agent token from request
  tokenExtractor: (req) => req.headers['x-agent-token'] as string,
  // What to do on denial
  onDenied: (req, res, decision) => {
    res.status(403).json({
      error: 'Forbidden',
      action: decision.action,
      reason: decision.reason,
      policy: decision.policy,
      traceId: decision.traceId,
    });
  },
}));

// Routes execute only if policy allows
app.get('/api/contacts', async (req, res) => {
  const contacts = await db.getContacts();
  res.json({ contacts });
});

app.post('/api/emails', async (req, res) => {
  await sendEmail(req.body);
  res.json({ status: 'sent' });
});

app.listen(3000);
```

### Per-Route Middleware

```typescript
import { enforce } from 'meshguard';

// Protect individual routes
app.delete('/api/contacts/:id',
  enforce(mg, 'delete:contacts'),
  async (req, res) => {
    await db.deleteContact(req.params.id);
    res.json({ deleted: true });
  }
);

// With dynamic action
app.post('/api/files/:path(*)',
  enforce(mg, (req) => `write:file:${req.params.path}`),
  async (req, res) => {
    await writeFile(req.params.path, req.body);
    res.json({ written: true });
  }
);
```

## Next.js Integration

### API Route Handler

```typescript
// app/api/contacts/route.ts
import { MeshGuard, PolicyDeniedError } from 'meshguard';
import { NextRequest, NextResponse } from 'next/server';

const mg = new MeshGuard();

export async function GET(req: NextRequest) {
  const agentToken = req.headers.get('x-agent-token');

  if (!agentToken) {
    return NextResponse.json(
      { error: 'Missing agent token' },
      { status: 401 }
    );
  }

  const agentMg = new MeshGuard({
    gatewayUrl: process.env.MESHGUARD_GATEWAY_URL!,
    agentToken,
  });

  try {
    await agentMg.enforce('read:contacts');
  } catch (err) {
    if (err instanceof PolicyDeniedError) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          reason: err.reason,
          traceId: err.traceId,
        },
        { status: 403 }
      );
    }
    throw err;
  }

  const contacts = await getContacts();
  return NextResponse.json({ contacts });
}
```

### Next.js Middleware

```typescript
// middleware.ts
import { MeshGuard, PolicyDeniedError } from 'meshguard';
import { NextRequest, NextResponse } from 'next/server';

const mg = new MeshGuard();

const ACTION_MAP: Record<string, string> = {
  '/api/contacts': 'read:contacts',
  '/api/emails': 'read:email',
  '/api/calendar': 'read:calendar',
};

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const action = ACTION_MAP[path];

  // Only govern mapped routes
  if (!action) return NextResponse.next();

  const agentToken = req.headers.get('x-agent-token');
  if (!agentToken) {
    return NextResponse.json(
      { error: 'Missing agent token' },
      { status: 401 }
    );
  }

  const agentMg = new MeshGuard({
    gatewayUrl: process.env.MESHGUARD_GATEWAY_URL!,
    agentToken,
  });

  const decision = await agentMg.check(action);

  if (!decision.allowed) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        action: decision.action,
        reason: decision.reason,
        traceId: decision.traceId,
      },
      { status: 403 }
    );
  }

  // Attach trace ID to response headers
  const response = NextResponse.next();
  response.headers.set('x-meshguard-trace-id', decision.traceId);
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

### Server Component with Governance

```typescript
// app/dashboard/page.tsx
import { MeshGuard } from 'meshguard';
import { cookies } from 'next/headers';

const mg = new MeshGuard();

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const agentToken = cookieStore.get('agent-token')?.value;

  if (!agentToken) {
    return <div>Not authenticated</div>;
  }

  const agentMg = new MeshGuard({
    gatewayUrl: process.env.MESHGUARD_GATEWAY_URL!,
    agentToken,
  });

  const canReadContacts = await agentMg.check('read:contacts');
  const canReadCalendar = await agentMg.check('read:calendar');

  return (
    <div>
      <h1>Dashboard</h1>
      {canReadContacts.allowed && <ContactsList />}
      {canReadCalendar.allowed && <CalendarWidget />}
      {!canReadContacts.allowed && !canReadCalendar.allowed && (
        <p>No permissions granted. Contact your administrator.</p>
      )}
    </div>
  );
}
```

## Health Check

```typescript
// Detailed health info
const health = await mg.health();
console.log(health);
// { status: "healthy", version: "0.1.0", mode: "enforce" }

// Quick boolean check
if (await mg.isHealthy()) {
  console.log('Gateway is reachable');
}
```

## Related

- [Python SDK](/integrations/python) — Python SDK reference
- [Clawdbot Integration](/integrations/clawdbot) — MeshGuard for Clawdbot agents
- [Generic HTTP](/integrations/http) — Use MeshGuard with any HTTP client
- [API Reference](/api/overview) — Gateway and Admin API documentation
- [Policies](/guide/policies) — Policy format and syntax
- [Audit Logging](/guide/audit) — Audit trail configuration
