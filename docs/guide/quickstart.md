# Quick Start

Govern your first agent in 2 minutes.

## Install

```bash
pip install meshguard
```

## Connect

```python
from meshguard import MeshGuardClient

client = MeshGuardClient(
    gateway_url="https://dashboard.meshguard.app",  # Or your gateway
    agent_token="your-agent-token",
)
```

## Check Permissions

```python
# Check if an action is allowed
decision = client.check("read:contacts")
print(f"Allowed: {decision.allowed}")
```

## Enforce Policies

```python
from meshguard import PolicyDeniedError

try:
    client.enforce("write:email")
    # Action allowed - send the email
    send_email()
except PolicyDeniedError as e:
    print(f"Blocked: {e.reason}")
```

## Govern Code Blocks

```python
with client.govern("delete:records"):
    # Only runs if allowed
    delete_old_records()
```

## LangChain Integration

```python
from meshguard.langchain import governed_tool

@governed_tool("read:database")
def query_database(sql: str) -> str:
    return db.execute(sql)

# Tool only runs if policy allows
result = query_database("SELECT * FROM users")
```

## That's It!

Your agent is now governed by MeshGuard policies.

- [Full SDK Reference →](/integrations/python)
- [LangChain Guide →](/integrations/langchain)
- [Policy Configuration →](/guide/policies)
