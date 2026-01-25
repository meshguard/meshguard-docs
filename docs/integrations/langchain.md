# LangChain Integration

Integrate MeshGuard with your LangChain agents to add enterprise-grade governance, policy enforcement, and audit logging.

## Overview

This guide shows you how to:
- Wrap LangChain tool calls through MeshGuard
- Create a governed agent executor
- Handle policy decisions gracefully
- Track agent activity in the audit log

## Prerequisites

- Python 3.9+
- LangChain installed (`pip install langchain langchain-openai`)
- MeshGuard gateway running (see [Quickstart](/guide/quickstart.md))
- An agent token from MeshGuard

## Installation

### Option 1: HTTP Client (Recommended)

No additional packages needed—use the `requests` library:

```bash
pip install requests langchain langchain-openai
```

### Option 2: MeshGuard Python SDK (Coming Soon)

```bash
pip install meshguard  # Future release
```

## Quick Start

### 1. Get Your MeshGuard Token

```bash
# Create an agent in MeshGuard
bun run src/cli/index.ts agent create langchain-agent --trust verified

# Save the token that's printed
```

### 2. Create a MeshGuard-Wrapped Tool

```python
import os
import requests
from langchain.tools import BaseTool
from typing import Optional, Type
from pydantic import BaseModel, Field

# Configuration
MESHGUARD_URL = os.getenv("MESHGUARD_URL", "http://localhost:3100")
MESHGUARD_TOKEN = os.getenv("MESHGUARD_TOKEN")

class MeshGuardClient:
    """Client for making governed API calls through MeshGuard."""
    
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        })
    
    def request(self, method: str, path: str, **kwargs) -> requests.Response:
        """Make a governed request through MeshGuard proxy."""
        url = f"{self.base_url}/proxy{path}"
        response = self.session.request(method, url, **kwargs)
        
        # Handle policy denials
        if response.status_code == 403:
            data = response.json()
            raise PermissionError(
                f"MeshGuard policy denied: {data.get('reason', 'Unknown')}"
            )
        
        return response
    
    def get(self, path: str, **kwargs) -> requests.Response:
        return self.request("GET", path, **kwargs)
    
    def post(self, path: str, **kwargs) -> requests.Response:
        return self.request("POST", path, **kwargs)
    
    def put(self, path: str, **kwargs) -> requests.Response:
        return self.request("PUT", path, **kwargs)
    
    def delete(self, path: str, **kwargs) -> requests.Response:
        return self.request("DELETE", path, **kwargs)


# Initialize the client
meshguard = MeshGuardClient(MESHGUARD_URL, MESHGUARD_TOKEN)
```

### 3. Create Governed LangChain Tools

```python
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Optional, Type


class ContactSearchInput(BaseModel):
    """Input for searching contacts."""
    query: str = Field(description="Search query for contacts")


class GovernedContactSearchTool(BaseTool):
    """A contact search tool that routes through MeshGuard."""
    
    name: str = "contact_search"
    description: str = "Search for contacts by name or email. Returns matching contacts."
    args_schema: Type[BaseModel] = ContactSearchInput
    
    def _run(self, query: str) -> str:
        """Execute the search through MeshGuard."""
        try:
            # This request goes through MeshGuard's policy engine
            response = meshguard.get(
                "/api/contacts/search",
                params={"q": query}
            )
            response.raise_for_status()
            return response.json()
        except PermissionError as e:
            return f"Action blocked by policy: {e}"
        except requests.RequestException as e:
            return f"Request failed: {e}"


class EmailSendInput(BaseModel):
    """Input for sending emails."""
    to: str = Field(description="Recipient email address")
    subject: str = Field(description="Email subject")
    body: str = Field(description="Email body")


class GovernedEmailTool(BaseTool):
    """An email tool that routes through MeshGuard."""
    
    name: str = "send_email"
    description: str = "Send an email to a recipient. Use carefully."
    args_schema: Type[BaseModel] = EmailSendInput
    
    def _run(self, to: str, subject: str, body: str) -> str:
        """Send email through MeshGuard."""
        try:
            response = meshguard.post(
                "/api/email/send",
                json={"to": to, "subject": subject, "body": body}
            )
            response.raise_for_status()
            return f"Email sent successfully to {to}"
        except PermissionError as e:
            return f"Email blocked by policy: {e}"
        except requests.RequestException as e:
            return f"Failed to send email: {e}"
```

### 4. Build the Agent

```python
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

# Create the LLM
llm = ChatOpenAI(model="gpt-4", temperature=0)

# Create governed tools
tools = [
    GovernedContactSearchTool(),
    GovernedEmailTool(),
]

# Create the prompt
prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a helpful assistant with access to contacts and email.
    
All your actions are governed by enterprise policies. If an action is blocked,
explain this to the user and suggest alternatives if possible."""),
    ("human", "{input}"),
    MessagesPlaceholder("agent_scratchpad"),
])

# Create the agent
agent = create_openai_tools_agent(llm, tools, prompt)

# Create the executor
agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,
    handle_parsing_errors=True,
)

# Run the agent
result = agent_executor.invoke({
    "input": "Find John's email and send him a meeting reminder"
})
print(result["output"])
```

## Advanced: Custom Tool Wrapper

For existing tools, create a wrapper that adds MeshGuard governance:

```python
from langchain.tools import BaseTool, StructuredTool
from functools import wraps
from typing import Callable, Any

def governed(action: str):
    """
    Decorator that wraps a function with MeshGuard governance.
    
    Args:
        action: The MeshGuard action to check (e.g., "read:contacts", "write:email")
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            # Check permission via MeshGuard
            # The action is encoded in the request path
            path = f"/governed/{action.replace(':', '/')}"
            
            try:
                # Make a preflight check (HEAD request)
                response = meshguard.session.head(
                    f"{meshguard.base_url}/proxy{path}"
                )
                
                if response.status_code == 403:
                    return f"Action '{action}' blocked by policy"
                
                # Permission granted, execute the function
                return func(*args, **kwargs)
                
            except requests.RequestException as e:
                return f"Governance check failed: {e}"
        
        return wrapper
    return decorator


# Usage with existing functions
@governed("read:weather")
def get_weather(location: str) -> str:
    """Get weather for a location."""
    # Your actual implementation
    return f"Weather in {location}: Sunny, 72°F"


@governed("write:calendar")
def create_event(title: str, date: str) -> str:
    """Create a calendar event."""
    # Your actual implementation
    return f"Created event: {title} on {date}"


# Convert to LangChain tools
weather_tool = StructuredTool.from_function(
    func=get_weather,
    name="get_weather",
    description="Get current weather for a location"
)

calendar_tool = StructuredTool.from_function(
    func=create_event,
    name="create_event",
    description="Create a calendar event"
)
```

## Tracing and Debugging

### Enable Trace IDs

Pass trace IDs through for end-to-end audit correlation:

```python
import uuid

class TracedMeshGuardClient(MeshGuardClient):
    """MeshGuard client with trace ID support."""
    
    def request(self, method: str, path: str, trace_id: str = None, **kwargs) -> requests.Response:
        """Make a request with optional trace ID."""
        headers = kwargs.pop("headers", {})
        
        # Generate or use provided trace ID
        trace_id = trace_id or str(uuid.uuid4())
        headers["X-Trace-ID"] = trace_id
        
        return super().request(method, path, headers=headers, **kwargs)


# Use with your agent
meshguard = TracedMeshGuardClient(MESHGUARD_URL, MESHGUARD_TOKEN)

# All requests in this conversation share a trace ID
conversation_trace = str(uuid.uuid4())
response = meshguard.get("/api/contacts", trace_id=conversation_trace)
```

### Query Audit Logs

```bash
# Find all actions from your LangChain agent
bun run src/cli/index.ts audit query --agent langchain-agent

# Follow a specific trace
bun run src/cli/index.ts audit trace <trace-id>
```

## Example: Full Agent Application

```python
#!/usr/bin/env python3
"""
Example: LangChain agent with MeshGuard governance.
"""

import os
import requests
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Type

# --- Configuration ---
MESHGUARD_URL = os.getenv("MESHGUARD_URL", "http://localhost:3100")
MESHGUARD_TOKEN = os.getenv("MESHGUARD_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not MESHGUARD_TOKEN:
    raise ValueError("Set MESHGUARD_TOKEN environment variable")

# --- MeshGuard Client ---
class MeshGuard:
    def __init__(self, url: str, token: str):
        self.url = url.rstrip("/")
        self.session = requests.Session()
        self.session.headers["Authorization"] = f"Bearer {token}"
    
    def call(self, method: str, path: str, **kwargs):
        resp = self.session.request(method, f"{self.url}/proxy{path}", **kwargs)
        if resp.status_code == 403:
            raise PermissionError(resp.json().get("reason", "Policy denied"))
        resp.raise_for_status()
        return resp.json() if resp.content else None

mg = MeshGuard(MESHGUARD_URL, MESHGUARD_TOKEN)

# --- Governed Tools ---
class SearchInput(BaseModel):
    query: str = Field(description="Search query")

class SearchTool(BaseTool):
    name: str = "search"
    description: str = "Search the knowledge base"
    args_schema: Type[BaseModel] = SearchInput
    
    def _run(self, query: str) -> str:
        try:
            result = mg.call("GET", "/api/search", params={"q": query})
            return str(result)
        except PermissionError as e:
            return f"🚫 Blocked: {e}"

class WriteInput(BaseModel):
    content: str = Field(description="Content to write")

class WriteTool(BaseTool):
    name: str = "write_note"
    description: str = "Write a note to the system"
    args_schema: Type[BaseModel] = WriteInput
    
    def _run(self, content: str) -> str:
        try:
            mg.call("POST", "/api/notes", json={"content": content})
            return "✅ Note saved"
        except PermissionError as e:
            return f"🚫 Blocked: {e}"

# --- Agent Setup ---
llm = ChatOpenAI(model="gpt-4", temperature=0)
tools = [SearchTool(), WriteTool()]

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a governed assistant. Policy may block some actions."),
    ("human", "{input}"),
    MessagesPlaceholder("agent_scratchpad"),
])

agent = create_openai_tools_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# --- Main ---
if __name__ == "__main__":
    while True:
        user_input = input("\nYou: ").strip()
        if user_input.lower() in ("quit", "exit"):
            break
        result = executor.invoke({"input": user_input})
        print(f"\nAgent: {result['output']}")
```

## Testing Your Integration

### 1. Test with Permissive Policy

Create a test policy (`policies/langchain-test.yaml`):

```yaml
name: langchain-test
version: "1.0"
description: Test policy for LangChain integration

appliesTo:
  tags:
    - langchain

rules:
  - effect: allow
    actions:
      - "read:*"
      - "write:notes"
  
  - effect: deny
    actions:
      - "write:email"
      - "delete:*"

defaultEffect: deny
```

### 2. Run Integration Tests

```python
import pytest

def test_allowed_read():
    """Test that read actions are allowed."""
    response = meshguard.get("/api/search", params={"q": "test"})
    assert response.status_code == 200

def test_denied_delete():
    """Test that delete actions are blocked."""
    with pytest.raises(PermissionError):
        meshguard.delete("/api/notes/123")

def test_audit_recorded():
    """Test that actions are recorded in audit log."""
    # Make a request
    meshguard.get("/api/search", params={"q": "audit-test"})
    
    # Check audit log (via admin API)
    admin_response = requests.get(
        f"{MESHGUARD_URL}/admin/audit",
        headers={"X-Admin-Token": ADMIN_TOKEN},
        params={"limit": 1}
    )
    entries = admin_response.json()["entries"]
    assert len(entries) > 0
    assert "audit-test" in str(entries[0])
```

## Troubleshooting

### "Connection refused"

MeshGuard gateway isn't running:

```bash
# Start MeshGuard
cd meshguard
bun run src/index.ts
```

### "401 Unauthorized"

Token is invalid or expired:

```bash
# Generate a new token
bun run src/cli/index.ts agent token <agent-id>

# Update your environment
export MESHGUARD_TOKEN="new-token-here"
```

### "403 Forbidden"

Your action was blocked by policy. Check:

1. What action was attempted:
   ```bash
   bun run src/cli/index.ts audit tail -n 5
   ```

2. What policies apply:
   ```bash
   bun run src/cli/index.ts policy allowed <agent-id>
   ```

3. Update policy if needed and reload:
   ```bash
   bun run src/cli/index.ts policy reload
   ```

### Timeout Errors

Increase timeout in the client:

```python
meshguard.session.timeout = 30  # seconds
```

## Next Steps

- [Policy Reference](/guide/getting-started.md#understanding-policies) — Learn policy syntax
- [Audit Queries](/guide/getting-started.md#audit-commands) — Query the audit log
- [CrewAI Integration](./crewai.md) — For multi-agent systems
- [Generic HTTP Integration](/integrations/http.md) — For custom setups
