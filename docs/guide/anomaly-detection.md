# Anomaly Detection

MeshGuard continuously monitors agent behavior and flags deviations from established baselines. Anomalies feed directly into the trust scoring system -- each detection reduces an agent's anomaly component, potentially lowering its trust tier and restricting access.

## Anomaly Types

MeshGuard detects nine categories of anomalous behavior:

| Type | Description |
|------|-------------|
| `new_resource` | Agent accessed a resource it has never used before |
| `volume_spike` | Request volume significantly exceeds the agent's historical baseline |
| `off_hours` | Activity outside the agent's normal operating window |
| `denied_burst` | Burst of denied requests in a short time period |
| `new_delegation` | Agent received or issued a delegation for the first time |
| `depth_exceeded` | A delegation chain exceeded the configured maximum depth |
| `skill_drift` | Agent's skill usage pattern changed significantly |
| `flagged_skill_use` | Agent used a skill that has been flagged as risky |
| `trust_drop` | Agent's trust score dropped significantly between computations |

## Severity Levels

Every anomaly is assigned one of four severity levels:

| Severity | Description | Impact |
|----------|-------------|--------|
| `low` | Minor deviation from baseline. Informational. | Logged for review. |
| `medium` | Notable deviation that warrants attention. | May trigger alerts. |
| `high` | Significant deviation indicating potential risk. | Triggers alerts; may throttle agent. |
| `critical` | Severe deviation requiring immediate action. | Triggers alerts; may block or quarantine agent. |

## Auto-Actions

Each anomaly can trigger one of five automatic responses, configured per anomaly type:

| Action | Description |
|--------|-------------|
| `none` | Record the anomaly but take no automated action. |
| `alert` | Send an alert via configured alert providers (Slack, webhook, email). |
| `throttle` | Reduce the agent's rate limit to slow down suspicious activity. |
| `block` | Temporarily block the agent from making further requests. |
| `quarantine` | Isolate the agent entirely, preventing all actions until manual review. |

::: tip
Start with `alert` for most anomaly types and only escalate to `throttle` or `block` once you have established reliable baselines. Overly aggressive auto-actions can disrupt legitimate agent workflows.
:::

## Anomaly Event Structure

Each detected anomaly is recorded with full context:

```json
{
  "id": "anom_abc123",
  "orgId": "org_xyz",
  "agentId": "agent_456",
  "anomalyType": "volume_spike",
  "severity": "high",
  "description": "Request volume 340% above 30-day baseline",
  "triggerAuditId": "audit_789",
  "baselineValue": 50,
  "observedValue": 220,
  "deviationFactor": 3.4,
  "autoAction": "throttle",
  "resolved": false,
  "detectedAt": "2026-04-22T14:30:00.000Z"
}
```

Key fields:

- **baselineValue / observedValue** -- The expected and actual values that triggered the anomaly.
- **deviationFactor** -- How far the observed value deviated from baseline (e.g., 3.4x).
- **triggerAuditId** -- Links back to the specific audit log entry that triggered detection.
- **autoAction** -- Which automatic response was taken.

## Querying Anomalies

### List Anomalies

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-meshguard/anomalies?severity=high&resolved=false&limit=20"
```

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `agentId` | string | Filter by agent |
| `orgId` | string | Filter by organization |
| `severity` | string | Filter by severity: `low`, `medium`, `high`, `critical` |
| `resolved` | boolean | Filter by resolution status |
| `from` | ISO date | Start of time range |
| `to` | ISO date | End of time range |
| `limit` | number | Max results (1-500, default 50) |
| `offset` | number | Pagination offset |

### Anomaly Summary

Get an aggregated summary for an agent's organization:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://your-meshguard/agents/agent_456/anomalies/summary
```

**Response:**

```json
{
  "summary": {
    "orgId": "org_xyz",
    "period": {
      "from": "2026-03-23T00:00:00.000Z",
      "to": "2026-04-22T00:00:00.000Z"
    },
    "totalAnomalies": 12,
    "unresolvedCount": 3,
    "bySeverity": {
      "low": 5,
      "medium": 4,
      "high": 2,
      "critical": 1
    },
    "byType": {
      "volume_spike": 4,
      "off_hours": 3,
      "denied_burst": 2,
      "new_resource": 2,
      "trust_drop": 1
    },
    "topAgents": [
      { "agentId": "agent_456", "count": 5 },
      { "agentId": "agent_789", "count": 4 }
    ]
  },
  "agentSpecific": {
    "agentId": "agent_456",
    "totalAnomalies": 5,
    "unresolvedCount": 2,
    "bySeverity": {
      "high": 2,
      "medium": 2,
      "low": 1
    }
  }
}
```

## Impact on Trust Scores

Anomalies directly affect the **anomaly component** of the trust score (weighted at 25%):

```
anomaly_component = max(0, 1.0 - (anomaly_count / 10))
```

- **0 anomalies** in the 30-day window: component = 1.0 (no penalty)
- **5 anomalies**: component = 0.5
- **10+ anomalies**: component = 0.0 (maximum penalty)

This means a single critical anomaly by itself reduces the trust score by approximately 0.025 (2.5%). An agent that accumulates 10 anomalies in a 30-day window loses the full 25% weight of the anomaly component.

::: warning
An agent with a trust score near a tier boundary can be demoted by even a few anomalies. For example, an agent at 0.52 (`trusted`) needs only 3 anomalies to potentially drop to `verified`.
:::

## Resolving Anomalies

Anomalies can be resolved after investigation. Resolved anomalies still count toward the anomaly component for the window in which they were detected, but they signal to reviewers that the event has been triaged.

Resolution is tracked with:

- `resolved` -- Boolean flag
- `resolvedAt` -- Timestamp of resolution
- `resolvedBy` -- Identifier of the person or process that resolved it

## Integration with Alerting

Anomaly auto-actions integrate with the [alerting system](/guide/alerting). When an anomaly triggers an `alert` action, it flows through the configured alert providers (Slack, webhook, email) with full context including the anomaly type, severity, and deviation details.

To receive anomaly alerts, ensure your alert triggers include `deny` or `all`:

```bash
ALERT_ON=deny,rate_limit
ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/T.../B.../xxx
```

## Best Practices

1. **Establish baselines first** -- Run MeshGuard in observation mode for at least two weeks before enabling aggressive auto-actions.
2. **Tune sensitivity per agent** -- High-volume agents may need higher volume thresholds to avoid false positives on `volume_spike`.
3. **Review unresolved anomalies regularly** -- Unresolved anomalies accumulate and drag down trust scores. Triage and resolve them promptly.
4. **Use the summary endpoint** -- The anomaly summary gives a quick overview of organizational health without scanning individual events.
5. **Correlate with audit logs** -- Use the `triggerAuditId` field to trace anomalies back to specific requests for deeper investigation.
6. **Layer auto-actions by severity** -- Use `alert` for low/medium, `throttle` for high, and `block` or `quarantine` only for critical.
