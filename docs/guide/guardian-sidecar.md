---
title: "Guardian Sidecar"
description: "Distributed edge enforcement for AI agent governance — deploy MeshGuard policy evaluation next to your agents with the Guardian sidecar"
---

# Guardian Sidecar

The Guardian sidecar is a lightweight policy enforcement agent that runs alongside your AI agents at the edge. It evaluates governance policies locally, caches signed policy bundles, and continues enforcing even when the central MeshGuard gateway is unreachable.

## Why a Sidecar?

The core MeshGuard gateway handles centralized policy management, identity, and audit. But in distributed architectures — Kubernetes pods, edge functions, multi-region deployments — routing every enforcement decision through a central gateway adds latency and creates a single point of failure.

The Guardian sidecar solves this by bringing policy evaluation to the edge:

- **Low latency** — Enforcement decisions happen locally, typically under 5ms
- **Disconnected operation** — Agents keep enforcing policy even if the gateway is down
- **Signed bundles** — Policy caches are cryptographically signed to prevent tampering
- **Minimal footprint** — Runs as a sidecar container or background process

## Deployment Modes

The Guardian sidecar supports two deployment modes:

| Mode | Behavior | When to Use |
|------|----------|-------------|
| `enforce` | Policy violations are blocked. Actions that violate policy are denied with a reason. | Production environments where governance is mandatory |
| `audit` | Policy violations are logged but not blocked. All actions are allowed. | Staging, testing, or gradual rollout of new policies |

Set the mode via the `MODE` environment variable:

```bash
MODE=enforce  # or MODE=audit
```

In `audit` mode, every decision that would have been denied is logged with the full policy evaluation context, so you can review the impact before switching to `enforce`.

## Docker Deployment

### Quick Start

```bash
docker run -d \
  --name meshguard-guardian \
  -p 4000:4000 \
  -e GATEWAY_URL="https://dashboard.meshguard.app" \
  -e ADMIN_TOKEN="your-admin-token" \
  -e MODE=enforce \
  -e BUNDLE_SYNC_INTERVAL=60 \
  -v guardian-cache:/cache \
  registry.meshguard.app/guardian:latest
```

### Docker Compose (Sidecar Pattern)

```yaml
version: "3.8"

services:
  my-agent:
    image: my-agent:latest
    environment:
      MESHGUARD_URL: "http://guardian:4000"
    depends_on:
      - guardian

  guardian:
    image: registry.meshguard.app/guardian:latest
    environment:
      GATEWAY_URL: "https://dashboard.meshguard.app"
      ADMIN_TOKEN: "${ADMIN_TOKEN}"
      MODE: enforce
      BUNDLE_SYNC_INTERVAL: 60
    volumes:
      - guardian-cache:/cache
    ports:
      - "4000:4000"

volumes:
  guardian-cache:
```

### Kubernetes Sidecar

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-agent
spec:
  containers:
    - name: agent
      image: my-agent:latest
      env:
        - name: MESHGUARD_URL
          value: "http://localhost:4000"
    - name: guardian
      image: registry.meshguard.app/guardian:latest
      ports:
        - containerPort: 4000
      env:
        - name: GATEWAY_URL
          value: "https://dashboard.meshguard.app"
        - name: ADMIN_TOKEN
          valueFrom:
            secretKeyRef:
              name: meshguard-secrets
              key: admin-token
        - name: MODE
          value: enforce
        - name: BUNDLE_SYNC_INTERVAL
          value: "60"
      volumeMounts:
        - name: cache
          mountPath: /cache
  volumes:
    - name: cache
      emptyDir: {}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GATEWAY_URL` | Yes | — | URL of the central MeshGuard gateway |
| `ADMIN_TOKEN` | Yes | — | Admin token for authenticating with the gateway |
| `MODE` | No | `enforce` | Deployment mode: `enforce` or `audit` |
| `BUNDLE_SYNC_INTERVAL` | No | `60` | How often (in seconds) to fetch updated policy bundles |
| `PORT` | No | `4000` | Port the sidecar listens on |
| `CACHE_DIR` | No | `/cache` | Directory for persisting policy bundles |
| `LOG_LEVEL` | No | `info` | Logging level: `debug`, `info`, `warn`, `error` |

## Policy Caching with Signed Bundles

The Guardian sidecar fetches policy bundles from the central gateway at the configured sync interval. Each bundle is cryptographically signed by the gateway, and the sidecar verifies the signature before applying the update.

**How it works:**

1. On startup, the sidecar loads the most recent cached bundle from disk (if available).
2. It immediately attempts to fetch the latest bundle from the gateway.
3. On success, the new bundle is verified, written to the cache directory, and activated.
4. On failure (network error, gateway down), the sidecar continues using the cached bundle.
5. The sync loop repeats at the configured interval.

**Bundle contents:**

- All policies applicable to the agents served by this sidecar
- Trust tier definitions
- Agent identity data (public keys, revocation lists)
- Bundle version and timestamp
- Cryptographic signature

**Cache invalidation:**

- Bundles are versioned. The sidecar only applies a bundle if its version is newer than the current one.
- If the gateway revokes a policy or agent, the next bundle sync will propagate the revocation.
- Manual cache clear: delete the contents of the `CACHE_DIR` and restart the sidecar.

## Disconnected Operation

When the gateway is unreachable, the Guardian sidecar continues enforcing policy using its cached bundle. This is critical for edge deployments and high-availability architectures.

**What works offline:**

- Policy evaluation against cached rules
- Agent token validation (using cached public keys)
- Trust tier enforcement
- Audit log buffering (events are stored locally and forwarded when connectivity resumes)

**What requires connectivity:**

- Fetching updated policies
- Syncing audit logs to the central gateway
- Real-time alerting
- Agent creation or revocation

::: tip Offline Duration
The sidecar can operate indefinitely on a cached bundle. However, any policy changes made at the gateway during the disconnection will not take effect until the next successful sync. Plan your `BUNDLE_SYNC_INTERVAL` accordingly — shorter intervals mean faster convergence, but more network traffic.
:::

## API Reference

The Guardian sidecar exposes a simple HTTP API for enforcement decisions.

### POST /enforce

Evaluate a single action against policy.

**Request:**

```json
{
  "agentId": "agent_abc123",
  "action": "write:email",
  "resource": "customer-data",
  "context": {
    "recipient": "user@example.com",
    "amount": 45.00
  }
}
```

**Response (allowed):**

```json
{
  "decision": "allow",
  "policy": "customer-service-agent",
  "rule": "allow-email",
  "latencyMs": 2.1,
  "bundleVersion": "2026-04-18T10:30:00Z",
  "mode": "enforce"
}
```

**Response (denied):**

```json
{
  "decision": "deny",
  "policy": "customer-service-agent",
  "rule": "deny-external-email",
  "reason": "Email to external domains is not permitted",
  "latencyMs": 1.8,
  "bundleVersion": "2026-04-18T10:30:00Z",
  "mode": "enforce"
}
```

### POST /enforce/batch

Evaluate multiple actions in a single request. Useful for pre-flight checks before a multi-step workflow.

**Request:**

```json
{
  "agentId": "agent_abc123",
  "actions": [
    { "action": "read:customer", "resource": "customer-db" },
    { "action": "write:refund", "resource": "payments", "context": { "amount": 25.00 } },
    { "action": "write:email", "resource": "notifications" }
  ]
}
```

**Response:**

```json
{
  "results": [
    { "action": "read:customer", "decision": "allow", "latencyMs": 1.2 },
    { "action": "write:refund", "decision": "allow", "latencyMs": 1.5 },
    { "action": "write:email", "decision": "deny", "reason": "Rate limit exceeded", "latencyMs": 1.8 }
  ],
  "allAllowed": false,
  "bundleVersion": "2026-04-18T10:30:00Z",
  "mode": "enforce"
}
```

### GET /health

Health check endpoint for orchestrators and load balancers.

**Response:**

```json
{
  "status": "healthy",
  "mode": "enforce",
  "bundleVersion": "2026-04-18T10:30:00Z",
  "bundleAge": "4m32s",
  "lastSync": "2026-04-18T10:30:00Z",
  "lastSyncSuccess": true,
  "gatewayReachable": true,
  "cachedPolicies": 12,
  "cachedAgents": 47,
  "uptimeSeconds": 86400
}
```

Use the `gatewayReachable` and `lastSyncSuccess` fields to monitor connectivity. If the gateway has been unreachable for longer than expected, the `bundleAge` field tells you how stale the cached policies are.

## Integrating with Your Agent

Point your agent's MeshGuard client at the sidecar instead of the central gateway:

```python
from meshguard import MeshGuardClient

# Connect to the local Guardian sidecar
client = MeshGuardClient(
    gateway_url="http://localhost:4000",
    agent_token="your-agent-token",
)

# Enforcement works exactly the same
result = client.enforce("write:email", resource="notifications")
if result.decision == "deny":
    print(f"Blocked: {result.reason}")
```

```javascript
import { MeshGuardClient } from '@meshguard/sdk';

const client = new MeshGuardClient({
  gatewayUrl: 'http://localhost:4000',
  agentToken: 'your-agent-token',
});

const result = await client.enforce('write:email', { resource: 'notifications' });
if (result.decision === 'deny') {
  console.log(`Blocked: ${result.reason}`);
}
```

The SDKs are gateway-compatible — switching from the central gateway to a local sidecar requires only changing the URL.

## Next Steps

- [Self-Hosted Deployment](/guide/self-hosted) — Full self-hosted deployment guide
- [Policies](/guide/policies) — Configure the policies your sidecar will enforce
- [Audit Logging](/guide/audit) — How audit events flow from sidecar to gateway
- [Alerting](/guide/alerting) — Set up alerts on policy violations
