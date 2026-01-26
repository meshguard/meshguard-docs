# Google Vertex AI Integration

Integrate MeshGuard with Google Vertex AI Agent Builder, the Agent Development Kit (ADK), and the Agent2Agent (A2A) protocol for enterprise-grade governance of Google Cloud AI agents.

## Overview

Google's AI agent ecosystem includes:

- **Vertex AI Agent Builder** — Build and deploy agents on Google Cloud
- **Agent Development Kit (ADK)** — Open-source Python framework for building agents
- **Agent2Agent (A2A) Protocol** — Open protocol for cross-agent communication

MeshGuard adds governance across all three:

- **Agent identity** — Cryptographic identity for each ADK agent
- **Tool governance** — Policy-based control over agent tool usage
- **A2A delegation control** — Govern cross-agent communication via A2A
- **Multi-vendor mesh** — Unified governance when Google agents interact with agents from other platforms
- **Unified audit trail** — Centralized logging across your entire agent mesh

### Vertex AI Safety vs MeshGuard

Vertex AI includes built-in safety features — content filtering, grounding, citation verification, and responsible AI tools. MeshGuard complements these with **action governance**:

| Concern | Vertex AI Safety | MeshGuard |
|---------|-----------------|-----------|
| Content filtering | ✅ Safety filters | — |
| Grounding verification | ✅ Grounding API | — |
| Action authorization | — | ✅ Core feature |
| Agent identity | — | ✅ Tokens + trust tiers |
| A2A delegation control | — | ✅ Permission ceilings |
| Cross-platform audit | — | ✅ Unified audit log |

**Use both:** Vertex AI safety for content integrity + MeshGuard for action governance.

## Prerequisites

- Python 3.10+
- Google Cloud account with Vertex AI enabled
- `google-adk` installed
- MeshGuard account ([sign up free](https://meshguard.app))

## Installation

```bash
pip install meshguard google-adk google-cloud-aiplatform
```

## Quick Start: Governing ADK Agents

### 1. Get Your Credentials

```bash
export MESHGUARD_GATEWAY_URL="https://dashboard.meshguard.app"
export MESHGUARD_AGENT_TOKEN="your-vertex-agent-token"
export GOOGLE_CLOUD_PROJECT="your-gcp-project"
export GOOGLE_CLOUD_LOCATION="us-central1"
```

### 2. Create a Governed ADK Agent

```python
from google.adk.agents import Agent
from google.adk.tools import FunctionTool
from meshguard import MeshGuardClient

# Initialize MeshGuard
mesh = MeshGuardClient()

# Define governed tools
def governed_tool(action: str, client: MeshGuardClient):
    """Decorator to add MeshGuard governance to ADK tools."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            decision = client.check(
                action=action,
                context={"tool": func.__name__, "args": str(kwargs)[:200]},
            )
            if not decision.allowed:
                return f"Action blocked by policy: {decision.reason}"
            
            result = func(*args, **kwargs)
            
            client.audit_log(
                action=action,
                decision="allowed",
                metadata={"tool": func.__name__},
            )
            return result
        
        wrapper.__name__ = func.__name__
        wrapper.__doc__ = func.__doc__
        return wrapper
    return decorator


@governed_tool("read:database", client=mesh)
def query_database(sql: str) -> str:
    """Execute a read-only database query."""
    # Your database query logic
    return execute_query(sql)


@governed_tool("read:web_search", client=mesh)
def search_web(query: str) -> str:
    """Search the web for information."""
    return perform_search(query)


@governed_tool("write:report", client=mesh)
def save_report(title: str, content: str) -> str:
    """Save a generated report."""
    return save_to_storage(title, content)


# Create the ADK agent with governed tools
agent = Agent(
    model="gemini-2.0-flash",
    name="data_analyst",
    instruction="""You are a data analyst agent. Your actions are governed by 
    enterprise policy. If an action is blocked, explain the limitation and 
    suggest alternatives.""",
    tools=[
        FunctionTool(query_database),
        FunctionTool(search_web),
        FunctionTool(save_report),
    ],
)
```

### 3. Run the Governed Agent

```python
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

session_service = InMemorySessionService()
runner = Runner(
    agent=agent,
    app_name="governed-analyst",
    session_service=session_service,
)

# Create a session
session = session_service.create_session(
    app_name="governed-analyst",
    user_id="analyst-user-001",
)

# Run the agent
from google.genai import types

response = runner.run(
    user_id="analyst-user-001",
    session_id=session.id,
    new_message=types.Content(
        role="user",
        parts=[types.Part(text="Analyze Q4 revenue by region")],
    ),
)

for event in response:
    if event.is_final_response():
        print(event.content.parts[0].text)
```

## Governing A2A (Agent2Agent) Communication

The A2A protocol enables agents to discover and communicate with each other across platforms. MeshGuard acts as the **policy enforcement point** for A2A interactions.

### A2A Agent Card with MeshGuard Governance

```python
from google.adk.agents import Agent
from google.adk.tools import FunctionTool
from meshguard import MeshGuardClient
import json

mesh = MeshGuardClient()

# A2A Agent Card advertising governed capabilities
AGENT_CARD = {
    "name": "Data Analyst Agent",
    "description": "Analyzes data and generates reports. All actions governed by MeshGuard.",
    "url": "https://your-agent.example.com",
    "version": "1.0.0",
    "capabilities": {
        "streaming": True,
        "pushNotifications": False,
    },
    "skills": [
        {
            "id": "data-analysis",
            "name": "Data Analysis",
            "description": "Query databases and analyze data (governed)",
            "tags": ["analytics", "governed"],
        },
        {
            "id": "report-generation",
            "name": "Report Generation",
            "description": "Generate formatted reports (governed)",
            "tags": ["reporting", "governed"],
        },
    ],
    "authentication": {
        "schemes": ["bearer"],
        "credentials": "meshguard-token-required",
    },
}


class GovernedA2AHandler:
    """Handle incoming A2A requests with MeshGuard governance."""
    
    def __init__(self, mesh_client: MeshGuardClient):
        self.mesh = mesh_client
    
    def handle_task(self, task_request: dict) -> dict:
        """Process an A2A task request with governance."""
        task_id = task_request.get("id", "")
        sender = task_request.get("from", {})
        skill_id = task_request.get("skill", "")
        message = task_request.get("message", {})
        
        # Check if the requesting agent is authorized
        decision = self.mesh.check(
            action=f"a2a:receive:{skill_id}",
            context={
                "task_id": task_id,
                "sender_name": sender.get("name", "unknown"),
                "sender_url": sender.get("url", ""),
                "skill": skill_id,
            },
        )
        
        if not decision.allowed:
            return {
                "id": task_id,
                "status": {
                    "state": "failed",
                    "message": {
                        "role": "agent",
                        "parts": [{
                            "type": "text",
                            "text": f"Request denied by governance policy: {decision.reason}",
                        }],
                    },
                },
            }
        
        # Process the task
        result = self._execute_skill(skill_id, message)
        
        # Log for audit
        self.mesh.audit_log(
            action=f"a2a:receive:{skill_id}",
            decision="allowed",
            metadata={
                "task_id": task_id,
                "sender": sender.get("name", "unknown"),
                "skill": skill_id,
            },
        )
        
        return {
            "id": task_id,
            "status": {
                "state": "completed",
                "message": {
                    "role": "agent",
                    "parts": [{"type": "text", "text": result}],
                },
            },
        }
    
    def _execute_skill(self, skill_id: str, message: dict) -> str:
        """Execute an agent skill."""
        # Your skill execution logic
        pass


class GovernedA2AClient:
    """Send A2A requests with MeshGuard governance."""
    
    def __init__(self, mesh_client: MeshGuardClient):
        self.mesh = mesh_client
    
    def send_task(
        self,
        target_url: str,
        target_name: str,
        skill_id: str,
        message: str,
    ) -> dict:
        """Send a governed A2A task to another agent."""
        import requests
        import uuid
        
        task_id = str(uuid.uuid4())
        
        # Check if we're allowed to delegate to this agent
        decision = self.mesh.check(
            action=f"a2a:send:{skill_id}",
            context={
                "target_name": target_name,
                "target_url": target_url,
                "skill": skill_id,
            },
        )
        
        if not decision.allowed:
            return {
                "success": False,
                "reason": f"Delegation to {target_name} blocked: {decision.reason}",
            }
        
        # Send the A2A task
        response = requests.post(
            f"{target_url}/tasks/send",
            json={
                "id": task_id,
                "message": {
                    "role": "user",
                    "parts": [{"type": "text", "text": message}],
                },
                "skill": skill_id,
            },
            headers={
                "Authorization": f"Bearer {self.mesh.agent_token}",
                "Content-Type": "application/json",
            },
        )
        
        # Log for audit
        self.mesh.audit_log(
            action=f"a2a:send:{skill_id}",
            decision="allowed",
            metadata={
                "task_id": task_id,
                "target": target_name,
                "target_url": target_url,
            },
        )
        
        return {
            "success": True,
            "task_id": task_id,
            "response": response.json(),
        }
```

## Multi-Agent Mesh with A2A Governance

Govern a mesh of agents from multiple vendors communicating via A2A:

```python
from meshguard import MeshGuardClient
import uuid

class GovernedAgentMesh:
    """Multi-vendor agent mesh governed by MeshGuard."""
    
    def __init__(self, mesh_token: str):
        self.mesh = MeshGuardClient(agent_token=mesh_token)
        self.trace_id = str(uuid.uuid4())
        self.agents: dict = {}
    
    def register_agent(self, name: str, url: str, skills: list[str]):
        """Register an agent in the governed mesh."""
        self.agents[name] = {"url": url, "skills": skills}
    
    def route_task(
        self,
        skill_needed: str,
        message: str,
        preferred_agent: str = None,
    ) -> dict:
        """Route a task to the best available agent with governance."""
        # Find capable agents
        candidates = []
        for name, config in self.agents.items():
            if skill_needed in config["skills"]:
                candidates.append(name)
        
        if not candidates:
            return {"success": False, "reason": f"No agent has skill: {skill_needed}"}
        
        # Try preferred agent first, then others
        if preferred_agent and preferred_agent in candidates:
            candidates.insert(0, candidates.pop(candidates.index(preferred_agent)))
        
        for agent_name in candidates:
            # Check if routing to this agent is permitted
            decision = self.mesh.check(
                action=f"mesh:route:{skill_needed}",
                context={
                    "trace_id": self.trace_id,
                    "target_agent": agent_name,
                    "skill": skill_needed,
                },
            )
            
            if decision.allowed:
                # Route the task
                result = self._send_to_agent(agent_name, skill_needed, message)
                return {
                    "success": True,
                    "agent": agent_name,
                    "result": result,
                    "trace_id": self.trace_id,
                }
        
        return {
            "success": False,
            "reason": "No authorized agent available for this skill",
            "candidates_checked": candidates,
        }
    
    def _send_to_agent(self, agent_name: str, skill: str, message: str) -> dict:
        """Send task to a specific agent."""
        import requests
        
        config = self.agents[agent_name]
        response = requests.post(
            f"{config['url']}/tasks/send",
            json={
                "id": str(uuid.uuid4()),
                "skill": skill,
                "message": {
                    "role": "user",
                    "parts": [{"type": "text", "text": message}],
                },
            },
            headers={
                "Authorization": f"Bearer {self.mesh.agent_token}",
                "X-MeshGuard-Trace": self.trace_id,
            },
        )
        
        return response.json()

# Usage
mesh = GovernedAgentMesh(mesh_token="mesh-orchestrator-token")

# Register agents from different platforms
mesh.register_agent(
    "google-analyst",
    "https://analyst.example.com",
    ["data-analysis", "visualization"],
)
mesh.register_agent(
    "aws-reporter",
    "https://reporter.example.com",
    ["report-generation", "data-analysis"],
)
mesh.register_agent(
    "openai-summarizer",
    "https://summarizer.example.com",
    ["summarization", "translation"],
)

# Route a task — MeshGuard governs which agent gets it
result = mesh.route_task(
    skill_needed="data-analysis",
    message="Analyze customer churn patterns for Q4",
)
```

## Governing Vertex AI Agent Engine

When deploying agents to Vertex AI Agent Engine (managed runtime), add MeshGuard governance:

```python
from google.adk.agents import Agent
from google.adk.tools import FunctionTool
from meshguard import MeshGuardClient
import vertexai
from vertexai import agent_engines

# Initialize
vertexai.init(project="your-project", location="us-central1")
mesh = MeshGuardClient()

# Create governed tools (same as above)
@governed_tool("read:customer_data", client=mesh)
def lookup_customer(customer_id: str) -> str:
    """Look up customer by ID."""
    return customer_db.get(customer_id)

@governed_tool("write:ticket", client=mesh)
def create_support_ticket(
    customer_id: str,
    subject: str,
    description: str,
    priority: str,
) -> str:
    """Create a support ticket."""
    return ticket_system.create(customer_id, subject, description, priority)

# Create the agent
agent = Agent(
    model="gemini-2.0-flash",
    name="support_agent",
    instruction="You are a customer support agent. All actions are governed by policy.",
    tools=[
        FunctionTool(lookup_customer),
        FunctionTool(create_support_ticket),
    ],
)

# Deploy to Agent Engine
deployed_agent = agent_engines.create(
    agent_engine=agent,
    display_name="Governed Support Agent",
    description="Customer support agent with MeshGuard governance",
)

print(f"Deployed agent: {deployed_agent.resource_name}")
```

## Handling Denied Actions

```python
from meshguard import MeshGuardClient

mesh = MeshGuardClient()

def governed_tool_with_fallback(action: str, client: MeshGuardClient):
    """Governance decorator with helpful denial messages."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            decision = client.check(
                action=action,
                context={"tool": func.__name__},
            )
            
            if not decision.allowed:
                return (
                    f"⚠️ I'm unable to perform this action.\n"
                    f"Reason: {decision.reason}\n"
                    f"This has been logged for review. A human team member "
                    f"can assist with this request."
                )
            
            result = func(*args, **kwargs)
            
            client.audit_log(
                action=action,
                decision="allowed",
                metadata={"tool": func.__name__},
            )
            return result
        
        wrapper.__name__ = func.__name__
        wrapper.__doc__ = func.__doc__
        return wrapper
    return decorator
```

## Audit Trail

Every governed action is logged with full context:

```python
# Get recent actions
audit = mesh.get_audit_log(limit=10)

for entry in audit:
    print(f"{entry['timestamp']} - {entry['action']} - {entry['decision']}")
```

Or via CLI:
```bash
meshguard audit query --agent vertex-ai-support
meshguard audit trace <trace-id>
```

## Configuration Reference

### Environment Variables

| Variable | Description |
|----------|-------------|
| `MESHGUARD_GATEWAY_URL` | MeshGuard gateway URL |
| `MESHGUARD_AGENT_TOKEN` | Agent authentication token |
| `MESHGUARD_ADMIN_TOKEN` | Admin token (for management APIs) |
| `GOOGLE_CLOUD_PROJECT` | Google Cloud project ID |
| `GOOGLE_CLOUD_LOCATION` | Google Cloud region |

### Policy Example

```yaml
name: vertex-ai-agent-policy
version: "1.0"
description: Policy for Vertex AI agents with A2A governance

appliesTo:
  tags:
    - vertex-ai
    - support

rules:
  # Allow customer data reads
  - effect: allow
    actions:
      - "read:customer_data"
      - "read:order_history"

  # Allow ticket creation
  - effect: allow
    actions:
      - "write:ticket"

  # Allow A2A communication with known agents
  - effect: allow
    actions:
      - "a2a:send:*"
    conditions:
      target_agent:
        - "google-analyst"
        - "report-writer"

  # Block A2A communication with unknown agents
  - effect: deny
    actions:
      - "a2a:send:*"
    reason: "A2A communication limited to approved agents"

  # Allow receiving A2A tasks for registered skills
  - effect: allow
    actions:
      - "a2a:receive:data-analysis"
      - "a2a:receive:report-generation"

defaultEffect: deny

delegation:
  maxDepth: 3
  permissionCeiling:
    - "read:*"
    - "write:ticket"
```

## Troubleshooting

### ADK agent not receiving governance context

Ensure the MeshGuard client is initialized before creating the agent:

```python
# ✅ Correct: Initialize MeshGuard first
mesh = MeshGuardClient()

@governed_tool("read:data", client=mesh)
def my_tool(query: str) -> str:
    return do_query(query)

agent = Agent(tools=[FunctionTool(my_tool)])
```

### A2A tasks failing with authentication errors

Ensure your A2A requests include the MeshGuard token:

```python
headers = {
    "Authorization": f"Bearer {mesh.agent_token}",
    "X-MeshGuard-Trace": trace_id,
}
```

### Agent Engine deployment not picking up governance

When deploying to Agent Engine, ensure governance is embedded in the tool functions, not as middleware:

```python
# ✅ Governance in the tool itself
@governed_tool("read:data", client=mesh)
def my_tool(query: str) -> str:
    return do_query(query)

# ❌ External middleware won't deploy to Agent Engine
```

## Next Steps

- [Python SDK Reference](/integrations/python) — Full SDK documentation
- [Policy Configuration](/guide/policies) — Define what agents can do
- [Bedrock Integration](/integrations/bedrock) — For AWS Bedrock agents
- [OpenAI Agents Integration](/integrations/openai-agents) — For OpenAI Agents SDK
- [API Reference](/api/overview) — Direct API access
