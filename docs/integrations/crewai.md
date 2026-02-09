# CrewAI Integration

Integrate MeshGuard with CrewAI to govern multi-agent workflows, control agent-to-agent delegation, and maintain audit trails across your crew.

## Overview

CrewAI enables teams of AI agents to collaborate on complex tasks. MeshGuard adds:

- **Per-agent policies** — Different trust levels for different agents
- **Delegation control** — Limit what tasks can be delegated and to whom
- **End-to-end audit** — Track actions across the entire crew workflow
- **Tool governance** — Control which tools each agent can use

## Prerequisites

- Python 3.9+
- CrewAI installed (`pip install crewai crewai-tools`)
- MeshGuard gateway running (see [Quickstart](/guide/quickstart.md))
- Agent tokens for each crew member

## Installation

```bash
pip install crewai crewai-tools requests
```

## Quick Start

### 1. Create MeshGuard Agents

Create agents in MeshGuard for each crew member:

```bash
# Create agents with different trust levels
meshguard agent create researcher --trust verified --tags crewai,research
meshguard agent create writer --trust verified --tags crewai,content
meshguard agent create reviewer --trust trusted --tags crewai,review
```

### 2. Create Policies

Create a policy for your crew (`policies/crewai-crew.yaml`):

```yaml
name: crewai-research-crew
version: "1.0"
description: Policy for research crew agents

appliesTo:
  tags:
    - crewai

rules:
  # Researchers can read anything
  - effect: allow
    actions:
      - "read:*"
      - "search:*"
    conditions:
      tags:
        - research

  # Writers can read and write content
  - effect: allow
    actions:
      - "read:*"
      - "write:content"
      - "write:draft"
    conditions:
      tags:
        - content

  # Reviewers can read, approve, and publish
  - effect: allow
    actions:
      - "read:*"
      - "approve:*"
      - "publish:*"
    conditions:
      tags:
        - review

  # No one can delete
  - effect: deny
    actions:
      - "delete:*"

defaultEffect: deny

delegation:
  maxDepth: 2
  permissionCeiling:
    - "read:*"
    - "write:content"
```

### 3. Create Governed Tools

```python
import os
import requests
from crewai_tools import BaseTool
from typing import Type, Any
from pydantic import BaseModel, Field

# MeshGuard configuration
MESHGUARD_URL = os.getenv("MESHGUARD_URL", "http://localhost:3100")

class MeshGuardSession:
    """Manages MeshGuard sessions for multiple agents."""
    
    _sessions: dict = {}
    
    @classmethod
    def get(cls, agent_name: str) -> requests.Session:
        """Get or create a session for an agent."""
        if agent_name not in cls._sessions:
            token = os.getenv(f"MESHGUARD_TOKEN_{agent_name.upper()}")
            if not token:
                raise ValueError(f"No token for agent: {agent_name}")
            
            session = requests.Session()
            session.headers["Authorization"] = f"Bearer {token}"
            session.headers["X-Agent-Name"] = agent_name
            cls._sessions[agent_name] = session
        
        return cls._sessions[agent_name]
    
    @classmethod
    def call(cls, agent_name: str, method: str, path: str, **kwargs) -> Any:
        """Make a governed API call for an agent."""
        session = cls.get(agent_name)
        url = f"{MESHGUARD_URL}/proxy{path}"
        
        response = session.request(method, url, **kwargs)
        
        if response.status_code == 403:
            data = response.json()
            raise PermissionError(
                f"Agent '{agent_name}' blocked: {data.get('reason', 'Policy denied')}"
            )
        
        response.raise_for_status()
        return response.json() if response.content else None


class GovernedSearchTool(BaseTool):
    """Web search tool governed by MeshGuard."""
    
    name: str = "governed_search"
    description: str = "Search the web for information. Governed by enterprise policy."
    agent_name: str = "researcher"  # Default agent
    
    class InputSchema(BaseModel):
        query: str = Field(description="Search query")
    
    def _run(self, query: str) -> str:
        try:
            result = MeshGuardSession.call(
                self.agent_name,
                "GET",
                "/api/search",
                params={"q": query}
            )
            return str(result)
        except PermissionError as e:
            return f"🚫 Search blocked: {e}"


class GovernedWriteTool(BaseTool):
    """Content writing tool governed by MeshGuard."""
    
    name: str = "governed_write"
    description: str = "Write and save content. Governed by enterprise policy."
    agent_name: str = "writer"
    
    class InputSchema(BaseModel):
        title: str = Field(description="Content title")
        content: str = Field(description="Content body")
    
    def _run(self, title: str, content: str) -> str:
        try:
            MeshGuardSession.call(
                self.agent_name,
                "POST",
                "/api/content",
                json={"title": title, "content": content}
            )
            return f"✅ Content saved: {title}"
        except PermissionError as e:
            return f"🚫 Write blocked: {e}"


class GovernedPublishTool(BaseTool):
    """Publishing tool governed by MeshGuard."""
    
    name: str = "governed_publish"
    description: str = "Publish approved content. Requires reviewer permissions."
    agent_name: str = "reviewer"
    
    class InputSchema(BaseModel):
        content_id: str = Field(description="ID of content to publish")
    
    def _run(self, content_id: str) -> str:
        try:
            MeshGuardSession.call(
                self.agent_name,
                "POST",
                f"/api/content/{content_id}/publish"
            )
            return f"✅ Published: {content_id}"
        except PermissionError as e:
            return f"🚫 Publish blocked: {e}"
```

### 4. Build the Crew

```python
from crewai import Agent, Task, Crew, Process

# Create agents with governed tools
researcher = Agent(
    role="Research Analyst",
    goal="Find accurate, relevant information on topics",
    backstory="Expert researcher with access to search tools",
    tools=[GovernedSearchTool(agent_name="researcher")],
    verbose=True
)

writer = Agent(
    role="Content Writer",
    goal="Create engaging, well-structured content",
    backstory="Skilled writer who transforms research into articles",
    tools=[
        GovernedSearchTool(agent_name="writer"),  # Can also search
        GovernedWriteTool(agent_name="writer")
    ],
    verbose=True
)

reviewer = Agent(
    role="Content Reviewer",
    goal="Ensure quality and accuracy before publishing",
    backstory="Editor with authority to approve and publish content",
    tools=[GovernedPublishTool(agent_name="reviewer")],
    verbose=True
)

# Define tasks
research_task = Task(
    description="Research the topic: {topic}",
    expected_output="Comprehensive research notes with sources",
    agent=researcher
)

writing_task = Task(
    description="Write an article based on the research",
    expected_output="A well-written article ready for review",
    agent=writer,
    context=[research_task]
)

review_task = Task(
    description="Review and publish the article",
    expected_output="Published article confirmation",
    agent=reviewer,
    context=[writing_task]
)

# Create the crew
crew = Crew(
    agents=[researcher, writer, reviewer],
    tasks=[research_task, writing_task, review_task],
    process=Process.sequential,
    verbose=True
)

# Run!
result = crew.kickoff(inputs={"topic": "AI Governance Best Practices"})
print(result)
```

## Advanced: Governed Delegation

Control agent-to-agent delegation with MeshGuard:

```python
from crewai import Agent, Task, Crew
from typing import Optional

class GovernedDelegation:
    """Middleware for governed task delegation."""
    
    @staticmethod
    def can_delegate(
        from_agent: str,
        to_agent: str,
        task_type: str
    ) -> bool:
        """Check if delegation is allowed by policy."""
        try:
            MeshGuardSession.call(
                from_agent,
                "POST",
                "/api/delegation/check",
                json={
                    "from": from_agent,
                    "to": to_agent,
                    "task_type": task_type
                }
            )
            return True
        except PermissionError:
            return False
    
    @staticmethod
    def record_delegation(
        from_agent: str,
        to_agent: str,
        task_description: str,
        trace_id: str
    ):
        """Record a delegation event for audit."""
        MeshGuardSession.call(
            from_agent,
            "POST",
            "/api/delegation/record",
            json={
                "from": from_agent,
                "to": to_agent,
                "task": task_description,
                "trace_id": trace_id
            }
        )


# Custom agent that checks delegation permissions
class GovernedAgent(Agent):
    """CrewAI Agent with MeshGuard governance."""
    
    meshguard_name: str = ""
    
    def delegate_work(self, task: Task, target_agent: Agent):
        """Delegate with governance check."""
        # Check if delegation is allowed
        if not GovernedDelegation.can_delegate(
            self.meshguard_name,
            target_agent.meshguard_name,
            task.description[:50]
        ):
            raise PermissionError(
                f"Delegation from {self.meshguard_name} to "
                f"{target_agent.meshguard_name} not allowed by policy"
            )
        
        # Record the delegation
        GovernedDelegation.record_delegation(
            self.meshguard_name,
            target_agent.meshguard_name,
            task.description,
            trace_id=os.getenv("CREW_TRACE_ID", "")
        )
        
        # Proceed with delegation
        return super().delegate_work(task, target_agent)


# Usage
researcher = GovernedAgent(
    role="Researcher",
    goal="Research topics thoroughly",
    backstory="Expert researcher",
    meshguard_name="researcher",
    allow_delegation=True,
    tools=[GovernedSearchTool(agent_name="researcher")]
)
```

## Trace Propagation

Maintain audit continuity across your crew:

```python
import uuid
from crewai import Crew
from contextvars import ContextVar

# Trace context
_trace_id: ContextVar[str] = ContextVar("trace_id", default="")

class TracedCrew(Crew):
    """Crew with end-to-end trace propagation."""
    
    def kickoff(self, inputs: dict = None):
        # Generate trace ID for this execution
        trace_id = str(uuid.uuid4())
        _trace_id.set(trace_id)
        
        print(f"🔍 Trace ID: {trace_id}")
        print(f"   View in MeshGuard: meshguard audit trace {trace_id}")
        
        # Add trace to environment for tools
        os.environ["CREW_TRACE_ID"] = trace_id
        
        return super().kickoff(inputs)


# Update MeshGuardSession to use trace
class TracedMeshGuardSession(MeshGuardSession):
    @classmethod
    def call(cls, agent_name: str, method: str, path: str, **kwargs) -> Any:
        session = cls.get(agent_name)
        
        # Add trace header
        trace_id = _trace_id.get() or os.getenv("CREW_TRACE_ID", "")
        if trace_id:
            session.headers["X-Trace-ID"] = trace_id
        
        return super().call(agent_name, method, path, **kwargs)
```

## Complete Example

```python
#!/usr/bin/env python3
"""
Example: CrewAI research crew with MeshGuard governance.
"""

import os
import uuid
import requests
from crewai import Agent, Task, Crew, Process
from crewai_tools import BaseTool
from pydantic import BaseModel, Field

# --- Configuration ---
MESHGUARD_URL = os.getenv("MESHGUARD_URL", "http://localhost:3100")

# Set tokens (in production, use proper secret management)
# export MESHGUARD_TOKEN_RESEARCHER="..."
# export MESHGUARD_TOKEN_WRITER="..."
# export MESHGUARD_TOKEN_REVIEWER="..."

# --- MeshGuard Integration ---
class MeshGuard:
    """MeshGuard client for CrewAI."""
    
    sessions = {}
    trace_id = None
    
    @classmethod
    def init_trace(cls):
        cls.trace_id = str(uuid.uuid4())
        return cls.trace_id
    
    @classmethod
    def get_session(cls, agent: str) -> requests.Session:
        if agent not in cls.sessions:
            token = os.getenv(f"MESHGUARD_TOKEN_{agent.upper()}")
            if not token:
                raise ValueError(f"Missing MESHGUARD_TOKEN_{agent.upper()}")
            
            s = requests.Session()
            s.headers["Authorization"] = f"Bearer {token}"
            cls.sessions[agent] = s
        
        return cls.sessions[agent]
    
    @classmethod
    def call(cls, agent: str, method: str, path: str, **kwargs):
        session = cls.get_session(agent)
        
        headers = kwargs.pop("headers", {})
        if cls.trace_id:
            headers["X-Trace-ID"] = cls.trace_id
        headers["X-Agent-Name"] = agent
        
        resp = session.request(
            method, 
            f"{MESHGUARD_URL}/proxy{path}",
            headers=headers,
            **kwargs
        )
        
        if resp.status_code == 403:
            raise PermissionError(f"[{agent}] blocked: {resp.json().get('reason')}")
        
        resp.raise_for_status()
        return resp.json() if resp.content else None

# --- Governed Tools ---
class SearchTool(BaseTool):
    name: str = "search"
    description: str = "Search for information"
    agent_name: str = "researcher"
    
    class InputSchema(BaseModel):
        query: str = Field(description="Search query")
    
    def _run(self, query: str) -> str:
        try:
            result = MeshGuard.call(self.agent_name, "GET", "/search", params={"q": query})
            return f"Results for '{query}': {result}"
        except PermissionError as e:
            return f"🚫 {e}"

class WriteTool(BaseTool):
    name: str = "write"
    description: str = "Save written content"
    agent_name: str = "writer"
    
    class InputSchema(BaseModel):
        title: str
        body: str
    
    def _run(self, title: str, body: str) -> str:
        try:
            MeshGuard.call(self.agent_name, "POST", "/content", json={"title": title, "body": body})
            return f"✅ Saved: {title}"
        except PermissionError as e:
            return f"🚫 {e}"

class ApproveTool(BaseTool):
    name: str = "approve"
    description: str = "Approve content for publishing"
    agent_name: str = "reviewer"
    
    class InputSchema(BaseModel):
        content_id: str
    
    def _run(self, content_id: str) -> str:
        try:
            MeshGuard.call(self.agent_name, "POST", f"/content/{content_id}/approve")
            return f"✅ Approved: {content_id}"
        except PermissionError as e:
            return f"🚫 {e}"

# --- Crew Setup ---
def create_crew():
    researcher = Agent(
        role="Researcher",
        goal="Gather comprehensive information",
        backstory="Senior research analyst",
        tools=[SearchTool(agent_name="researcher")],
        verbose=True
    )
    
    writer = Agent(
        role="Writer", 
        goal="Create clear, engaging content",
        backstory="Technical writer",
        tools=[WriteTool(agent_name="writer")],
        verbose=True
    )
    
    reviewer = Agent(
        role="Reviewer",
        goal="Ensure quality and approve for publication",
        backstory="Senior editor",
        tools=[ApproveTool(agent_name="reviewer")],
        verbose=True
    )
    
    research = Task(
        description="Research: {topic}",
        expected_output="Research summary",
        agent=researcher
    )
    
    write = Task(
        description="Write article from research",
        expected_output="Draft article",
        agent=writer,
        context=[research]
    )
    
    review = Task(
        description="Review and approve the article",
        expected_output="Approval status",
        agent=reviewer,
        context=[write]
    )
    
    return Crew(
        agents=[researcher, writer, reviewer],
        tasks=[research, write, review],
        process=Process.sequential,
        verbose=True
    )

# --- Main ---
if __name__ == "__main__":
    # Initialize trace for this run
    trace_id = MeshGuard.init_trace()
    print(f"\n🔍 MeshGuard Trace: {trace_id}")
    print(f"   Run: meshguard audit trace {trace_id}\n")
    
    # Create and run crew
    crew = create_crew()
    result = crew.kickoff(inputs={"topic": "AI Agent Security"})
    
    print(f"\n📊 Result:\n{result}")
    print(f"\n🔍 View full audit: meshguard audit trace {trace_id}")
```

## Testing

### Test Individual Agent Permissions

```python
import pytest

def test_researcher_can_search():
    result = MeshGuard.call("researcher", "GET", "/search", params={"q": "test"})
    assert result is not None

def test_researcher_cannot_publish():
    with pytest.raises(PermissionError):
        MeshGuard.call("researcher", "POST", "/content/123/publish")

def test_writer_can_write():
    result = MeshGuard.call("writer", "POST", "/content", json={"title": "Test", "body": "..."})
    assert result is not None

def test_writer_cannot_publish():
    with pytest.raises(PermissionError):
        MeshGuard.call("writer", "POST", "/content/123/publish")

def test_reviewer_can_publish():
    result = MeshGuard.call("reviewer", "POST", "/content/123/publish")
    assert result is not None
```

### Test Full Crew Workflow

```python
def test_crew_workflow():
    trace_id = MeshGuard.init_trace()
    crew = create_crew()
    
    result = crew.kickoff(inputs={"topic": "Test Topic"})
    
    # Verify audit trail
    # (Check via admin API or CLI)
    assert trace_id is not None
```

## Troubleshooting

### "Missing MESHGUARD_TOKEN_*"

Set tokens for each agent:

```bash
export MESHGUARD_TOKEN_RESEARCHER="eyJhbG..."
export MESHGUARD_TOKEN_WRITER="eyJhbG..."
export MESHGUARD_TOKEN_REVIEWER="eyJhbG..."
```

### Delegation Blocked

Check the `delegation` section of your policy:

```yaml
delegation:
  maxDepth: 2  # How deep delegation chains can go
  permissionCeiling:
    - "read:*"  # Delegated tasks can only use these permissions
```

### Trace Not Showing All Events

Ensure all tools use the same `MeshGuard.trace_id`:

```python
# Always initialize at the start
trace_id = MeshGuard.init_trace()
```

## Next Steps

- [LangChain Integration](./langchain.md) — For single-agent workflows
- [AutoGPT Integration](./autogpt.md) — For autonomous agents
- [Policy Reference](/guide/getting-started.md#understanding-policies) — Write custom policies
