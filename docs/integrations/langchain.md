# LangChain Integration

Integrate MeshGuard with your LangChain agents for enterprise-grade governance, policy enforcement, and audit logging.

## Installation

```bash
pip install meshguard[langchain]
```

This installs the MeshGuard SDK with LangChain extras.

## Quick Start

### 1. Get Your Credentials

Sign up at [meshguard.app](https://meshguard.app) or use your existing credentials:

```bash
export MESHGUARD_GATEWAY_URL="https://dashboard.meshguard.app"
export MESHGUARD_AGENT_TOKEN="your-agent-token"
```

### 2. Govern a Tool with a Decorator

```python
from meshguard import MeshGuardClient
from meshguard.langchain import governed_tool

client = MeshGuardClient()

@governed_tool("read:contacts", client=client)
def fetch_contacts(query: str) -> str:
    """Search contacts - only runs if policy allows."""
    return contacts_db.search(query)

@governed_tool("write:email", client=client)
def send_email(to: str, subject: str, body: str) -> str:
    """Send email - governed by MeshGuard policy."""
    return email_service.send(to, subject, body)
```

### 3. Wrap Existing LangChain Tools

```python
from langchain.tools import DuckDuckGoSearchRun
from meshguard import MeshGuardClient
from meshguard.langchain import GovernedTool

client = MeshGuardClient()
search = DuckDuckGoSearchRun()

# Wrap with governance
governed_search = GovernedTool(
    tool=search,
    action="read:web_search",
    client=client,
)

# Use normally - MeshGuard enforces policy
result = governed_search.run("latest AI news")
```

## Governing Multiple Tools

Use `GovernedToolkit` to wrap multiple tools at once:

```python
from langchain.agents import load_tools
from meshguard import MeshGuardClient
from meshguard.langchain import GovernedToolkit

client = MeshGuardClient()
tools = load_tools(["serpapi", "llm-math"])

toolkit = GovernedToolkit(
    tools=tools,
    client=client,
    action_map={
        "serpapi": "read:web_search",
        "Calculator": "execute:math",
    },
    default_action="execute:tool",  # Fallback for unmapped tools
)

governed_tools = toolkit.get_tools()
```

## Creating a Governed Agent

The simplest way to create a fully governed LangChain agent:

```python
from langchain.llms import OpenAI
from langchain.agents import load_tools
from meshguard import MeshGuardClient
from meshguard.langchain import create_governed_agent

client = MeshGuardClient()
llm = OpenAI()
tools = load_tools(["serpapi", "llm-math"], llm=llm)

agent = create_governed_agent(
    llm=llm,
    tools=tools,
    client=client,
    action_map={
        "serpapi": "read:web_search",
        "Calculator": "execute:math",
    },
)

# Every tool call goes through MeshGuard
result = agent.run("What is 25 * 4?")
```

## Handling Denied Actions

When a policy blocks an action, `PolicyDeniedError` is raised:

```python
from meshguard.langchain import governed_tool
from meshguard.exceptions import PolicyDeniedError

def handle_denial(error, *args, **kwargs):
    """Custom handler for denied actions."""
    return f"Sorry, I can't do that: {error.reason}"

@governed_tool(
    "delete:records", 
    client=client,
    on_deny=handle_denial,  # Custom handler
)
def delete_records(ids: list) -> str:
    return db.delete(ids)

# If policy denies, returns custom message instead of raising
```

## Full Example: Customer Support Agent

```python
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Type

from meshguard import MeshGuardClient
from meshguard.langchain import governed_tool

# Initialize MeshGuard
client = MeshGuardClient(
    gateway_url="https://dashboard.meshguard.app",
    agent_token="your-agent-token",
)

# Governed tools
@governed_tool("read:customer_data", client=client)
def lookup_customer(email: str) -> str:
    """Look up customer by email."""
    return crm.get_customer(email)

@governed_tool("read:order_history", client=client)
def get_orders(customer_id: str) -> str:
    """Get order history for a customer."""
    return orders.get_history(customer_id)

@governed_tool("write:refund", client=client)
def process_refund(order_id: str, amount: float) -> str:
    """Process a refund - requires elevated permissions."""
    return payments.refund(order_id, amount)

# Build the agent
llm = ChatOpenAI(model="gpt-4")

prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a customer support agent. All your actions are 
governed by enterprise policy. If an action is blocked, apologize and 
explain that you need manager approval."""),
    ("human", "{input}"),
    MessagesPlaceholder("agent_scratchpad"),
])

tools = [lookup_customer, get_orders, process_refund]
agent = create_openai_tools_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# Run
result = executor.invoke({
    "input": "I need a refund for order #12345"
})
```

## Audit Trail

Every governed action is logged. Query the audit log:

```python
# Get recent actions for your agent
audit = client.get_audit_log(limit=10)

for entry in audit:
    print(f"{entry['timestamp']} - {entry['action']} - {entry['decision']}")
```

Or via CLI:
```bash
meshguard audit query --agent my-langchain-agent
```

## Configuration Reference

### Environment Variables

| Variable | Description |
|----------|-------------|
| `MESHGUARD_GATEWAY_URL` | MeshGuard gateway URL |
| `MESHGUARD_AGENT_TOKEN` | Agent authentication token |
| `MESHGUARD_ADMIN_TOKEN` | Admin token (for management APIs) |

### governed_tool Options

| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | str | MeshGuard action (e.g., "read:contacts") |
| `client` | MeshGuardClient | MeshGuard client instance |
| `on_deny` | Callable | Handler for denied actions |

### GovernedTool Options

| Parameter | Type | Description |
|-----------|------|-------------|
| `tool` | Any | LangChain tool to wrap |
| `action` | str | MeshGuard action |
| `client` | MeshGuardClient | MeshGuard client instance |
| `on_deny` | Callable | Handler for denied actions |

### GovernedToolkit Options

| Parameter | Type | Description |
|-----------|------|-------------|
| `tools` | List | List of LangChain tools |
| `client` | MeshGuardClient | MeshGuard client instance |
| `action_map` | Dict | Map of tool names to actions |
| `default_action` | str | Fallback action for unmapped tools |
| `on_deny` | Callable | Handler for denied actions |

## Next Steps

- [Python SDK Reference](/integrations/python) — Full SDK documentation
- [Policy Configuration](/guide/policies) — Define what agents can do
- [CrewAI Integration](/integrations/crewai) — For multi-agent systems
- [API Reference](/api/overview) — Direct API access
