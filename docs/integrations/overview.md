# Integrations Overview

MeshGuard integrates with popular AI agent frameworks and any HTTP-based system.

## Official SDKs

### Python SDK

The official Python SDK with native support for LangChain, CrewAI, and AutoGPT.

```bash
pip install meshguard
pip install meshguard[langchain]  # With LangChain support
```

[Python SDK Documentation →](/integrations/python)

## Framework Integrations

| Framework | Status | Guide |
|-----------|--------|-------|
| LangChain | ✅ Supported | [LangChain Guide](/integrations/langchain) |
| CrewAI | ✅ Supported | [CrewAI Guide](/integrations/crewai) |
| AutoGPT | ✅ Supported | [AutoGPT Guide](/integrations/autogpt) |
| Amazon Bedrock Agents | ✅ Supported | [Bedrock Guide](/integrations/bedrock) |
| Google Vertex AI / ADK | ✅ Supported | [Vertex AI Guide](/integrations/vertex-ai) |
| OpenAI Agents SDK | ✅ Supported | [OpenAI Agents Guide](/integrations/openai-agents) |
| Generic HTTP | ✅ Supported | [HTTP Guide](/integrations/http) |

## Quick Example

```python
from meshguard import MeshGuardClient

client = MeshGuardClient(
    gateway_url="https://dashboard.meshguard.app",
    agent_token="your-token"
)

# Check policy before acting
decision = client.check("read:contacts")
if decision.allowed:
    contacts = fetch_contacts()
```

## Integration Patterns

### 1. Decorator Pattern (Recommended)

Wrap your tools with governance:

```python
from meshguard.langchain import governed_tool

@governed_tool("read:database")
def query_database(sql: str) -> str:
    return db.execute(sql)
```

### 2. Context Manager Pattern

Govern code blocks:

```python
with client.govern("write:email"):
    send_email(to="user@example.com", body="Hello!")
```

### 3. Explicit Check Pattern

Manual policy checks:

```python
if client.check("delete:records").allowed:
    delete_records()
else:
    raise PermissionError("Not allowed")
```

## Environment Variables

All integrations support configuration via environment variables:

```bash
export MESHGUARD_GATEWAY_URL="https://dashboard.meshguard.app"
export MESHGUARD_AGENT_TOKEN="your-agent-token"
export MESHGUARD_ADMIN_TOKEN="your-admin-token"
```
