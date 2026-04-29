# Trust Scoring & Delegation

MeshGuard computes behavioral trust scores for every agent in your organization. Scores range from 0.0 to 1.0, map to trust tiers, and drive dynamic access control decisions across the platform. Agents that behave well earn higher trust; agents that trigger anomalies or accumulate denials see their scores drop.

## How Trust Scores Work

Each agent's trust score is a weighted composite of five components, evaluated over a rolling 30-day window:

| Component | Weight | Description |
|-----------|--------|-------------|
| **History** | 30% | Ratio of allowed requests to total requests. A clean history yields 1.0; frequent denials pull it toward 0.0. |
| **Anomaly** | 25% | Inverse of anomaly detections. Zero anomalies = 1.0. Ten or more anomalies in the window = 0.0. |
| **Delegation** | 15% | Ratio of successful (non-revoked) delegations to total delegations issued by the agent. |
| **Tenure** | 15% | Days since the agent was created, divided by 90. Fully matures at 90 days. |
| **Vouchers** | 15% | Average trust score of agents that have delegated authority TO this agent. Defaults to 0.5 when no vouchers exist. |

The final score is the weighted sum, clamped to [0.0, 1.0]:

```
score = (0.30 * history) + (0.25 * anomaly) + (0.15 * delegation)
       + (0.15 * tenure) + (0.15 * vouchers)
```

## Score-to-Tier Mapping

The computed score maps to one of four trust tiers:

| Score Range | Tier | Description |
|-------------|------|-------------|
| 0.80 - 1.00 | `privileged` | Highest trust. May bypass certain gates. |
| 0.50 - 0.79 | `trusted` | Standard operational tier. |
| 0.25 - 0.49 | `verified` | Limited trust. Can issue delegations. |
| 0.00 - 0.24 | `unverified` | Lowest trust. Cannot delegate. |

Tier boundaries are evaluated from the top down: a score of exactly 0.80 maps to `privileged`, a score of exactly 0.50 maps to `trusted`, and so on.

## Viewing Trust Scores

### API

Retrieve the latest trust score for an agent:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://your-meshguard/agents/agent_123/trust
```

**Response:**

```json
{
  "score": {
    "agentId": "agent_123",
    "orgId": "org_abc",
    "computedScore": 0.72,
    "effectiveTier": "trusted",
    "components": {
      "history": 0.95,
      "anomaly": 0.80,
      "delegation": 1.0,
      "tenure": 0.33,
      "vouchers": 0.50
    },
    "requestCount": 1420,
    "denialCount": 71,
    "anomalyCount": 2,
    "computedAt": "2026-04-22T10:00:00.000Z",
    "windowStart": "2026-03-23T10:00:00.000Z",
    "windowEnd": "2026-04-22T10:00:00.000Z"
  }
}
```

### Score History

Fetch historical scores to track how an agent's trust has changed over time:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-meshguard/agents/agent_123/trust/history?limit=20&from=2026-03-01"
```

### Batch Recompute

Trigger a full recomputation for every active agent in an organization:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://your-meshguard/orgs/org_abc/trust/recompute
```

```json
{
  "orgId": "org_abc",
  "updated": 47,
  "errors": 0,
  "recomputedAt": "2026-04-22T10:05:00.000Z"
}
```

## Trust Decay

Agents that go dormant (no audit log entries for 30+ days) are subject to trust decay. The tenure component is reduced by 0.01 per day beyond the dormant threshold, gradually nudging idle agents toward a lower tier.

This prevents stale, unmonitored agents from retaining elevated privileges indefinitely.

::: tip
Run periodic batch recomputes (e.g., via a cron job hitting `POST /orgs/:orgId/trust/recompute`) to ensure decay is applied and scores stay current.
:::

## Delegation Chains

Agents can delegate scoped authority to other agents, forming delegation chains. This is the mechanism that allows a `trusted` agent to grant a subset of its permissions to a downstream agent.

### Creating a Delegation

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  https://your-meshguard/relationships \
  -d '{
    "orgId": "org_abc",
    "sourceAgentId": "agent_parent",
    "targetAgentId": "agent_child",
    "relationshipType": "delegates_to",
    "scope": ["read:*", "write:docs"],
    "permissionCeiling": ["read:*", "write:docs"],
    "maxDepth": 2,
    "requiresApproval": false,
    "expiresAt": "2026-06-01T00:00:00.000Z"
  }'
```

### Delegation Rules

MeshGuard enforces strict rules on delegation chains:

1. **Minimum tier** -- Only agents at `verified` tier or above can issue delegations.
2. **No self-delegation** -- An agent cannot delegate to itself.
3. **No circular chains** -- MeshGuard performs a BFS check to detect cycles before creating a delegation.
4. **Maximum chain depth** -- Delegation chains cannot exceed 5 hops from root to leaf.
5. **Scope ceiling** -- Each delegation carries a `permissionCeiling` that limits what can be propagated downstream. A child delegation can never exceed its parent's ceiling.

### Chain Validation

When an agent attempts an action via delegated authority, MeshGuard walks the chain upward from the agent to a root authority:

```
agent_child  <--delegates_to--  agent_parent  <--delegates_to--  agent_root (privileged)
```

At each hop, the engine verifies:

- The delegation is active (not revoked, not expired)
- The delegation's scope covers the requested action
- The permission ceiling allows the action
- The max depth for that edge is not exceeded

If any hop fails validation, the chain is invalid and the action is denied.

### Revoking a Delegation

The issuing agent can revoke a delegation at any time:

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  https://your-meshguard/relationships/rel_abc123 \
  -d '{"reason": "No longer needed"}'
```

::: warning
Revoking a delegation does not cascade to downstream delegations. However, downstream chains become effectively invalid because `validateDelegationChain` will fail when it encounters the revoked edge.
:::

### Automatic Expiry Pruning

Delegations with an `expiresAt` date are automatically pruned once expired. Expired delegations are soft-deleted with the reason `expired -- auto-pruned`.

## Signed Delegation Receipts

Every delegation generates a receipt that serves as a proof-of-delegation record. Receipts include:

```json
{
  "version": "1.0",
  "receiptId": "rcpt_abc123xyz",
  "timestamp": "2026-04-22T10:00:00.000Z",
  "issuer": {
    "agentId": "agent_parent",
    "trustScore": 0.82,
    "tier": "privileged"
  },
  "delegate": {
    "agentId": "agent_child",
    "trustScore": 0.55,
    "tier": "trusted"
  },
  "scope": {
    "actions": ["read:*", "write:docs"],
    "resources": ["read:*", "write:docs"],
    "maxDepth": 2,
    "expiresAt": "2026-06-01T00:00:00.000Z"
  },
  "chain": {
    "depth": 1,
    "parentReceiptId": null,
    "rootAgentId": "agent_parent"
  },
  "signature": "sig_..."
}
```

The receipt is stored on the relationship record and its hash is indexed for fast lookups.

::: tip
Receipts currently use nanoid-based placeholder signatures. Cryptographic signing (e.g., Ed25519) is planned for a future release.
:::

## Relationship Types

Beyond `delegates_to`, MeshGuard supports additional relationship types for modeling agent graphs:

| Type | Description |
|------|-------------|
| `delegates_to` | Scoped authority delegation with chain validation |
| `created_by` | Records which agent spawned another |
| `supervised_by` | Models oversight relationships |
| `consumes_skill` | Tracks which agents use which skills |

## Best Practices

1. **Keep delegation chains shallow** -- Prefer direct delegations over deep chains. Shorter chains are easier to audit and faster to validate.
2. **Set expiry dates** -- Always provide an `expiresAt` on delegations to prevent stale authority accumulation.
3. **Use narrow scopes** -- Delegate the minimum set of actions needed. Prefer `write:docs` over `write:*`.
4. **Monitor score trends** -- Use the score history API to detect agents whose trust is declining over time.
5. **Run periodic recomputes** -- Schedule batch recomputes to keep scores fresh and apply trust decay.
6. **Review voucher relationships** -- An agent's voucher score is only as good as its vouchers' scores. Low-trust vouchers drag scores down.
