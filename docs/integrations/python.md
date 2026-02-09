# Python SDK

The official MeshGuard Python SDK for governing AI agents.

[![PyPI version](https://badge.fury.io/py/meshguard.svg)](https://pypi.org/project/meshguard/)

## Installation

```bash
pip install meshguard
```

With LangChain support:

```bash
pip install meshguard[langchain]
```

## Quick Start

```python
from meshguard import MeshGuardClient

# Initialize client
client = MeshGuardClient(
    gateway_url="https://dashboard.meshguard.app",
    agent_token="your-agent-token",
)

# Check if an action is allowed
decision = client.check("read:contacts")
if decision.allowed:
    print("Access granted!")
else:
    print(f"Denied: {decision.reason}")
```

## Configuration

### Environment Variables

```bash
export MESHGUARD_GATEWAY_URL="https://dashboard.meshguard.app"
export MESHGUARD_AGENT_TOKEN="your-agent-token"
export MESHGUARD_ADMIN_TOKEN="your-admin-token"
```

Then simply:

```python
client = MeshGuardClient()  # Uses env vars
```

### Explicit Configuration

```python
client = MeshGuardClient(
    gateway_url="https://your-gateway.com",
    agent_token="your-token",
    admin_token="admin-token",  # For admin operations
    timeout=30.0,
    trace_id="custom-trace-id",  # Optional
)
```

## Core Methods

### check(action)

Check if an action is allowed without raising an exception.

```python
decision = client.check("read:contacts")

print(decision.allowed)   # True/False
print(decision.action)    # "read:contacts"
print(decision.decision)  # "allow" or "deny"
print(decision.policy)    # Policy name that matched
print(decision.reason)    # Reason for denial
print(decision.trace_id)  # Trace ID for correlation
```

### enforce(action)

Enforce policy - raises `PolicyDeniedError` if denied.

```python
from meshguard import PolicyDeniedError

try:
    client.enforce("delete:database")
    # Action is allowed, proceed
    delete_database()
except PolicyDeniedError as e:
    print(f"Denied: {e.reason}")
```

### govern(action)

Context manager for governed code blocks.

```python
with client.govern("write:email") as decision:
    # This code only runs if allowed
    send_email(to="user@example.com", body="Hello!")
    
# decision.trace_id available for logging
```

## Proxy Requests

Route HTTP requests through MeshGuard:

```python
# GET request
response = client.get("/api/contacts", action="read:contacts")

# POST request
response = client.post(
    "/api/emails",
    action="write:email",
    json={"to": "user@example.com", "body": "Hello!"},
)

# Generic request
response = client.request(
    "PUT",
    "/api/records/123",
    action="write:records",
    json={"status": "updated"},
)
```

## Admin Operations

Requires `admin_token` to be set.

### List Agents

```python
agents = client.list_agents()
for agent in agents:
    print(f"{agent.name} ({agent.trust_tier})")
```

### Create Agent

```python
result = client.create_agent(
    name="my-agent",
    trust_tier="verified",
    tags=["production", "sales"],
)
print(f"Agent ID: {result['id']}")
print(f"Token: {result['token']}")
```

### Update Agent

Update an existing agent's properties.

```python
client.update_agent(
    agent_id="agent_abc123",
    trust_tier="verified",  # optional
    tags=["tag1", "tag2"],  # optional
    metadata={"key": "value"}  # optional
)
```

All parameters except `agent_id` are optional — only include what you want to change.

### Revoke Agent

```python
client.revoke_agent("agent_abc123")
```

### List Policies

```python
policies = client.list_policies()
for policy in policies:
    print(f"{policy['name']}: {len(policy['rules'])} rules")
```

### Get Audit Log

```python
# Recent entries
entries = client.get_audit_log(limit=10)

# Only denials
denials = client.get_audit_log(limit=50, decision="deny")

for entry in denials:
    print(f"{entry['timestamp']}: {entry['action']} -> {entry['decision']}")
```

## Error Handling

```python
from meshguard import (
    MeshGuardError,
    AuthenticationError,
    PolicyDeniedError,
    RateLimitError,
)

try:
    client.enforce("dangerous:action")
except PolicyDeniedError as e:
    print(f"Action: {e.action}")
    print(f"Policy: {e.policy}")
    print(f"Reason: {e.reason}")
except AuthenticationError:
    print("Invalid or expired token")
except RateLimitError:
    print("Too many requests")
except MeshGuardError as e:
    print(f"General error: {e}")
```

## Health Check

```python
# Detailed health
health = client.health()
print(health)
# {"status": "healthy", "version": "0.1.0", "mode": "enforce"}

# Quick check
if client.is_healthy():
    print("Gateway is up!")
```

## Context Manager

Use the client as a context manager for automatic cleanup:

```python
with MeshGuardClient() as client:
    decision = client.check("read:data")
    # Client is automatically closed when done
```

## Next Steps

- [LangChain Integration](/integrations/langchain)
- [CrewAI Integration](/integrations/crewai)
- [API Reference](/api/overview)
