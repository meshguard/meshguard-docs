# OpenTelemetry Integration

MeshGuard supports distributed tracing via OpenTelemetry (OTEL). When enabled, the gateway emits spans for policy evaluations, audit log writes, and delegation chain checks. These spans integrate with any OTLP-compatible backend -- Jaeger, Grafana Tempo, Honeycomb, Datadog, and more.

OTEL is opt-in and disabled by default. When off, there is zero performance overhead: the global no-op tracer produces no-op spans.

## Setup

### Environment Variables

```bash
# Enable OpenTelemetry tracing
OTEL_ENABLED=true

# OTLP HTTP endpoint (default: http://localhost:4318)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Service name reported in traces (default: meshguard-gateway)
OTEL_SERVICE_NAME=meshguard-gateway
```

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_ENABLED` | `false` | Master switch. Set to `true` to enable tracing. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTLP HTTP endpoint. MeshGuard appends `/v1/traces` automatically. |
| `OTEL_SERVICE_NAME` | `meshguard-gateway` | The `service.name` resource attribute reported in all spans. |

### Quick Start with Jaeger

Run Jaeger locally and enable OTEL in MeshGuard:

```bash
# Start Jaeger with OTLP ingestion
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest

# Enable OTEL in MeshGuard
export OTEL_ENABLED=true
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=meshguard-gateway

# Start MeshGuard
meshguard start
```

Open `http://localhost:16686` to view traces in the Jaeger UI.

### Grafana Tempo

```bash
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo.internal:4318
OTEL_SERVICE_NAME=meshguard-prod
```

### Honeycomb

```bash
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
OTEL_SERVICE_NAME=meshguard-gateway
# Honeycomb requires the API key in OTLP headers
OTEL_EXPORTER_OTLP_HEADERS="x-honeycomb-team=your-api-key"
```

### Datadog

```bash
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=meshguard-gateway
# Datadog Agent must be configured to accept OTLP on port 4318
```

## Traced Operations

MeshGuard creates spans for three key operations:

### Policy Evaluation

**Span name:** `meshguard.policy.evaluate`

Created for every policy evaluation. Records the agent, action, decision, matching policy, and reason.

| Attribute | Type | Description |
|-----------|------|-------------|
| `meshguard.agent_id` | string | The agent being evaluated |
| `meshguard.action` | string | The requested action |
| `meshguard.decision` | string | `allow` or `deny` |
| `meshguard.policy_name` | string | Name of the matching policy |
| `meshguard.reason` | string | Human-readable reason for the decision |

### Audit Log Write

**Span name:** `meshguard.audit.write`

Created when an entry is written to the audit log.

| Attribute | Type | Description |
|-----------|------|-------------|
| `meshguard.agent_id` | string | The agent being audited |
| `meshguard.action` | string | The audited action |
| `meshguard.decision` | string | `allow` or `deny` |
| `meshguard.trace_id` | string | MeshGuard's internal trace ID |

### Delegation Chain Check

**Span name:** `meshguard.delegation.check`

Created when a delegation chain is validated.

| Attribute | Type | Description |
|-----------|------|-------------|
| `meshguard.delegation.depth` | number | Current depth of the chain |
| `meshguard.delegation.parent_id` | string | Parent delegation receipt ID |
| `meshguard.delegation.agent_id` | string | The agent whose chain is being validated |

## W3C Trace Context

MeshGuard respects and propagates the [W3C Trace Context](https://www.w3.org/TR/trace-context/) standard. When an inbound request includes a `traceparent` header, MeshGuard's spans are linked to the upstream trace. When MeshGuard makes outbound requests (e.g., webhook alerts), it propagates the `traceparent` header downstream.

This enables end-to-end distributed tracing across your full AI agent pipeline:

```
Client → Agent Framework → MeshGuard Gateway → Downstream Service
  └─ traceparent propagated through the entire chain ─┘
```

## Resource Attributes

All spans include these resource attributes:

| Attribute | Value |
|-----------|-------|
| `service.name` | Value of `OTEL_SERVICE_NAME` (default: `meshguard-gateway`) |
| `service.version` | The MeshGuard version (e.g., `1.3.0`) |

## Initialization

MeshGuard initializes OTEL at startup. The SDK is dynamically imported only when `OTEL_ENABLED=true`, ensuring zero overhead when tracing is off:

```typescript
import { initTelemetry, shutdownTelemetry } from './telemetry/otel';

// At startup
await initTelemetry();

// At graceful shutdown (flushes pending spans)
await shutdownTelemetry();
```

## Programmatic Tracing

You can add custom spans around your own operations using the MeshGuard tracer:

```typescript
import { getTracer, isOtelEnabled } from './telemetry/otel';

if (isOtelEnabled()) {
  const tracer = getTracer('my-custom-module');
  tracer.startActiveSpan('my.custom.operation', (span) => {
    span.setAttribute('my.custom.attribute', 'value');
    try {
      // Your operation here
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}
```

The built-in span helpers in `telemetry/spans.ts` provide zero-overhead wrappers that automatically check `isOtelEnabled()` and produce no-op calls when tracing is off:

```typescript
import { tracePolicyCheck, traceAuditLog, traceDelegationCheck } from './telemetry/spans';

// Wrap a policy evaluation
const result = tracePolicyCheck(agentId, action, () => {
  return evaluatePolicy(agent, action);
});

// Wrap an audit write
traceAuditLog(entry, () => {
  logAudit(entry);
});

// Wrap a delegation check
const chainResult = traceDelegationCheck({ depth: 2, agentId }, () => {
  return validateDelegationChain(agentId, scope);
});
```

## Troubleshooting

### Traces not appearing

1. Verify OTEL is enabled: check startup log for `OpenTelemetry tracing enabled (exporter: ...)`
2. Confirm the endpoint is reachable: `curl http://localhost:4318/v1/traces`
3. Check that the backend is configured to accept OTLP HTTP (not gRPC, which uses port 4317)
4. Look for SDK errors in the MeshGuard logs

### High cardinality warnings

MeshGuard uses bounded attribute values (agent IDs, action names, decision enums). If your tracing backend warns about high cardinality, check whether custom spans are adding unbounded attributes.

### Performance impact

When enabled, OTEL adds approximately 0.1-0.5ms per request for span creation and attribute setting. Spans are batched and exported asynchronously, so the impact on request latency is minimal. When disabled (`OTEL_ENABLED=false`), there is zero overhead.

## Best Practices

1. **Enable in staging first** -- Validate your tracing pipeline before turning on OTEL in production.
2. **Use sampling in production** -- If request volume is high, configure your OTEL collector with tail-based or head-based sampling.
3. **Set a meaningful service name** -- Use environment-specific names like `meshguard-prod-east` to distinguish instances.
4. **Correlate with audit logs** -- The `meshguard.trace_id` span attribute links back to MeshGuard's audit log, enabling cross-referencing between traces and audit entries.
5. **Shut down gracefully** -- Always call `shutdownTelemetry()` on process exit to flush pending spans.
6. **Use the span helpers** -- Prefer `tracePolicyCheck`, `traceAuditLog`, and `traceDelegationCheck` over manual span creation for consistent attributes.
