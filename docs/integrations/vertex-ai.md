# Google Vertex AI (Agent Builder + ADK) + A2A governance with MeshGuard

MeshGuard adds **agent identity**, **policy enforcement**, and **auditing** on top of Google Vertex AI agents—especially when you operate a **multi-agent mesh** where agents delegate work to other agents (A2A / Agent-to-Agent).

This guide shows:

- How to govern **Vertex AI agents built with Google’s Agent Development Kit (ADK)**
- How to enforce policy on **A2A (Agent2Agent) communication**
- How to attach **MeshGuard checks** to tools, delegation, and cross-agent messages

> Terminology
>
> - **Vertex AI Agent Builder**: Google’s managed agent orchestration/product surface.
> - **ADK (Agent Development Kit)**: The Python SDK you use to implement agents and tools.
> - **A2A (Agent2Agent)**: A pattern/protocol where one agent delegates tasks or sends messages to another agent.
> - **MeshGuard**: Your governance layer. In this integration, MeshGuard acts as the **Policy Enforcement Point (PEP)**.

---

## Why MeshGuard for Vertex AI multi-agent systems?

Vertex AI provides strong safety controls (e.g., content safety filters, grounding tools, prompt/response moderation), but enterprise agent systems also need:

- **Agent identity & authentication**: Which agent is acting? Which org/team owns it?
- **Delegation controls**: Which agents may delegate to which other agents, and for what tasks?
- **Tool/permission enforcement**: Can this agent call this tool *right now*, given the context?
- **Unified audit** across vendors and runtimes (Vertex AI, internal services, other LLM stacks)

MeshGuard provides these as a consistent layer, independent of the underlying model provider.

---

## Architecture

A common governance placement looks like:

1. **Agent runtime** (ADK / Agent Builder)
2. **MeshGuard check** before sensitive actions:
   - tool invocation (e.g., CRM read)
   - A2A send (delegate)
   - A2A receive (accept delegation)
3. **Execute** only if permitted
4. **Log / audit** decision context + outcome

MeshGuard is the policy enforcement point for:

- `tool:*` permissions
- `data:*` permissions
- `a2a:*` permissions (cross-agent communication)

---

## Prerequisites

- Python 3.10+
- A Google Cloud project with Vertex AI enabled
- Auth configured (one of):
  - `gcloud auth application-default login` (dev)
  - Workload Identity / Service Account JSON (prod)
- MeshGuard agent token (per agent identity)

Install dependencies:

```bash
pip install google-cloud-aiplatform meshguard
```

Initialize Vertex AI:

```python
import vertexai

vertexai.init(
    project="YOUR_GCP_PROJECT_ID",
    location="us-central1",
)
```

---

## MeshGuard client setup (per agent)

Each running agent should authenticate to MeshGuard with its own **agent token**. This ensures audits and policy are tied to an agent identity.

```python
from meshguard import MeshGuardClient

meshguard = MeshGuardClient(
    gateway_url="https://dashboard.meshguard.app",
    agent_token="YOUR_AGENT_TOKEN",
)
```

---

## Pattern 1: Govern tool calls inside an ADK agent

Wrap every sensitive tool call with a MeshGuard check.

### Example: a governed CRM read tool

```python
from typing import Any, Dict
from meshguard import MeshGuardClient

class CRMTool:
    def __init__(self, meshguard: MeshGuardClient):
        self.meshguard = meshguard

    def read_contact(self, contact_id: str, *, actor: str) -> Dict[str, Any]:
        # PEP: enforce policy *before* accessing data
        decision = self.meshguard.check(
            "read:contacts",
            context={
                "actor": actor,
                "resource": {"type": "contact", "id": contact_id},
                "tool": "crm.read_contact",
            },
        )
        if not decision.get("allow", False):
            raise PermissionError(f"MeshGuard denied read:contacts: {decision}")

        # Your real CRM call here
        return {"id": contact_id, "name": "Ada Lovelace", "email": "ada@example.com"}
```

### Calling the tool from a Vertex AI Gemini model flow

The `google-cloud-aiplatform` package provides the `vertexai` Python module.

```python
import vertexai
from vertexai.generative_models import GenerativeModel

from meshguard import MeshGuardClient

vertexai.init(project="YOUR_GCP_PROJECT_ID", location="us-central1")
model = GenerativeModel("gemini-1.5-pro")

meshguard = MeshGuardClient(
    gateway_url="https://dashboard.meshguard.app",
    agent_token="YOUR_AGENT_TOKEN",
)

crm = CRMTool(meshguard)

prompt = "Fetch contact 123 and summarize the email domain."  # example
response = model.generate_content(prompt)

# In a real agent, you would parse tool intents and route to crm.read_contact
contact = crm.read_contact("123", actor="vertex-agent-1")
summary = f"{contact['email'].split('@')[-1]}"
print(summary)
```

---

## Pattern 2: Govern A2A (Agent2Agent) delegation with MeshGuard

When an agent delegates work to another agent, you should govern both sides:

- **Sender**: Is agent A allowed to delegate this task to agent B?
- **Receiver**: Is agent B allowed to accept tasks of this type from agent A?

This is where MeshGuard becomes a **policy enforcement point** for A2A.

### A2A envelope (minimal)

Use a structured envelope so policy can reason about what’s happening:

```python
from dataclasses import dataclass
from typing import Any, Dict, Optional

@dataclass
class A2AMessage:
    id: str
    sender: str
    recipient: str
    intent: str                # e.g. "research:vendor"
    payload: Dict[str, Any]
    trace_id: Optional[str] = None
```

### Sender-side enforcement (`a2a:send`)

```python
from meshguard import MeshGuardClient

def a2a_send(meshguard: MeshGuardClient, msg: A2AMessage) -> None:
    decision = meshguard.check(
        "a2a:send",
        context={
            "sender": msg.sender,
            "recipient": msg.recipient,
            "intent": msg.intent,
            "trace_id": msg.trace_id,
        },
    )
    if not decision.get("allow", False):
        raise PermissionError(f"MeshGuard denied a2a:send: {decision}")

    # Transport is up to you (HTTP, Pub/Sub, gRPC, etc.)
    # Example placeholder:
    # http_client.post(recipient_url, json=asdict(msg))
    print(f"A2A SEND -> {msg.recipient}: {msg.intent}")
```

### Receiver-side enforcement (`a2a:receive`)

```python
from meshguard import MeshGuardClient

def a2a_receive(meshguard: MeshGuardClient, msg: A2AMessage) -> None:
    decision = meshguard.check(
        "a2a:receive",
        context={
            "sender": msg.sender,
            "recipient": msg.recipient,
            "intent": msg.intent,
            "trace_id": msg.trace_id,
        },
    )
    if not decision.get("allow", False):
        raise PermissionError(f"MeshGuard denied a2a:receive: {decision}")

    print(f"A2A RECV <- {msg.sender}: {msg.intent}")
```

---

## Pattern 3: Govern ADK agent-to-agent tools (recommended placement)

In ADK, “delegation” is often just another tool call (e.g., a tool that sends a task to another agent). The simplest integration strategy is:

- implement a `delegate_to_agent()` tool
- enforce MeshGuard before sending
- enforce MeshGuard when the recipient receives

### Delegation tool example

```python
import uuid
from meshguard import MeshGuardClient

class DelegationTool:
    def __init__(self, meshguard: MeshGuardClient, *, sender: str):
        self.meshguard = meshguard
        self.sender = sender

    def delegate(self, *, recipient: str, intent: str, payload: dict, trace_id: str | None = None) -> dict:
        msg = {
            "id": str(uuid.uuid4()),
            "sender": self.sender,
            "recipient": recipient,
            "intent": intent,
            "payload": payload,
            "trace_id": trace_id,
        }

        decision = self.meshguard.check(
            "a2a:send",
            context={
                "sender": self.sender,
                "recipient": recipient,
                "intent": intent,
                "trace_id": trace_id,
            },
        )
        if not decision.get("allow", False):
            return {"ok": False, "error": "denied", "decision": decision}

        # Send via your transport
        # transport.send(msg)
        return {"ok": True, "message": msg}
```

---

## Policy guidance: what to model in MeshGuard

Typical actions to define:

- `tool:crm.read_contact`
- `data:contacts.read`
- `a2a:send`
- `a2a:receive`
- `a2a:delegate:<intent>` (optional, for finer-grained control)

Useful context fields:

- `sender`, `recipient`
- `intent` (task class)
- `trace_id` (request lineage)
- `resource` (data id/type)
- `environment` (dev/prod)

---

## Observability & audit

MeshGuard decisions should be logged with:

- agent id / token identity
- action (`a2a:send`, `read:contacts`, etc.)
- key context fields (resource, recipient, intent)
- allow/deny outcome and reason

This enables:

- incident response for delegation misuse
- demonstrating least-privilege controls
- cross-vendor audits when your mesh spans Vertex + other systems

---

## End-to-end example

See the `vertex-ai-multiagent` example in the MeshGuard examples repo for a working reference architecture:

- multiple in-process agents
- A2A envelopes
- MeshGuard checks for tool use + delegation
- minimal test suite

