# Compliance Reports

MeshGuard generates on-demand compliance reports that aggregate audit logs, trust scores, policy enforcement data, and governance metrics into structured documents. Reports can be exported as JSON for programmatic consumption or as styled HTML for sharing with stakeholders.

## Report Types

Four report types are available:

| Type | Name | Description |
|------|------|-------------|
| `compliance-summary` | Compliance Summary | Overall compliance posture: enforcement stats, anomaly summary, trust tier distribution, top denied actions, and compensating action metrics. |
| `audit-trail` | Audit Trail | Detailed audit log export for a time range, grouped by agent with policy references. |
| `agent-governance` | Agent Governance | Per-agent report covering trust tier, status, policy bindings, lifecycle events, and request history. |
| `policy-coverage` | Policy Coverage | Policy analysis showing which agents are covered, uncovered actions, and rule utilization. |

### Compliance Summary Sections

The compliance summary report includes six sections:

1. **Executive Overview** -- Total requests, allow/deny rates, unique agents, average latency.
2. **Trust Tier Distribution** -- Breakdown of requests by trust tier.
3. **Top Denied Actions** -- Most frequently denied actions across the organization.
4. **Most Active Agents** -- Agents with the highest request volumes.
5. **Policy Enforcement** -- Which policies matched the most requests and how often.
6. **Compensating Action Metrics** -- CAC execution counts, auto-recovery rate, manual intervention rate, and evidence entries.

### Audit Trail Sections

1. **Audit Trail Summary** -- Total entry count and per-agent breakdown (total, allowed, denied).
2. **Audit Entries** -- Full list of audit entries with timestamps, agent details, actions, decisions, and policy references.

### Agent Governance Sections

1. **Agent Status Distribution** -- How many agents are active, suspended, revoked, etc.
2. **Trust Tier Distribution** -- Count of agents per trust tier.
3. **Agent Details** -- Per-agent details including bound policies, request counts, and lifecycle events.

### Policy Coverage Sections

1. **Coverage Summary** -- Total policies, active policies, covered vs. uncovered agents, and coverage percentage.
2. **Policy Details** -- Each policy with bound agent counts and match counts.
3. **Agents Without Policy Bindings** -- Agents that have made requests but have no policy bindings.

## Generating Reports

### API Endpoint

```
POST /admin/reports/generate
```

**Authentication:** Requires a valid dashboard JWT (`Authorization: Bearer <token>`) or the `X-Admin-Token` + `X-MeshGuard-API-Key` headers.

### Request Body

```json
{
  "reportType": "compliance-summary",
  "format": "json",
  "from": "2026-04-01T00:00:00.000Z",
  "to": "2026-04-22T00:00:00.000Z",
  "orgId": "org_abc",
  "filters": {
    "trustTiers": ["trusted", "privileged"],
    "decisions": ["deny"]
  }
}
```

**Required fields:**

| Field | Type | Description |
|-------|------|-------------|
| `reportType` | string | One of: `compliance-summary`, `audit-trail`, `agent-governance`, `policy-coverage` |
| `from` | ISO date | Start of the report time range |
| `to` | ISO date | End of the report time range |

**Optional fields:**

| Field | Type | Description |
|-------|------|-------------|
| `format` | string | `json` (default) or `html` |
| `orgId` | string | Organization scope. Org admins can only view their own org. Super admins may specify any. |
| `filters.agentId` | string | Filter to a single agent |
| `filters.agentIds` | string[] | Filter to specific agents |
| `filters.trustTiers` | string[] | Filter by trust tiers |
| `filters.policyNames` | string[] | Filter by policy names |
| `filters.decisions` | string[] | Filter by decision: `allow`, `deny` |
| `filters.actions` | string[] | Filter by action names |

### JSON Response

```json
{
  "generatedAt": "2026-04-22T15:00:00.000Z",
  "reportType": "compliance-summary",
  "timeRange": {
    "from": "2026-04-01T00:00:00.000Z",
    "to": "2026-04-22T00:00:00.000Z"
  },
  "org": {
    "id": "org_abc",
    "name": "org_abc"
  },
  "sections": [
    {
      "id": "overview",
      "title": "Executive Overview",
      "data": {
        "totalRequests": 15420,
        "allowedRequests": 14200,
        "deniedRequests": 1220,
        "allowRate": 92.09,
        "denyRate": 7.91,
        "uniqueAgents": 23,
        "avgLatencyMs": 12.45
      }
    }
  ]
}
```

### HTML Export

Set `format` to `html` to receive a fully rendered HTML document suitable for sharing or printing:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  https://your-meshguard/admin/reports/generate \
  -d '{
    "reportType": "compliance-summary",
    "format": "html",
    "from": "2026-04-01",
    "to": "2026-04-22"
  }' \
  -o compliance-report.html
```

The HTML output includes styled tables, summary metrics, and section headings for each report section.

## Listing Report Types

Retrieve metadata for all available report types:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://your-meshguard/admin/reports/types
```

```json
{
  "reportTypes": [
    {
      "type": "compliance-summary",
      "name": "Compliance Summary",
      "description": "Overall compliance posture: enforcement stats, anomaly summary, trust tier distribution, top denied actions, and CAC recovery metrics."
    },
    {
      "type": "audit-trail",
      "name": "Audit Trail",
      "description": "Detailed audit log export for the selected time range, grouped by agent with policy references."
    },
    {
      "type": "agent-governance",
      "name": "Agent Governance",
      "description": "Per-agent report covering trust tier, status, policy bindings, lifecycle events, and request history."
    },
    {
      "type": "policy-coverage",
      "name": "Policy Coverage",
      "description": "Policy analysis showing which agents are covered, uncovered actions, and rule utilization."
    }
  ]
}
```

## Access Control

Report generation respects organization scoping:

- **Org admins** can only generate reports for their own organization. The `orgId` is automatically set from the JWT.
- **Super admins** can generate reports for any organization by passing the `orgId` field, or omit it for a global view.

::: tip
For auditors who need read-only access to reports, assign the `viewer` or `approver` role. Both include `audit:read` permission.
:::

## Time Range Guidelines

| Use Case | Recommended Range |
|----------|-------------------|
| Weekly compliance review | Last 7 days |
| Monthly executive report | Last 30 days |
| Quarterly audit | Last 90 days |
| Incident investigation | Custom range around the incident |

::: warning
The audit trail report caps at 5,000 entries per generation. For organizations with high request volumes, use shorter time ranges or apply filters to stay within the limit.
:::

## Best Practices

1. **Schedule weekly compliance summaries** -- Generate a `compliance-summary` report every Monday to track trends.
2. **Use filters for targeted reports** -- Narrow reports to specific agents or trust tiers to focus on areas of concern.
3. **Export HTML for stakeholders** -- Use the HTML format for sharing with compliance teams and executives who prefer visual reports.
4. **Combine report types** -- Use `compliance-summary` for the high-level view, then drill into `audit-trail` or `agent-governance` for details.
5. **Archive reports** -- Save generated JSON reports to your data lake for historical trend analysis.
6. **Monitor policy coverage** -- Run `policy-coverage` reports regularly to ensure no agents are operating without policy bindings.
