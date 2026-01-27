# Analytics Dashboard

The MeshGuard Analytics Dashboard gives you a real-time view of how your governance control plane is performing — from request volume and policy enforcement to agent behavior and delegation patterns.

## Why Analytics Matter

Running a governance layer without visibility is like flying blind. The Analytics Dashboard helps you:

- **Spot anomalies** — sudden spikes in denied requests, unexpected agents, or latency regressions
- **Audit compliance** — verify that enforcement rates meet your organization's requirements
- **Optimize policies** — identify overly permissive or overly restrictive rules
- **Understand delegation** — see how trust flows through agent chains
- **Plan capacity** — use latency and volume trends to right-size your deployment

## Accessing the Dashboard

1. Navigate to [dashboard.meshguard.app](https://dashboard.meshguard.app)
2. Sign in using your Admin Token (the same `X-Admin-Token` used for the [Admin API](/api/admin))
3. Select the **Analytics** tab in the left sidebar

All data is automatically scoped to your organization — you only see metrics for your own agents and policies.

::: tip
You can also query all analytics data programmatically via the [Analytics API](/api/analytics).
:::

## Dashboard Sections

### Overview Stats

The top of the dashboard shows four key metrics for the selected time period:

- **Total Requests** — how many governance evaluations the gateway processed
- **Enforcement Rate** — percentage of requests that matched a policy rule (aim for close to 100%)
- **Active Agents** — number of agents that made at least one request
- **Avg Latency** — average time for the gateway to evaluate a request

Each metric includes a **trend indicator** comparing to the prior equivalent period. A green arrow means improvement; red means regression.

**What to look for:**
- An enforcement rate below 90% may indicate agents performing actions not covered by your policies
- A sudden drop in active agents could signal connectivity or deployment issues
- Rising latency suggests policy complexity is growing or infrastructure needs scaling

### Timeseries Chart

The timeseries chart plots **allowed vs. denied requests** over time, with toggleable granularity:

- **Hourly buckets** for the 24h view — great for spotting intraday patterns
- **Daily buckets** for 7d and 30d views — better for trends

**What to look for:**
- Consistent deny spikes at specific times may correlate with batch jobs or scheduled agents
- A gradual increase in denials after a policy change confirms stricter enforcement
- Gaps in the timeline indicate periods with no agent activity

### Agent Leaderboard

A ranked table of agents showing:

| Column      | Description                                      |
|-------------|--------------------------------------------------|
| Name        | Agent display name                               |
| Trust Tier  | Current trust level (sandboxed → privileged)     |
| Requests    | Total requests in the period                     |
| Allowed     | Number of allowed requests                       |
| Denied      | Number of denied requests                        |
| Avg Latency | Average evaluation time                          |
| Last Active | When the agent last made a request               |

You can sort by **requests**, **denied count**, or **latency** using the column headers.

**What to look for:**
- Agents with a high denial rate may need their trust tier reviewed or their policies updated
- Sandboxed agents with many requests might be ready for promotion to verified
- Agents with abnormally high latency may be triggering complex policy chains

### Policy Enforcement

Shows each policy and how it performed:

- **Triggered** — how many times the policy was evaluated
- **Allow Rate / Deny Rate** — the breakdown of decisions
- **Top Action** — the most common action that triggered this policy

**What to look for:**
- A policy that is never triggered may be redundant — consider cleaning it up
- A policy with 100% deny rate and high trigger count might be too restrictive
- The top action field helps you understand *what* agents are actually trying to do

### Trust Distribution

A breakdown of your agent population by trust tier, showing:

- How many agents are in each tier
- What percentage of total requests each tier generates
- Volume distribution across tiers

**What to look for:**
- If most traffic comes from sandboxed agents, you may want to audit and promote agents that have proven reliable
- A healthy deployment typically has a pyramid shape: many sandboxed, fewer verified, few trusted, very few privileged
- An unexpectedly high percentage from privileged agents might indicate over-promotion

### Delegation Tracking

Delegation analytics reveal how agents hand off authority to other agents:

- **Total Chains** — number of delegation events observed
- **Avg Depth** — average chain length (1 = direct delegation, 2+ = nested)
- **Blocked Chains** — delegations denied by policy
- **Top Pairs** — the most common delegation relationships

**What to look for:**
- High average depth (3+) suggests complex trust chains that could be simplified
- Blocked chains indicate agents attempting delegations that your policies disallow — review whether those blocks are intentional
- The top pairs table reveals your system's actual dependency graph between agents

### Latency Heatmap

A day-of-week × hour-of-day heatmap showing average gateway latency. Each cell represents a time slot, colored by latency intensity.

- **Rows**: Days of the week (Sunday–Saturday)
- **Columns**: Hours of the day (0–23, UTC)
- **Color**: Ranges from cool (low latency) to hot (high latency)

**What to look for:**
- Hot spots during business hours are expected — monitor for unexpected off-hours spikes
- Consistently hot cells may indicate heavy batch processing windows
- Use cold zones to plan maintenance windows or policy deployments

## Using Time Range Filters

All dashboard sections share a global time range filter at the top of the page:

| Period | Best For                          |
|--------|-----------------------------------|
| **24h** | Real-time monitoring, incident response |
| **7d**  | Weekly patterns, recent changes   |
| **30d** | Trends, capacity planning, reports |

Changing the period updates all sections simultaneously. Trend comparisons always reference the equivalent prior period (e.g., 7d compares to the preceding 7 days).

## Tips for Interpreting Data

### High Denial Rate

A denial rate above 15–20% deserves investigation:

1. Check the **Agent Leaderboard** to see which agents are being denied most
2. Look at the **Policy Enforcement** section to identify which policies are generating denials
3. Cross-reference with the [Audit Log](/guide/audit) for specific denied requests

Common causes: new agents without appropriate trust tiers, policy changes that are stricter than intended, or agents attempting actions outside their scope.

### Delegation Chain Issues

If you see a high number of blocked chains:

1. Check **Delegation Tracking** for the top blocked pairs
2. Review your delegation policies — you may need to explicitly allow certain delegation paths
3. Consider whether deep chains (depth 3+) indicate architectural issues that could be resolved with direct trust

### Latency Spikes

If average latency exceeds your SLA:

1. Use the **Latency Heatmap** to identify when spikes occur
2. Check the **Timeseries** for corresponding request volume spikes
3. Review policy complexity — deeply nested or regex-heavy rules increase evaluation time
4. Consider [self-hosting](/guide/self-hosted) closer to your agents if network latency is a factor

### Low Enforcement Rate

An enforcement rate below 100% means some requests are passing through without matching any policy rule. This isn't necessarily bad — it depends on your default action:

- **Default allow**: Unmatched requests are allowed. A lower enforcement rate means agents are performing uncovered actions.
- **Default deny**: Unmatched requests are denied. Enforcement rate should naturally be high.

Review unmatched actions in the [Audit Log](/guide/audit) and decide whether they need explicit policy coverage.
