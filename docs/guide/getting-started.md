# Getting Started

Get your AI agents governed with MeshGuard in minutes.

## 1. Create Your Account

### Option A: Via Website (Recommended)
Visit [meshguard.app](https://meshguard.app) and chat with Scout. Say **"Create account"** or **"Start free"** to begin.

You'll receive:
- **API Key** (`msk_...`) — Identifies your organization
- **Admin Token** (`msat_...`) — For managing agents and policies
- **Agent Token** (optional) — If you created a first agent

::: warning Save Your Credentials
These tokens are shown only once. Store them securely!
:::

### Option B: Via API
```bash
curl -X POST https://dashboard.meshguard.app/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Company",
    "email": "you@company.com",
    "agentName": "my-first-agent"
  }'
```

## 2. Install the SDK

```bash
pip install meshguard
```

With LangChain support:
```bash
pip install meshguard[langchain]
```

## 3. Configure Your Client

```python
from meshguard import MeshGuardClient

client = MeshGuardClient(
    gateway_url="https://dashboard.meshguard.app",
    agent_token="your-agent-token",  # From signup
)
```

Or use environment variables:
```bash
export MESHGUARD_GATEWAY_URL="https://dashboard.meshguard.app"
export MESHGUARD_AGENT_TOKEN="your-agent-token"
```

```python
from meshguard import MeshGuardClient
client = MeshGuardClient()  # Auto-loads from env
```

## 4. Govern Your First Action

```python
# Check if an action is allowed
decision = client.check("read:contacts")

if decision.allowed:
    print("✅ Access granted!")
    # Proceed with your action
else:
    print(f"❌ Denied: {decision.reason}")
```

## 5. View Your Dashboard

Visit [dashboard.meshguard.app](https://dashboard.meshguard.app):

1. Enter your **API Key** in the Gateway URL field (it auto-fills)
2. Enter your **Admin Token**
3. Click **Connect**

You'll see:
- Real-time audit log
- Your agents
- Active policies
- Usage statistics

## Next Steps

- [Quick Start](/guide/quickstart) — 2-minute integration
- [Python SDK](/integrations/python) — Full SDK reference
- [LangChain Integration](/integrations/langchain) — Govern LangChain agents
- [Create Policies](/guide/policies) — Define what agents can do
