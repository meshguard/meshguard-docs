# Quick Start

Govern your first agent in 2 minutes.

## 1. Sign Up

Go to [meshguard.app](https://meshguard.app) → Chat **"Create account"** → Get credentials

## 2. Install

```bash
pip install meshguard
```

## 3. Connect

```python
from meshguard import MeshGuardClient

client = MeshGuardClient(
    gateway_url="https://dashboard.meshguard.app",
    agent_token="your-agent-token",
)
```

## 4. Check Permissions

```python
decision = client.check("read:contacts")
print(f"Allowed: {decision.allowed}")
```

## 5. Enforce Policies

```python
from meshguard import PolicyDeniedError

try:
    client.enforce("write:email")
    send_email()  # Only runs if allowed
except PolicyDeniedError as e:
    print(f"Blocked: {e.reason}")
```

## 6. Govern Code Blocks

```python
with client.govern("delete:records"):
    delete_old_records()  # Only runs if allowed
```

## That's It! 🎉

Your agent is now governed. View activity at [dashboard.meshguard.app](https://dashboard.meshguard.app)

**Next:**
- [Full SDK Reference →](/integrations/python)
- [LangChain Guide →](/integrations/langchain)
- [Policy Configuration →](/guide/policies)
