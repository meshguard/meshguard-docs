# Destructive Action Prevention

MeshGuard includes a runtime enforcement layer that identifies and gates destructive actions before they execute. When an agent attempts a dangerous operation -- deleting a database, revoking credentials, terminating production resources -- the system intervenes with cooling-off periods, confirmation requirements, or mandatory human approval.

## How It Works

The destructive action prevention system has two main components:

1. **Registry** -- A pattern database that identifies which actions are destructive, their severity, and what controls apply.
2. **Gate** -- A runtime enforcement layer that evaluates actions against the registry and enforces cooling-off periods and approval workflows.

```
Agent Request → Registry Check → Gate Evaluation → Decision
                                      ↓
                              [allow | confirm | cool_off | approve | block]
```

## Action Categories

MeshGuard classifies destructive actions into eight categories:

| Category | Description | Examples |
|----------|-------------|----------|
| `data_deletion` | Deleting files, records, databases | `drop_database`, `truncate_table`, `bulk_delete` |
| `access_revocation` | Removing permissions or access | `revoke_all_access`, `remove_admin` |
| `resource_termination` | Terminating VMs, containers, services | `terminate_production`, `delete_container` |
| `credential_invalidation` | Rotating or invalidating secrets | `rotate_all_secrets`, `revoke_api_key` |
| `config_destruction` | Deleting configs, policies, rules | `delete_policy`, `clear_config` |
| `communication_block` | Blocking or banning users | `ban_user`, `suspend_user` |
| `financial_action` | Refunds, cancellations, chargebacks | `process_refund`, `cancel_subscription` |
| `account_action` | Account deletion or suspension | `delete_account`, `suspend_org` |

## Severity Levels

Each registered pattern has a severity level that determines the required controls:

| Severity | Cooling-Off | Human Approval | Examples |
|----------|-------------|----------------|----------|
| `critical` | 3-5 minutes | Required | `drop_database`, `terminate_production`, `delete_account`, `rotate_all_secrets` |
| `high` | 1-2 minutes | Usually required | `drop_table`, `bulk_delete`, `terminate_vm`, `revoke_api_key` |
| `medium` | 30 seconds | Not required | `file_delete`, `remove_user_access`, `delete_container`, `ban_user` |
| `low` | Configurable | Not required | Custom patterns with minimal risk |

## Built-in Patterns

MeshGuard ships with 20+ built-in patterns covering common enterprise operations. Here are some examples:

```typescript
// Database operations
{ pattern: '(drop|delete|truncate)_(database|db|schema)', severity: 'critical', coolingOffMs: 300000 }
{ pattern: '(drop|delete|truncate)_table',                severity: 'high',     coolingOffMs: 120000 }
{ pattern: 'bulk_delete|mass_delete|delete_all|purge',     severity: 'high',     coolingOffMs: 60000  }

// Infrastructure
{ pattern: 'terminate_production|shutdown_prod|kill_prod', severity: 'critical', coolingOffMs: 300000 }
{ pattern: 'terminate_(vm|instance|server)',               severity: 'high',     coolingOffMs: 120000 }

// Credentials
{ pattern: 'rotate_all_secrets|invalidate_all_tokens',     severity: 'critical', coolingOffMs: 300000 }
{ pattern: 'revoke_api_key|invalidate_token',              severity: 'high',     coolingOffMs: 60000  }

// Account actions
{ pattern: 'delete_account|destroy_account|close_account', severity: 'critical', coolingOffMs: 300000 }
{ pattern: 'suspend_org|disable_organization',             severity: 'critical', coolingOffMs: 180000 }
```

Patterns use regular expressions and are matched case-insensitively against the action string. The action is also normalized (lowercased, non-alphanumeric characters replaced with underscores) before matching.

## Gate Evaluation Flow

When the gate evaluates an action, it follows this decision tree:

1. **Gate disabled?** -- If `enabled: false`, allow immediately.
2. **Trust tier bypass?** -- If the agent's trust tier is in `bypassForTrustTiers`, allow.
3. **Retry with pending ID?** -- If the request includes a `pendingId`, check the pending action's status.
4. **Destructive check** -- Run the action through the registry.
5. **Not destructive?** -- Allow immediately.
6. **Critical + requireApprovalForCritical?** -- Block, create pending action with `pending_approval` status.
7. **Requires human approval?** -- Block, create pending action with `pending_approval` status.
8. **Has cooling-off period?** -- Block, create pending action with `pending_cooling` status and a `coolingEndsAt` timestamp.
9. **Requires confirmation?** -- Block with a default cooling-off period.

## Cooling-Off Periods

When a destructive action is blocked for cooling off, the gate returns:

```json
{
  "allowed": false,
  "reason": "Action requires 120s cooling-off period",
  "pendingId": "pdact_abc123def456",
  "waitMs": 120000,
  "deniedPatterns": [...]
}
```

The agent (or its orchestrator) must wait for the cooling-off period to elapse, then retry with the `pendingId`:

```typescript
const decision = evaluateDestructiveAction('agent_123', 'drop_table', 'users');

if (!decision.allowed && decision.pendingId) {
  // Wait for cooling-off period
  await sleep(decision.waitMs);

  // Retry with pending ID
  const retry = evaluateDestructiveAction('agent_123', 'drop_table', 'users', {
    pendingId: decision.pendingId
  });

  if (retry.allowed) {
    // Proceed with the action
  }
}
```

::: tip
Cooling-off periods are capped at the `maxCoolingOffMs` configuration value (default: 5 minutes) regardless of the pattern's configured duration.
:::

## Approval Workflows

Critical actions and patterns with `requiresHumanApproval: true` create pending actions that must be explicitly approved:

```json
{
  "allowed": false,
  "reason": "Critical action requires human approval",
  "pendingId": "pdact_xyz789",
  "requiresApproval": true,
  "approvers": ["human"],
  "deniedPatterns": [...]
}
```

### Approving an Action

```typescript
import { globalGate } from './destructive';

// Human approver grants approval
globalGate.approve('pdact_xyz789', 'admin@company.com');
```

### Rejecting an Action

```typescript
globalGate.reject('pdact_xyz789', 'admin@company.com', 'Too risky for production');
```

### Pending Action Lifecycle

Each pending action moves through these states:

```
pending_cooling → approved (auto, after cooling-off)
pending_approval → approved (manual)
pending_approval → rejected (manual)
any pending state → expired (auto, after autoExpireMs)
approved → executed (after the action completes)
```

Pending actions automatically expire after `autoExpireMs` (default: 1 hour).

## Configuration

```typescript
import { DestructiveGate } from './destructive';

const gate = new DestructiveGate({
  enabled: true,
  defaultCoolingOffMs: 30_000,        // 30 seconds
  maxCoolingOffMs: 300_000,           // 5 minutes max
  requireApprovalForCritical: true,   // Critical always needs human approval
  allowedApprovers: ['human'],        // Who can approve
  autoExpireMs: 3_600_000,            // Pending actions expire after 1 hour
  bypassForTrustTiers: [],            // No bypass by default
  blockOnMatchFailure: true,          // If pattern matching fails, block
});
```

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Master switch for the gate |
| `defaultCoolingOffMs` | 30,000 | Default cooling-off when a pattern requires confirmation |
| `maxCoolingOffMs` | 300,000 | Maximum cooling-off period (5 minutes) |
| `requireApprovalForCritical` | `true` | Whether critical-severity actions always need human approval |
| `allowedApprovers` | `['human']` | List of approver identifiers |
| `autoExpireMs` | 3,600,000 | How long pending actions remain valid (1 hour) |
| `bypassForTrustTiers` | `[]` | Trust tiers that can bypass the gate (e.g., `['privileged']`) |
| `blockOnMatchFailure` | `true` | Block if the pattern matching engine errors |

## Custom Patterns

Register additional patterns to cover your organization's specific destructive actions:

```typescript
import { globalRegistry } from './destructive';

globalRegistry.register({
  id: 'custom_wipe_cache',
  pattern: 'wipe_cache|flush_cdn|purge_edge',
  category: 'config_destruction',
  severity: 'high',
  description: 'Wipe CDN cache (causes cold-start storm)',
  requiresConfirmation: true,
  coolingOffMs: 120_000,
  requiresHumanApproval: true,
  canRollback: false,
});
```

Patterns can also be unregistered:

```typescript
globalRegistry.unregister('custom_wipe_cache');
```

## Rollback Support

Each pattern declares whether the action `canRollback`. When all matched patterns support rollback, the system indicates that compensating actions (via MeshGuard's CAC engine) can reverse the operation if needed. When any matched pattern has `canRollback: false`, the combined result is `canRollback: false`.

## Metrics

The gate tracks detailed metrics for monitoring and dashboards:

```typescript
const metrics = globalGate.getMetrics();
```

```json
{
  "totalChecked": 5420,
  "destructiveDetected": 87,
  "blockedByCooling": 34,
  "blockedByApproval": 12,
  "approved": 40,
  "rejected": 5,
  "expired": 3,
  "executed": 37,
  "bySeverity": { "low": 0, "medium": 22, "high": 41, "critical": 24 },
  "byCategory": {
    "data_deletion": 30,
    "access_revocation": 15,
    "resource_termination": 12,
    "credential_invalidation": 8,
    "config_destruction": 10,
    "communication_block": 5,
    "financial_action": 4,
    "account_action": 3
  }
}
```

## Best Practices

1. **Do not bypass for privileged agents** -- Keep `bypassForTrustTiers` empty in production. Even trusted agents should go through cooling-off for critical actions.
2. **Set reasonable cooling-off periods** -- 30 seconds is long enough to catch mistakes; 5 minutes is appropriate for database drops.
3. **Always require approval for critical** -- Keep `requireApprovalForCritical: true`. This is the last line of defense for irreversible actions.
4. **Register custom patterns** -- Every organization has domain-specific destructive actions. Add patterns for your critical operations.
5. **Monitor expired actions** -- A high expiration rate may indicate that agents are being blocked but nobody is approving the actions.
6. **Integrate with alerting** -- Pipe `pending_approval` events into your Slack channel so approvers are notified immediately.
