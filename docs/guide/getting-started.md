# Getting Started

Get your AI agents governed with MeshGuard in minutes.

## 1. Sign Up

Create your MeshGuard account at [meshguard.app](https://meshguard.app).

You'll receive:
- **Gateway URL** — Your MeshGuard endpoint
- **Admin Token** — For managing agents and policies
- **Dashboard Access** — Visual management at [dashboard.meshguard.app](https://dashboard.meshguard.app)

## 2. Install the SDK

```bash
pip install meshguard
```

With LangChain support:

```bash
pip install meshguard[langchain]
```

## 3. Create Your First Agent

Using the dashboard or API, create an agent:

```python
from meshguard import MeshGuardClient

# Initialize with your admin token
client = MeshGuardClient(
    gateway_url="https://your-gateway.meshguard.app",
    admin_token="your-admin-token",
)

# Create an agent
result = client.create_agent(
    name="my-first-agent",
    trust_tier="verified",
    tags=["production"],
)

print(f"Agent ID: {result['id']}")
print(f"Agent Token: {result['token']}")  # Save this!
```

## 4. Use the Agent Token

Now your agent can make governed requests:

```python
from meshguard import MeshGuardClient

# Initialize with agent token
client = MeshGuardClient(
    gateway_url="https://your-gateway.meshguard.app",
    agent_token="your-agent-token",  # From step 3
)

# Check if an action is allowed
decision = client.check("read:contacts")

if decision.allowed:
    print("✅ Access granted!")
    # Proceed with your action
else:
    print(f"❌ Denied: {decision.reason}")
```

## 5. View Activity

Visit your [dashboard](https://dashboard.meshguard.app) to see:
- Real-time audit log
- Agent activity
- Policy decisions
- Statistics

## Environment Variables

For production, use environment variables:

```bash
export MESHGUARD_GATEWAY_URL="https://your-gateway.meshguard.app"
export MESHGUARD_AGENT_TOKEN="your-agent-token"
```

Then simply:

```python
from meshguard import MeshGuardClient

client = MeshGuardClient()  # Auto-loads from env
decision = client.check("read:contacts")
```

## Next Steps

- [Quick Start](/guide/quickstart) — 2-minute integration
- [Python SDK Reference](/integrations/python) — Full SDK documentation
- [LangChain Integration](/integrations/langchain) — Govern LangChain agents
- [Policies](/guide/policies) — Configure what agents can do
