# MeshGuard Alerting System

MeshGuard can notify you in real-time when policy decisions or errors occur. This helps security teams respond quickly to policy violations and monitor agent behavior.

## Quick Start

1. Configure alert triggers and at least one provider in your environment:

```bash
# Enable alerts on policy denials
export ALERT_ON=deny

# Send to Slack
export ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/T.../B.../xxx
```

2. Test your configuration:

```bash
meshguard alerts test
```

3. View current configuration:

```bash
meshguard alerts config
```

## Alert Triggers

Configure which events trigger alerts with the `ALERT_ON` environment variable:

| Trigger | Description |
|---------|-------------|
| `deny` | Policy denied a request |
| `error` | An error occurred during request processing |
| `rate_limit` | An agent exceeded rate limits |
| `all` | All of the above |

Multiple triggers can be combined:

```bash
ALERT_ON=deny,rate_limit
```

## Alert Providers

### Webhook

Send alerts as JSON to any HTTP endpoint. Useful for custom integrations, PagerDuty, Opsgenie, etc.

```bash
ALERT_WEBHOOK_URL=https://your-endpoint.com/webhook
ALERT_WEBHOOK_SECRET=your-hmac-secret  # Optional
```

**Payload format:**

```json
{
  "event": "meshguard.alert",
  "version": "1.0",
  "id": "alert_abc123",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "severity": "warning",
  "trigger": "deny",
  "title": "Policy Denied: MyAgent",
  "message": "Agent \"MyAgent\" (restricted) was denied access to `write:database`",
  "entry": {
    "traceId": "trace_xyz789",
    "agentId": "agent_123",
    "agentName": "MyAgent",
    "trustTier": "restricted",
    "action": "write:database",
    "method": "POST",
    "path": "/api/database",
    "decision": "deny",
    "policyName": "restricted-policy",
    "reason": "Action write:database not allowed for restricted agents"
  },
  "instance": "meshguard-prod",
  "environment": "production"
}
```

**Request headers:**

- `Content-Type: application/json`
- `User-Agent: MeshGuard/1.0`
- `X-MeshGuard-Event: alert`
- `X-MeshGuard-Trigger: deny`
- `X-MeshGuard-Signature: sha256=...` (if secret configured)

**Signature verification (recommended):**

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

### Slack

Rich alerts with Block Kit formatting, delivered to a Slack channel.

```bash
ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/T.../B.../xxx
```

**Setup:**

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app (or use existing)
3. Enable "Incoming Webhooks"
4. Add a webhook to your desired channel
5. Copy the webhook URL

**Alert appearance:**

```
🚨 Policy Denied: MyAgent
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent "MyAgent" (restricted) was denied access to `write:database`.
Policy: restricted-policy

Agent:      MyAgent (restricted)
Decision:   DENY
Action:     `write:database`
Policy:     restricted-policy
Request:    `POST /api/database`
Trace ID:   `trace_xyz789`

Reason: Action write:database not allowed for restricted agents
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Today at 10:30 AM • meshguard-prod (production)
```

### Email

Send email alerts via SendGrid or SMTP.

**Via SendGrid (recommended):**

```bash
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_FROM=meshguard@yourcompany.com
ALERT_EMAIL_TO=security@yourcompany.com,ops@yourcompany.com
ALERT_SENDGRID_API_KEY=SG.xxxxx
```

**Via SMTP:**

```bash
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_FROM=meshguard@yourcompany.com
ALERT_EMAIL_TO=security@yourcompany.com
ALERT_SMTP_HOST=smtp.yourcompany.com
ALERT_SMTP_PORT=587
ALERT_SMTP_USER=username
ALERT_SMTP_PASS=password
```

> **Note:** SMTP support is a stub in the current version. Use SendGrid for production email alerts.

## Rate Limiting

To prevent alert storms during incidents, MeshGuard rate-limits outgoing alerts:

```bash
ALERT_RATE_LIMIT=10  # Max alerts per minute (default: 10)
```

When the rate limit is exceeded, additional alerts are dropped with a warning logged.

## Instance Identification

Include instance metadata in alerts for multi-deployment environments:

```bash
ALERT_INSTANCE_NAME=meshguard-prod-east
ALERT_ENVIRONMENT=production
```

## CLI Commands

### View Configuration

```bash
meshguard alerts config
```

Shows:
- Configured triggers
- Enabled providers
- Rate limit settings
- Instance identification

### Test Alerts

Send a test alert to verify your configuration:

```bash
meshguard alerts test
```

This sends a clearly-marked test alert to all configured providers.

### List Triggers

```bash
meshguard alerts triggers
```

### List Providers

```bash
meshguard alerts providers
```

## Severity Levels

Alerts include a severity level based on the event:

| Severity | When |
|----------|------|
| `critical` | Errors, or denials involving `unrestricted` agents or admin actions |
| `warning` | Policy denials, rate limit exceeded |
| `info` | Test alerts, informational events |

## Integration Examples

### PagerDuty

Use the webhook provider with PagerDuty's Events API:

```bash
ALERT_WEBHOOK_URL=https://events.pagerduty.com/v2/enqueue
```

You'll need to transform the payload - consider using a middleware like Zapier or a Lambda function.

### Opsgenie

Use the webhook provider with Opsgenie's Alert API:

```bash
ALERT_WEBHOOK_URL=https://api.opsgenie.com/v2/alerts
```

### Custom Logging

Send to your own endpoint for custom processing:

```bash
ALERT_WEBHOOK_URL=https://your-log-aggregator.com/meshguard
ALERT_WEBHOOK_SECRET=shared-secret-for-verification
```

## Best Practices

1. **Start with `deny` only** - Add more triggers as needed to avoid alert fatigue
2. **Use rate limiting** - Default of 10/min is reasonable; adjust based on your traffic
3. **Verify webhooks** - Always use `ALERT_WEBHOOK_SECRET` for production
4. **Test before deploying** - Use `meshguard alerts test` to verify configuration
5. **Monitor alert delivery** - Check logs for failed alert deliveries
6. **Use instance names** - Helps identify which MeshGuard instance generated the alert

## Troubleshooting

### Alerts not sending

1. Check configuration: `meshguard alerts config`
2. Verify triggers are set: `ALERT_ON=deny`
3. Test the connection: `meshguard alerts test`
4. Check logs for errors

### Too many alerts

1. Reduce triggers: `ALERT_ON=deny` (not `all`)
2. Lower rate limit: `ALERT_RATE_LIMIT=5`
3. Consider filtering at the receiver side

### Webhook signature invalid

1. Ensure `ALERT_WEBHOOK_SECRET` matches on both sides
2. Verify you're comparing the raw request body (not parsed JSON)
3. Use timing-safe comparison to prevent timing attacks
