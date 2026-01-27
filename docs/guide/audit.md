# Audit Logging

MeshGuard captures complete audit trails for compliance and debugging.

## What's Logged

Every request through the gateway logs:

- Timestamp
- Agent ID and name
- Action requested
- Policy decision (allow/deny)
- Policy and rule that matched
- Trace ID for correlation
- Request metadata

## Viewing Logs

### CLI

```bash
# Recent entries
meshguard audit tail -n 20

# Follow in real-time
meshguard audit tail -f

# Query with filters
meshguard audit query \
  --from 2026-01-01 \
  --decision deny \
  --limit 100
```

### API

```bash
curl https://dashboard.meshguard.app/admin/audit?limit=50 \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

### Dashboard

Visit the dashboard at your gateway URL for a visual audit log viewer.

## Trace Correlation

Use trace IDs to follow requests across agents:

```bash
meshguard audit trace trace_abc123
```

Shows all entries with the same trace ID.

## Statistics

```bash
meshguard audit stats --period 24
```

Output:
```
Last 24 hours:
  Total requests: 1,234
  Allowed: 1,100 (89%)
  Denied: 134 (11%)
  
Top denied actions:
  write:email - 45
  delete:* - 32
  admin:* - 28
```

## Retention

By default, audit logs are stored in SQLite. Configure retention with:

```bash
AUDIT_RETENTION_DAYS=90
```

## Analytics Dashboard

Audit data powers the [Analytics Dashboard](/guide/analytics), which aggregates your audit trail into actionable metrics — request volume trends, per-agent breakdowns, policy enforcement rates, delegation tracking, and more. If you're looking for patterns rather than individual log entries, the analytics dashboard is the place to start.
