# Agent Discovery

MeshGuard's discovery module finds and tracks AI service usage across your enterprise, including unauthorized "shadow AI" that bypasses governance controls. It integrates with network proxies, SIEM systems, API gateways, and MeshGuard agents to provide a comprehensive view of which AI services are in use, who is using them, and whether they comply with your policies.

## Architecture

The discovery system has four layers:

1. **Connectors** -- Data source integrations that ingest traffic events (proxy logs, SIEM, API gateways, agent reports).
2. **Registry** -- A database of known AI services with domain patterns, risk profiles, and compliance flags.
3. **Scanner** -- The orchestrator that runs discovery scans, matches traffic to known services, and triggers enforcement.
4. **Enforcement** -- Integration with the MeshGuard policy engine to block, warn, or log discovered AI usage.

```
Proxy Logs ─┐
SIEM ───────┤
API Gateway ┤──→ Connectors ──→ Scanner ──→ Registry Match ──→ Enforcement
Agents ─────┘                                    ↓
                                           Discovery DB
```

## Connectors

MeshGuard ships with four built-in connector types:

### Proxy Log Connector

Parses logs from corporate proxies (Squid, Zscaler, BlueCoat).

```typescript
{
  id: 'corp-proxy',
  name: 'Corporate Proxy',
  type: 'proxy-log',
  enabled: true,
  config: {
    logPath: '/var/log/squid/access.log'
  },
  syncIntervalMinutes: 15
}
```

### API Gateway Connector

Ingests logs from API gateways (Kong, Apigee, AWS API Gateway).

```typescript
{
  id: 'api-gw',
  name: 'API Gateway',
  type: 'api',
  enabled: true,
  config: {
    endpoint: 'https://kong-admin.internal:8001',
    apiKey: 'your-api-key'
  },
  syncIntervalMinutes: 10
}
```

### SIEM Connector

Pulls events from SIEM systems. Supports Splunk and Elasticsearch natively.

```typescript
{
  id: 'siem-splunk',
  name: 'Splunk SIEM',
  type: 'siem',
  enabled: true,
  config: {
    endpoint: 'https://splunk.internal:8089',
    apiKey: 'your-splunk-token',
    siemType: 'splunk'
  },
  syncIntervalMinutes: 30
}
```

**Splunk** -- Searches the `proxy` index for traffic to known AI service domains and extracts source IP, destination host, path, and byte counts.

**Elasticsearch** -- Queries `proxy-*` indices with wildcard domain matches and returns structured traffic events.

### Agent Report Connector

Receives real-time reports from MeshGuard agents about AI service access. This connector requires no external configuration -- agents report directly.

```typescript
{
  id: 'agent-reports',
  name: 'Agent Reports',
  type: 'agent',
  enabled: true,
  config: {},
  syncIntervalMinutes: 5
}
```

## Known AI Service Registry

MeshGuard includes a built-in registry of 25+ known AI services across nine categories:

| Category | Services |
|----------|----------|
| `llm` | ChatGPT, OpenAI API, Claude, Anthropic API, Google Gemini, Mistral AI, Cohere |
| `code-assistant` | GitHub Copilot, Cursor, Tabnine, Codeium, Amazon CodeWhisperer, Sourcegraph Cody |
| `image-gen` | DALL-E, Midjourney, Stability AI, Leonardo.AI |
| `voice` | ElevenLabs, Murf AI, AssemblyAI |
| `automation` | Zapier AI, Make AI, n8n AI |
| `analytics` | Databricks AI, Snowflake Cortex |
| `search` | Perplexity |

Each service entry includes:

- **Domain patterns** -- Exact and wildcard matches (e.g., `api.openai.com`, `*.cloud.databricks.com`)
- **Path patterns** -- Endpoint-specific matching (e.g., `/v1/chat/completions`)
- **Header signatures** -- API key format detection (e.g., `sk-*`, `sk-ant-*`)
- **Risk assessment** -- Default risk level, data exfiltration risk, code execution risk
- **Compliance flags** -- Relevant standards (SOC2, HIPAA, GDPR, FedRAMP, ISO27001)

### Adding Custom Services

Register additional AI services specific to your environment:

```typescript
import { addCustomService } from './discovery';

addCustomService({
  id: 'internal-llm',
  name: 'Internal LLM',
  vendor: 'YourCompany',
  category: 'llm',
  domains: ['llm.internal.company.com'],
  pathPatterns: ['/v1/generate', '/v1/chat'],
  defaultRisk: 'low',
  dataExfiltrationRisk: false,
  codeExecutionRisk: false,
  complianceFlags: ['SOC2'],
  description: 'Self-hosted internal LLM service',
});
```

## Shadow AI Detection

Shadow AI refers to unauthorized use of AI services that bypasses your governance controls. MeshGuard detects shadow AI by:

1. **Matching network traffic** -- Connectors capture outbound traffic and the scanner matches destination hosts against the registry.
2. **Classifying risk** -- Each discovery is assigned a risk level based on the matched service's profile.
3. **Tracking status** -- Discoveries move through a lifecycle: `discovered` > `monitoring` / `sanctioned` / `blocked` / `retired`.

### Discovery Statuses

| Status | Description |
|--------|-------------|
| `discovered` | Newly found, not yet reviewed |
| `sanctioned` | Reviewed and approved for use |
| `blocked` | Explicitly blocked by policy |
| `monitoring` | Under observation, not yet decided |
| `retired` | Previously active, now inactive |

### Risk Levels

| Risk | Description |
|------|-------------|
| `critical` | Immediate action required. High data exfiltration and compliance risk. |
| `high` | Significant risk. Code execution possible, sensitive data exposure likely. |
| `medium` | Moderate risk. Data exfiltration possible but service has compliance certifications. |
| `low` | Minimal risk. Limited data exposure, well-known vendor. |
| `unknown` | Unclassified. Needs manual review. |

## Running Scans

### On-Demand Scan

```typescript
import { runScan } from './discovery';

const result = await runScan({
  connectorIds: ['siem-splunk', 'corp-proxy'],
  timeRange: {
    from: new Date('2026-04-21'),
    to: new Date('2026-04-22'),
  },
  orgId: 'org_abc',
  fullScan: false,  // Incremental scan
});
```

**Scan result:**

```json
{
  "id": "scan_abc123",
  "startedAt": "2026-04-22T10:00:00.000Z",
  "completedAt": "2026-04-22T10:00:45.000Z",
  "status": "success",
  "newDiscoveries": 3,
  "updatedDiscoveries": 12,
  "totalServicesFound": 8,
  "criticalFindings": 0,
  "highRiskFindings": 2,
  "connectorResults": [
    { "connectorId": "siem-splunk", "status": "success", "recordsProcessed": 4521 },
    { "connectorId": "corp-proxy", "status": "success", "recordsProcessed": 1203 }
  ]
}
```

### Periodic Scans

Enable automatic periodic scanning:

```typescript
import { startPeriodicScans, stopPeriodicScans } from './discovery';

// Scan every 60 minutes
startPeriodicScans(60);

// Stop periodic scanning
stopPeriodicScans();
```

### Real-Time Agent Events

Agents can report AI service access in real time without waiting for the next scan cycle:

```typescript
import { ingestAgentEvent } from './discovery';

const discovery = ingestAgentEvent({
  agentId: 'agent_123',
  destinationHost: 'api.openai.com',
  destinationPath: '/v1/chat/completions',
  bytesSent: 4096,
  orgId: 'org_abc',
});

if (discovery) {
  console.log(`Detected: ${discovery.serviceName} (${discovery.risk} risk)`);
}
```

## Policy Enforcement

When a new AI service is discovered through an agent, MeshGuard automatically evaluates it against the agent's policy:

- Actions are formatted as `ai:{category}:{service-id}` (e.g., `ai:llm:openai-api`)
- The policy engine returns `allow`, `deny`, or a default
- The enforcement result is recorded as an `EnforcementEvent` and logged in the audit trail

Enforcement actions:

| Action | When Applied |
|--------|-------------|
| `block` | Policy explicitly denies the AI service |
| `allow` | Policy allows and the service is sanctioned |
| `warn` | Policy allows but the service is not yet sanctioned |
| `log` | Default action for unmatched policies |

::: tip
Create policy rules using the `ai:*` action prefix to control AI service access. For example, `ai:code-assistant:*` matches all code assistant services.
:::

## Sanctioning and Blocking

### Sanction a Service

Mark a discovered service as approved:

```typescript
import { sanctionService } from './discovery';

sanctionService('disc_abc123', 'admin@company.com', 'Approved for engineering team');
```

### Block a Service

Explicitly block a discovered service:

```typescript
import { blockService } from './discovery';

blockService('disc_xyz789', 'admin@company.com', 'Not compliant with HIPAA requirements');
```

## Summary Dashboard

Get a quick overview of your organization's shadow AI posture:

```typescript
import { getShadowAISummary } from './discovery';

const summary = getShadowAISummary('org_abc');
```

The summary includes:

- **Discovery statistics** -- Total discoveries, active/sanctioned/blocked counts, by category and risk
- **Recent discoveries** -- Last 10 discovered services
- **Unreviewed count** -- How many discoveries are still in `discovered` status
- **High-risk count** -- Count of critical and high-risk discoveries that are not yet blocked

## Initialization

Initialize the discovery module at application startup:

```typescript
import { initDiscovery } from './discovery';

initDiscovery({
  dbPath: '/var/data/meshguard/discovery.db',
  enablePeriodicScans: true,
  scanIntervalMinutes: 60,
});
```

## Best Practices

1. **Start with SIEM and proxy connectors** -- These provide the broadest visibility into AI service usage across the enterprise.
2. **Enable agent reporting** -- Real-time agent events catch AI usage that batch scans might miss.
3. **Review discoveries promptly** -- Unreviewed discoveries are a blind spot. Assign someone to triage new findings weekly.
4. **Sanction approved services explicitly** -- A sanctioned service will not trigger warnings in enforcement. This reduces noise.
5. **Create AI-specific policies** -- Use `ai:*` action patterns in your MeshGuard policies to control which agents can access which AI services.
6. **Monitor high-risk services** -- Set up alerts for discoveries with `critical` or `high` risk levels.
7. **Add custom services** -- Register internal AI services and industry-specific tools that are not in the built-in registry.
