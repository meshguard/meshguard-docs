# Analytics API

The Analytics API provides aggregated metrics and insights about your MeshGuard deployment. Use these endpoints to build dashboards, generate reports, or integrate with external monitoring tools.

All analytics endpoints:

- Require the `X-Admin-Token` header (same token used for other [Admin Endpoints](/api/admin))
- Support a `period` query parameter: `24h` (default), `7d`, or `30d`
- Are multi-tenant — results are automatically scoped to the authenticated organization
- Return `application/json` responses

## Overview

Returns high-level summary statistics for the selected period, including comparison trends against the prior equivalent period.

```
GET /admin/analytics/overview
```

### Query Parameters

| Parameter | Type   | Default | Description                          |
|-----------|--------|---------|--------------------------------------|
| `period`  | string | `24h`   | Time window: `24h`, `7d`, or `30d`   |

### Example Request

```bash
curl https://dashboard.meshguard.app/admin/analytics/overview?period=7d \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

### Example Response

```json
{
  "period": "7d",
  "totalRequests": 48210,
  "enforcementRate": 94.3,
  "activeAgents": 17,
  "avgLatencyMs": 12.4,
  "trends": {
    "totalRequests": 8.2,
    "enforcementRate": -0.5,
    "activeAgents": 2,
    "avgLatencyMs": -1.1
  }
}
```

### Response Fields

| Field                     | Type   | Description                                                        |
|---------------------------|--------|--------------------------------------------------------------------|
| `period`                  | string | The requested time window                                          |
| `totalRequests`           | number | Total governance requests in the period                            |
| `enforcementRate`         | number | Percentage of requests that matched a policy rule (0–100)          |
| `activeAgents`            | number | Count of agents that made at least one request                     |
| `avgLatencyMs`            | number | Average gateway evaluation latency in milliseconds                 |
| `trends.totalRequests`    | number | Percent change vs. prior period (positive = increase)              |
| `trends.enforcementRate`  | number | Absolute change in enforcement rate vs. prior period               |
| `trends.activeAgents`     | number | Change in active agent count vs. prior period                      |
| `trends.avgLatencyMs`     | number | Change in average latency vs. prior period (negative = faster)     |

---

## Timeseries

Returns allow/deny counts bucketed over time for charting request volume and enforcement trends.

```
GET /admin/analytics/timeseries
```

### Query Parameters

| Parameter | Type   | Default | Description                                |
|-----------|--------|---------|--------------------------------------------|
| `period`  | string | `24h`   | Time window: `24h`, `7d`, or `30d`         |
| `bucket`  | string | `hour`  | Bucket granularity: `hour` or `day`         |

### Example Request

```bash
curl "https://dashboard.meshguard.app/admin/analytics/timeseries?period=7d&bucket=day" \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

### Example Response

```json
{
  "period": "7d",
  "bucket": "day",
  "data": [
    { "time": "2026-01-20T00:00:00Z", "allowed": 5820, "denied": 390 },
    { "time": "2026-01-21T00:00:00Z", "allowed": 6100, "denied": 415 },
    { "time": "2026-01-22T00:00:00Z", "allowed": 5950, "denied": 370 },
    { "time": "2026-01-23T00:00:00Z", "allowed": 6200, "denied": 402 },
    { "time": "2026-01-24T00:00:00Z", "allowed": 6340, "denied": 450 },
    { "time": "2026-01-25T00:00:00Z", "allowed": 6050, "denied": 388 },
    { "time": "2026-01-26T00:00:00Z", "allowed": 5900, "denied": 410 }
  ]
}
```

### Response Fields

| Field          | Type   | Description                                    |
|----------------|--------|------------------------------------------------|
| `period`       | string | The requested time window                      |
| `bucket`       | string | Bucket granularity used                        |
| `data`         | array  | Array of time-bucketed counts                  |
| `data[].time`  | string | ISO 8601 timestamp for the start of the bucket |
| `data[].allowed` | number | Number of allowed requests in the bucket     |
| `data[].denied`  | number | Number of denied requests in the bucket      |

---

## Agents

Returns per-agent analytics ranked by the selected sort criteria. Use this to identify your most active agents, highest denial rates, or latency outliers.

```
GET /admin/analytics/agents
```

### Query Parameters

| Parameter | Type   | Default    | Description                                         |
|-----------|--------|------------|-----------------------------------------------------|
| `period`  | string | `24h`      | Time window: `24h`, `7d`, or `30d`                  |
| `sort`    | string | `requests` | Sort field: `requests`, `denied`, or `latency`      |
| `limit`   | number | `20`       | Maximum number of agents to return (1–100)           |

### Example Request

```bash
curl "https://dashboard.meshguard.app/admin/analytics/agents?period=30d&sort=denied&limit=10" \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

### Example Response

```json
{
  "period": "30d",
  "sort": "denied",
  "agents": [
    {
      "id": "agent_abc123",
      "name": "data-pipeline",
      "trustTier": "verified",
      "requests": 12400,
      "allowed": 11200,
      "denied": 1200,
      "avgLatencyMs": 14.2,
      "lastActive": "2026-01-26T15:32:00Z"
    },
    {
      "id": "agent_def456",
      "name": "email-assistant",
      "trustTier": "sandboxed",
      "requests": 3800,
      "allowed": 3200,
      "denied": 600,
      "avgLatencyMs": 9.8,
      "lastActive": "2026-01-26T14:10:00Z"
    }
  ]
}
```

### Response Fields

| Field                    | Type   | Description                                        |
|--------------------------|--------|----------------------------------------------------|
| `period`                 | string | The requested time window                          |
| `sort`                   | string | The sort field used                                |
| `agents`                 | array  | Array of agent analytics objects                   |
| `agents[].id`            | string | Unique agent identifier                            |
| `agents[].name`          | string | Agent display name                                 |
| `agents[].trustTier`     | string | Agent trust tier (`sandboxed`, `verified`, `trusted`, `privileged`) |
| `agents[].requests`      | number | Total requests in the period                       |
| `agents[].allowed`       | number | Number of allowed requests                         |
| `agents[].denied`        | number | Number of denied requests                          |
| `agents[].avgLatencyMs`  | number | Average gateway evaluation latency (ms)            |
| `agents[].lastActive`    | string | ISO 8601 timestamp of the agent's last request     |

---

## Policies

Returns per-policy enforcement analytics showing how often each policy was triggered and the resulting action breakdown.

```
GET /admin/analytics/policies
```

### Query Parameters

| Parameter | Type   | Default | Description                          |
|-----------|--------|---------|--------------------------------------|
| `period`  | string | `24h`   | Time window: `24h`, `7d`, or `30d`   |

### Example Request

```bash
curl https://dashboard.meshguard.app/admin/analytics/policies?period=7d \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

### Example Response

```json
{
  "period": "7d",
  "policies": [
    {
      "name": "default-deny",
      "triggered": 2840,
      "allowRate": 0.0,
      "denyRate": 100.0,
      "topAction": "write:filesystem"
    },
    {
      "name": "verified-agent-access",
      "triggered": 18500,
      "allowRate": 95.2,
      "denyRate": 4.8,
      "topAction": "read:database"
    },
    {
      "name": "rate-limit-external",
      "triggered": 620,
      "allowRate": 88.5,
      "denyRate": 11.5,
      "topAction": "call:external-api"
    }
  ]
}
```

### Response Fields

| Field                   | Type   | Description                                              |
|-------------------------|--------|----------------------------------------------------------|
| `period`                | string | The requested time window                                |
| `policies`              | array  | Array of policy analytics objects                        |
| `policies[].name`       | string | Policy name                                              |
| `policies[].triggered`  | number | Number of times the policy was evaluated                 |
| `policies[].allowRate`  | number | Percentage of evaluations that resulted in allow (0–100) |
| `policies[].denyRate`   | number | Percentage of evaluations that resulted in deny (0–100)  |
| `policies[].topAction`  | string | Most frequently evaluated action for this policy         |

---

## Delegations

Returns analytics on delegation chains — when agents delegate authority to other agents. Useful for understanding how trust propagates through your system.

```
GET /admin/analytics/delegations
```

### Query Parameters

| Parameter | Type   | Default | Description                          |
|-----------|--------|---------|--------------------------------------|
| `period`  | string | `24h`   | Time window: `24h`, `7d`, or `30d`   |

### Example Request

```bash
curl https://dashboard.meshguard.app/admin/analytics/delegations?period=30d \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

### Example Response

```json
{
  "period": "30d",
  "totalChains": 342,
  "avgDepth": 2.1,
  "blockedChains": 18,
  "topPairs": [
    { "fromAgent": "orchestrator", "toAgent": "data-pipeline", "count": 120 },
    { "fromAgent": "orchestrator", "toAgent": "email-assistant", "count": 95 },
    { "fromAgent": "data-pipeline", "toAgent": "db-reader", "count": 64 },
    { "fromAgent": "email-assistant", "toAgent": "calendar-bot", "count": 38 }
  ]
}
```

### Response Fields

| Field                      | Type   | Description                                                   |
|----------------------------|--------|---------------------------------------------------------------|
| `period`                   | string | The requested time window                                     |
| `totalChains`              | number | Total delegation chains observed                              |
| `avgDepth`                 | number | Average depth of delegation chains (1 = direct, 2+ = nested) |
| `blockedChains`            | number | Number of delegation chains that were denied by policy        |
| `topPairs`                 | array  | Most frequent delegation pairs                                |
| `topPairs[].fromAgent`     | string | Name of the delegating agent                                  |
| `topPairs[].toAgent`       | string | Name of the agent receiving delegation                        |
| `topPairs[].count`         | number | Number of times this delegation occurred                      |

---

## Trust Distribution

Returns a breakdown of agents and request volume by trust tier. Helps you understand the trust profile of your deployment.

```
GET /admin/analytics/trust-distribution
```

### Query Parameters

| Parameter | Type   | Default | Description                          |
|-----------|--------|---------|--------------------------------------|
| `period`  | string | `24h`   | Time window: `24h`, `7d`, or `30d`   |

### Example Request

```bash
curl https://dashboard.meshguard.app/admin/analytics/trust-distribution?period=7d \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

### Example Response

```json
{
  "period": "7d",
  "tiers": [
    { "tier": "privileged", "agentCount": 2, "requestCount": 8400, "pct": 17.4 },
    { "tier": "trusted", "agentCount": 5, "requestCount": 18200, "pct": 37.8 },
    { "tier": "verified", "agentCount": 7, "requestCount": 16800, "pct": 34.9 },
    { "tier": "sandboxed", "agentCount": 3, "requestCount": 4810, "pct": 9.9 }
  ]
}
```

### Response Fields

| Field                   | Type   | Description                                            |
|-------------------------|--------|--------------------------------------------------------|
| `period`                | string | The requested time window                              |
| `tiers`                 | array  | Array of tier breakdown objects                        |
| `tiers[].tier`          | string | Trust tier name (`sandboxed`, `verified`, `trusted`, `privileged`) |
| `tiers[].agentCount`    | number | Number of agents in this tier                          |
| `tiers[].requestCount`  | number | Total requests from agents in this tier                |
| `tiers[].pct`           | number | Percentage of total requests from this tier (0–100)    |

---

## Latency Heatmap

Returns a grid of average latency values bucketed by day-of-week and hour-of-day. Use this to identify performance patterns and plan maintenance windows.

```
GET /admin/analytics/latency-heatmap
```

### Query Parameters

| Parameter | Type   | Default | Description                          |
|-----------|--------|---------|--------------------------------------|
| `period`  | string | `30d`   | Time window: `24h`, `7d`, or `30d`   |

::: tip
This endpoint works best with `period=30d` for statistically meaningful results. Shorter periods may produce sparse heatmaps.
:::

### Example Request

```bash
curl https://dashboard.meshguard.app/admin/analytics/latency-heatmap?period=30d \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

### Example Response

```json
{
  "period": "30d",
  "cells": [
    { "dayOfWeek": 0, "hourOfDay": 0, "avgLatencyMs": 8.2, "count": 120 },
    { "dayOfWeek": 0, "hourOfDay": 1, "avgLatencyMs": 7.9, "count": 95 },
    { "dayOfWeek": 0, "hourOfDay": 9, "avgLatencyMs": 18.4, "count": 890 },
    { "dayOfWeek": 1, "hourOfDay": 10, "avgLatencyMs": 22.1, "count": 1240 },
    { "dayOfWeek": 4, "hourOfDay": 15, "avgLatencyMs": 19.7, "count": 1100 },
    { "dayOfWeek": 6, "hourOfDay": 3, "avgLatencyMs": 6.5, "count": 45 }
  ]
}
```

### Response Fields

| Field                  | Type   | Description                                           |
|------------------------|--------|-------------------------------------------------------|
| `period`               | string | The requested time window                             |
| `cells`                | array  | Array of heatmap cell objects                         |
| `cells[].dayOfWeek`    | number | Day of week (0 = Sunday, 6 = Saturday)                |
| `cells[].hourOfDay`    | number | Hour of day in UTC (0–23)                             |
| `cells[].avgLatencyMs` | number | Average gateway evaluation latency for this cell (ms) |
| `cells[].count`        | number | Number of requests in this cell                       |

---

## Error Responses

All analytics endpoints return standard error responses:

| Status | Description                                  |
|--------|----------------------------------------------|
| `401`  | Missing or invalid `X-Admin-Token`           |
| `400`  | Invalid query parameter (e.g., bad `period`) |
| `500`  | Internal server error                        |

```json
{
  "error": "invalid_period",
  "message": "Period must be one of: 24h, 7d, 30d"
}
```
