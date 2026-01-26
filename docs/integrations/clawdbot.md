---
title: "Clawdbot Integration"
description: "Full technical reference for integrating MeshGuard governance with Clawdbot AI agents"
---

# Clawdbot Integration

Integrate MeshGuard's governance control plane with [Clawdbot](https://clawd.bot) agents to enforce policies on every skill invocation — email, calendar, messaging, file access, web browsing, and more.

## Installation

Install the MeshGuard Python SDK:

```bash
pip install meshguard
```

Or with all optional dependencies:

```bash
pip install meshguard[all]
```

## Configuration

### Environment Variables

Set these in your Clawdbot environment (`.env` or shell profile):

```bash
export MESHGUARD_API_KEY="mg_live_abc123..."
export MESHGUARD_GATEWAY_URL="https://dashboard.meshguard.app"
```

| Variable | Required | Description |
|----------|----------|-------------|
| `MESHGUARD_API_KEY` | Yes | Agent API key from the MeshGuard dashboard |
| `MESHGUARD_GATEWAY_URL` | Yes | Gateway URL (cloud or self-hosted) |
| `MESHGUARD_AGENT_NAME` | No | Override agent name (defaults to hostname) |
| `MESHGUARD_TRACE_HEADER` | No | Custom trace ID header name |
| `MESHGUARD_TIMEOUT` | No | Request timeout in seconds (default: `10`) |
| `MESHGUARD_MODE` | No | `enforce` (default) or `audit` (log-only, never block) |

### clawdbot.json Configuration

Add the MeshGuard block to your `clawdbot.json`:

```json
{
  "meshguard": {
    "enabled": true,
    "gatewayUrl": "https://dashboard.meshguard.app",
    "apiKey": "${MESHGUARD_API_KEY}",
    "mode": "enforce",
    "auditAll": true,
    "skills": {
      "email": {
        "actions": ["read:email", "write:email", "delete:email"],
        "defaultEffect": "deny"
      },
      "calendar": {
        "actions": ["read:calendar", "write:calendar"],
        "defaultEffect": "allow"
      },
      "messaging": {
        "actions": ["send:message", "read:message"],
        "defaultEffect": "deny"
      },
      "file-access": {
        "actions": ["read:file", "write:file", "delete:file"],
        "defaultEffect": "deny"
      },
      "web-browsing": {
        "actions": ["browse:web", "fetch:url"],
        "defaultEffect": "allow"
      }
    },
    "webhook": {
      "url": "https://your-server.com/meshguard/alerts",
      "events": ["deny", "escalation"],
      "secret": "${MESHGUARD_WEBHOOK_SECRET}"
    }
  }
}
```

## Wrapping Skills with Policy Checks

### Before: Unguarded Skill

```python
# ❌ No governance — any agent can send any email
async def send_email(to: str, subject: str, body: str):
    smtp = get_smtp_client()
    smtp.send(to=to, subject=subject, body=body)
    return {"status": "sent", "to": to}
```

### After: MeshGuard-Governed Skill

```python
from meshguard import MeshGuardClient, PolicyDeniedError

client = MeshGuardClient()

# ✅ Policy-checked — blocked if not allowed
async def send_email(to: str, subject: str, body: str):
    try:
        client.enforce("write:email", resource=to, context={
            "subject": subject,
            "recipient_domain": to.split("@")[1],
        })
    except PolicyDeniedError as e:
        return {
            "status": "denied",
            "reason": e.reason,
            "policy": e.policy,
            "trace_id": e.trace_id,
        }

    smtp = get_smtp_client()
    smtp.send(to=to, subject=subject, body=body)

    # Log successful action
    client.audit_log("write:email", decision="allow", metadata={
        "to": to,
        "subject": subject,
    })

    return {"status": "sent", "to": to}
```

### Using the `govern` Context Manager

For cleaner code, use the context manager:

```python
async def read_contacts():
    with client.govern("read:contacts") as decision:
        contacts = db.query("SELECT * FROM contacts")
        return {"contacts": contacts, "trace_id": decision.trace_id}
```

### Decorator Pattern

Wrap entire skill functions with a decorator:

```python
from meshguard import governed

@governed("write:email")
async def send_email(to: str, subject: str, body: str):
    """This function only executes if the policy allows write:email."""
    smtp = get_smtp_client()
    smtp.send(to=to, subject=subject, body=body)
    return {"status": "sent"}
```

## Audit Logging

MeshGuard automatically logs every policy check. You can also emit custom audit entries:

```python
# Automatic — every enforce() / check() call is logged

# Manual audit entry
client.audit_log(
    action="custom:data-export",
    decision="allow",
    metadata={
        "format": "csv",
        "rows": 1500,
        "destination": "s3://exports/",
        "initiated_by": "clawdbot-agent-1",
    }
)
```

### Querying Audit Logs

```python
# Get recent denials
denials = client.get_audit_log(limit=50, decision="deny")

for entry in denials:
    print(f"{entry['timestamp']}: {entry['action']} → {entry['decision']}")
    print(f"  Agent: {entry['agentId']}")
    print(f"  Policy: {entry['policy']}")
    print(f"  Reason: {entry['reason']}")
```

### Viewing Logs via CLI

```bash
# Tail audit log in real-time
meshguard audit tail -f

# Filter by agent
meshguard audit query --agent clawdbot-prod --decision deny --limit 20

# Export for compliance
meshguard audit export --from 2026-01-01 --to 2026-01-31 --format csv > audit.csv
```

## Policy YAML Examples

### Email Skill

```yaml
name: clawdbot-email-policy
version: "1.0"
description: Email governance for Clawdbot agents

appliesTo:
  tags:
    - clawdbot
    - email-enabled

rules:
  # Allow reading emails
  - effect: allow
    actions:
      - "read:email"

  # Allow sending to internal domains only
  - effect: allow
    actions:
      - "write:email"
    conditions:
      resource:
        matches: "*@yourcompany.com"

  # Deny sending to external domains
  - effect: deny
    actions:
      - "write:email"
    reason: "External email requires approval"

  # Never allow deleting emails
  - effect: deny
    actions:
      - "delete:email"
    reason: "Email deletion is prohibited"

defaultEffect: deny
```

### Calendar Skill

```yaml
name: clawdbot-calendar-policy
version: "1.0"
description: Calendar governance for Clawdbot agents

appliesTo:
  tags:
    - clawdbot

rules:
  - effect: allow
    actions:
      - "read:calendar"

  - effect: allow
    actions:
      - "write:calendar"
    conditions:
      context:
        event_type:
          in: ["meeting", "reminder"]

  - effect: deny
    actions:
      - "write:calendar"
    conditions:
      context:
        event_type: "all-day"
    reason: "All-day events require manual creation"

  - effect: deny
    actions:
      - "delete:calendar"
    reason: "Calendar deletion is prohibited"

defaultEffect: deny
```

### Messaging Skill

```yaml
name: clawdbot-messaging-policy
version: "1.0"
description: Messaging governance for Clawdbot agents

appliesTo:
  tags:
    - clawdbot
    - messaging

rules:
  - effect: allow
    actions:
      - "read:message"

  - effect: allow
    actions:
      - "send:message"
    conditions:
      context:
        channel:
          in: ["telegram", "slack", "discord"]

  - effect: deny
    actions:
      - "send:message"
    conditions:
      context:
        channel: "sms"
    reason: "SMS sending requires explicit approval"

defaultEffect: deny
```

### File Access Skill

```yaml
name: clawdbot-file-policy
version: "1.0"
description: File access governance for Clawdbot agents

appliesTo:
  tags:
    - clawdbot

rules:
  - effect: allow
    actions:
      - "read:file"
    conditions:
      resource:
        matches: "/workspace/*"

  - effect: allow
    actions:
      - "write:file"
    conditions:
      resource:
        matches: "/workspace/output/*"

  - effect: deny
    actions:
      - "read:file"
      - "write:file"
    conditions:
      resource:
        matches: "/etc/*"
    reason: "System file access is prohibited"

  - effect: deny
    actions:
      - "delete:file"
    reason: "File deletion requires manual approval"

defaultEffect: deny
```

### Web Browsing Skill

```yaml
name: clawdbot-web-policy
version: "1.0"
description: Web browsing governance for Clawdbot agents

appliesTo:
  tags:
    - clawdbot

rules:
  - effect: allow
    actions:
      - "browse:web"
      - "fetch:url"

  - effect: deny
    actions:
      - "browse:web"
      - "fetch:url"
    conditions:
      resource:
        matches:
          - "*.onion"
          - "*.darkweb.*"
    reason: "Blocked domain category"

defaultEffect: allow
```

## Applying Policies

```bash
# Apply a single policy
meshguard policy apply ./clawdbot-email-policy.yaml

# Apply all policies from a directory
meshguard policy apply ./policies/

# Test a policy without applying
meshguard policy test clawdbot-agent-1 write:email --resource "user@external.com"
# Output: DENY (rule: deny-external-email, policy: clawdbot-email-policy)
```

## Webhook Alerts for Denied Actions

Configure webhook notifications for denied actions:

```json
{
  "meshguard": {
    "webhook": {
      "url": "https://your-server.com/meshguard/alerts",
      "events": ["deny", "escalation", "anomaly"],
      "secret": "whsec_abc123...",
      "headers": {
        "X-Custom-Header": "value"
      }
    }
  }
}
```

### Webhook Payload

When an action is denied, MeshGuard sends:

```json
{
  "event": "deny",
  "timestamp": "2026-01-26T17:30:00.000Z",
  "agent": {
    "id": "agent_abc123",
    "name": "clawdbot-prod",
    "trustTier": "verified"
  },
  "action": "write:email",
  "resource": "user@external.com",
  "policy": "clawdbot-email-policy",
  "rule": "deny-external-email",
  "reason": "External email requires approval",
  "traceId": "trace_xyz789",
  "context": {
    "subject": "Sales outreach",
    "recipient_domain": "external.com"
  }
}
```

### Webhook Signature Verification

```python
import hmac
import hashlib

def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
```

## Full Integration Example

```python
from meshguard import MeshGuardClient, PolicyDeniedError
import logging

logger = logging.getLogger("clawdbot.meshguard")

# Initialize once at startup
client = MeshGuardClient(
    gateway_url="https://dashboard.meshguard.app",
    agent_token="mg_live_abc123...",
)

class GovernedSkillMixin:
    """Mixin to add MeshGuard governance to any Clawdbot skill."""

    def check_permission(self, action: str, resource: str = None, **context):
        """Check permission before executing a skill action."""
        decision = client.check(action, resource=resource, context=context)

        if not decision.allowed:
            logger.warning(
                "Action denied: %s on %s — %s (policy: %s, trace: %s)",
                action, resource, decision.reason, decision.policy, decision.trace_id,
            )

        return decision

    def enforce_permission(self, action: str, resource: str = None, **context):
        """Enforce permission — raises PolicyDeniedError if denied."""
        client.enforce(action, resource=resource, context=context)


class EmailSkill(GovernedSkillMixin):
    async def send(self, to: str, subject: str, body: str):
        self.enforce_permission("write:email", resource=to, subject=subject)
        # ... send email ...
        return {"status": "sent", "to": to}

    async def read(self, folder: str = "inbox"):
        self.enforce_permission("read:email", resource=folder)
        # ... read emails ...
        return {"emails": [...]}


class CalendarSkill(GovernedSkillMixin):
    async def create_event(self, title: str, start: str, end: str):
        self.enforce_permission("write:calendar", resource=title,
                                event_type="meeting")
        # ... create event ...
        return {"status": "created"}


class FileSkill(GovernedSkillMixin):
    async def read_file(self, path: str):
        self.enforce_permission("read:file", resource=path)
        # ... read file ...
        return {"content": "..."}

    async def write_file(self, path: str, content: str):
        self.enforce_permission("write:file", resource=path)
        # ... write file ...
        return {"status": "written"}
```

## Troubleshooting

### Connection Errors

```
meshguard.errors.ConnectionError: Failed to connect to gateway
```

- Verify `MESHGUARD_GATEWAY_URL` is correct and reachable
- Check firewall rules allow outbound HTTPS on port 443
- For self-hosted: ensure the gateway container is running (`docker ps`)
- Test connectivity: `curl https://dashboard.meshguard.app/health`

### Authentication Failures

```
meshguard.errors.AuthenticationError: Invalid or expired token
```

- Regenerate API key from the [MeshGuard dashboard](https://dashboard.meshguard.app)
- Ensure `MESHGUARD_API_KEY` is set correctly (no trailing whitespace)
- Check that the agent hasn't been revoked: `meshguard agent list`

### Unexpected Denials

```
meshguard.errors.PolicyDeniedError: Denied by rule: default-deny
```

- Run `meshguard policy test <agent-id> <action>` to debug
- Check policy ordering — rules are evaluated top-to-bottom, first match wins
- Verify `appliesTo` tags match the agent's tags
- Review audit log: `meshguard audit query --agent <name> --decision deny`

### Audit Mode (No Enforcement)

To test policies without blocking actions, set mode to `audit`:

```bash
export MESHGUARD_MODE=audit
```

Or in `clawdbot.json`:

```json
{
  "meshguard": {
    "mode": "audit"
  }
}
```

In audit mode, all actions are allowed but denials are still logged. Review logs to tune policies before switching to `enforce`.

### Gateway Health Check

```bash
curl https://dashboard.meshguard.app/health
```

Expected response:

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "mode": "enforce"
}
```

## Related

- [Python SDK](/integrations/python) — Full Python SDK reference
- [JavaScript SDK](/integrations/javascript) — JavaScript/TypeScript SDK
- [Policies](/guide/policies) — Policy format and syntax
- [Audit Logging](/guide/audit) — Audit log configuration and queries
- [Alerting](/guide/alerting) — Alert rules and notification channels
- [Self-Hosted Deployment](/guide/self-hosted) — Run MeshGuard on your own infrastructure
