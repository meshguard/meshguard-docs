# OpenAI Agents SDK Integration

Integrate MeshGuard with the OpenAI Agents SDK to govern tool calls, handoffs, and guardrails in your OpenAI-powered agents.

## Overview

The OpenAI Agents SDK provides a streamlined framework for building agents with the Responses API, built-in tools (web search, file search, computer use), and multi-agent handoffs. MeshGuard adds:

- **Tool call governance** — Policy-based control over which tools agents can invoke
- **Handoff control** — Govern agent-to-agent handoffs with permission ceilings
- **Built-in tool governance** — Control web search, file search, and computer use
- **Agent identity** — Cryptographic identity for each agent in your system
- **Unified audit trail** — Centralized logging across all agent actions

### OpenAI Safety vs MeshGuard

OpenAI provides safety features — the Moderation API, system-level safety training, and the Agents SDK's guardrails (input/output validation). MeshGuard complements these with **action governance**:

| Concern | OpenAI Safety | MeshGuard |
|---------|--------------|-----------|
| Content moderation | ✅ Moderation API | — |
| Prompt injection detection | ✅ Built-in guardrails | — |
| Output validation | ✅ SDK guardrails | — |
| Action authorization | — | ✅ Core feature |
| Agent identity | — | ✅ Tokens + trust tiers |
| Handoff governance | — | ✅ Delegation control |
| Cross-platform audit | — | ✅ Unified audit log |

**Key distinction:** OpenAI's tools show what *happened* (observability); MeshGuard controls what *can happen* (governance).

## Prerequisites

- Python 3.10+
- OpenAI API key
- `openai-agents` SDK installed
- MeshGuard account ([sign up free](https://meshguard.app))

## Installation

```bash
pip install meshguard openai-agents
```

## Quick Start

### 1. Get Your Credentials

```bash
export MESHGUARD_GATEWAY_URL="https://dashboard.meshguard.app"
export MESHGUARD_AGENT_TOKEN="your-openai-agent-token"
export OPENAI_API_KEY="your-openai-api-key"
```

### 2. Govern Agent Tool Calls

```python
from agents import Agent, Runner, function_tool
from meshguard import MeshGuardClient

# Initialize MeshGuard
mesh = MeshGuardClient()


def governed_function_tool(action: str, client: MeshGuardClient):
    """Decorator combining @function_tool with MeshGuard governance."""
    def decorator(func):
        @function_tool
        async def wrapper(*args, **kwargs):
            # Check permission before executing
            decision = client.check(
                action=action,
                context={"tool": func.__name__},
            )
            
            if not decision.allowed:
                return f"Action blocked by policy: {decision.reason}"
            
            result = await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)
            
            # Log for audit
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


@governed_function_tool("read:customer_data", client=mesh)
def lookup_customer(email: str) -> str:
    """Look up a customer by email address."""
    return customer_db.get_by_email(email)


@governed_function_tool("read:order_history", client=mesh)
def get_orders(customer_id: str) -> str:
    """Get order history for a customer."""
    return orders_db.get_history(customer_id)


@governed_function_tool("write:refund", client=mesh)
def process_refund(order_id: str, amount: float, reason: str) -> str:
    """Process a refund — requires elevated permissions."""
    return payments.refund(order_id, amount, reason)


# Create the agent with governed tools
support_agent = Agent(
    name="Customer Support",
    instructions="""You are a customer support agent. All your actions are 
    governed by enterprise policy. If an action is blocked, apologize and 
    explain that you need to escalate to a human agent.""",
    tools=[lookup_customer, get_orders, process_refund],
)
```

### 3. Run the Agent

```python
import asyncio

async def main():
    result = await Runner.run(
        support_agent,
        "I need a refund for order #12345, the product was damaged.",
    )
    print(result.final_output)

asyncio.run(main())
```

## Governing Built-in Tools

The OpenAI Agents SDK includes powerful built-in tools. Govern their usage with MeshGuard:

### Web Search Governance

```python
from agents import Agent, Runner, WebSearchTool
from meshguard import MeshGuardClient

mesh = MeshGuardClient()


class GovernedWebSearchTool(WebSearchTool):
    """Web search tool with MeshGuard governance."""
    
    async def on_invoke(self, context, input_data):
        """Override invoke to add governance."""
        decision = mesh.check(
            action="read:web_search",
            context={"query": str(input_data)[:200]},
        )
        
        if not decision.allowed:
            return f"Web search blocked: {decision.reason}"
        
        result = await super().on_invoke(context, input_data)
        
        mesh.audit_log(
            action="read:web_search",
            decision="allowed",
            metadata={"query": str(input_data)[:200]},
        )
        return result


# Agent with governed web search
research_agent = Agent(
    name="Researcher",
    instructions="Research topics using web search. All searches are governed by policy.",
    tools=[GovernedWebSearchTool()],
)
```

### File Search Governance

```python
from agents import Agent, FileSearchTool
from meshguard import MeshGuardClient

mesh = MeshGuardClient()


class GovernedFileSearchTool(FileSearchTool):
    """File search tool with MeshGuard governance."""
    
    async def on_invoke(self, context, input_data):
        decision = mesh.check(
            action="read:file_search",
            context={"query": str(input_data)[:200]},
        )
        
        if not decision.allowed:
            return f"File search blocked: {decision.reason}"
        
        result = await super().on_invoke(context, input_data)
        
        mesh.audit_log(
            action="read:file_search",
            decision="allowed",
            metadata={"query": str(input_data)[:200]},
        )
        return result


knowledge_agent = Agent(
    name="Knowledge Base",
    instructions="Answer questions using the knowledge base.",
    tools=[GovernedFileSearchTool(vector_store_ids=["vs_abc123"])],
)
```

### Computer Use Governance

```python
from agents import Agent, ComputerTool
from meshguard import MeshGuardClient

mesh = MeshGuardClient()


class GovernedComputerTool(ComputerTool):
    """Computer use tool with MeshGuard governance."""
    
    async def on_invoke(self, context, input_data):
        # Computer use requires strict governance
        decision = mesh.check(
            action="execute:computer_use",
            context={
                "action_type": input_data.get("action", "unknown"),
                "target": input_data.get("coordinate", ""),
            },
        )
        
        if not decision.allowed:
            return f"Computer action blocked: {decision.reason}"
        
        result = await super().on_invoke(context, input_data)
        
        mesh.audit_log(
            action="execute:computer_use",
            decision="allowed",
            metadata={
                "action_type": input_data.get("action"),
                "target": str(input_data.get("coordinate", ""))[:100],
            },
        )
        return result


# Computer use agent with strict governance
automation_agent = Agent(
    name="Automation Agent",
    instructions="Automate browser tasks. All actions are governed by strict policy.",
    tools=[GovernedComputerTool()],
)
```

## Governing Agent Handoffs

The Agents SDK supports handoffs between agents. MeshGuard governs who can hand off to whom:

```python
from agents import Agent, Runner, function_tool, handoff
from meshguard import MeshGuardClient

mesh = MeshGuardClient()


def governed_handoff(target_agent: Agent, client: MeshGuardClient):
    """Create a governed handoff to another agent."""
    original_handoff = handoff(target_agent)
    
    async def governed_handoff_fn(context):
        # Check if handoff is permitted
        decision = client.check(
            action=f"handoff:{target_agent.name}",
            context={
                "from_agent": context.agent.name,
                "to_agent": target_agent.name,
            },
        )
        
        if not decision.allowed:
            return f"Handoff to {target_agent.name} blocked: {decision.reason}"
        
        client.audit_log(
            action=f"handoff:{target_agent.name}",
            decision="allowed",
            metadata={
                "from_agent": context.agent.name,
                "to_agent": target_agent.name,
            },
        )
        
        return await original_handoff(context)
    
    return governed_handoff_fn


# Define specialized agents
@governed_function_tool("read:customer_data", client=mesh)
def lookup_customer(email: str) -> str:
    """Look up customer by email."""
    return customer_db.get_by_email(email)


@governed_function_tool("write:refund", client=mesh)
def process_refund(order_id: str, amount: float, reason: str) -> str:
    """Process a refund."""
    return payments.refund(order_id, amount, reason)


@governed_function_tool("write:escalation", client=mesh)
def escalate_to_human(ticket_id: str, reason: str) -> str:
    """Escalate to human support."""
    return ticketing.escalate(ticket_id, reason)


# Tier 1: Basic support
tier1_agent = Agent(
    name="Tier 1 Support",
    instructions="""You handle initial customer inquiries. You can look up 
    customer information. For refunds, hand off to the billing specialist. 
    For complex issues, hand off to the escalation agent.""",
    tools=[lookup_customer],
    handoffs=[],  # Will be set after other agents are defined
)

# Tier 2: Billing specialist
billing_agent = Agent(
    name="Billing Specialist",
    instructions="""You handle billing and refund requests. You can process 
    refunds up to $100. For larger amounts, hand off to escalation.""",
    tools=[lookup_customer, process_refund],
    handoffs=[],
)

# Tier 3: Escalation
escalation_agent = Agent(
    name="Escalation Manager",
    instructions="""You handle escalated issues. You can process any refund 
    and escalate to human support when needed.""",
    tools=[lookup_customer, process_refund, escalate_to_human],
)

# Set up governed handoffs
tier1_agent.handoffs = [
    governed_handoff(billing_agent, mesh),
    governed_handoff(escalation_agent, mesh),
]

billing_agent.handoffs = [
    governed_handoff(escalation_agent, mesh),
]
```

### Running Multi-Agent with Governed Handoffs

```python
import asyncio

async def handle_customer_request(message: str):
    """Handle a customer request with governed multi-agent handoffs."""
    result = await Runner.run(
        tier1_agent,
        message,
    )
    
    print(f"Final agent: {result.last_agent.name}")
    print(f"Response: {result.final_output}")
    
    return result

# Run
asyncio.run(handle_customer_request(
    "I need a refund for order #12345, the item arrived broken"
))
```

## Adding MeshGuard Guardrails Alongside OpenAI Guardrails

The Agents SDK has its own guardrails for input/output validation. Layer MeshGuard governance on top:

```python
from agents import Agent, Runner, InputGuardrail, OutputGuardrail, GuardrailFunctionOutput
from meshguard import MeshGuardClient
from pydantic import BaseModel

mesh = MeshGuardClient()


# OpenAI SDK guardrail: Content validation
class ContentSafetyCheck(BaseModel):
    is_safe: bool
    reason: str = ""


async def content_safety_guardrail(context, agent, input_data) -> GuardrailFunctionOutput:
    """OpenAI guardrail for content safety."""
    # Use OpenAI to check content safety
    result = await Runner.run(
        Agent(
            name="Safety Checker",
            instructions="Check if the input is safe. Return is_safe=False for harmful content.",
            output_type=ContentSafetyCheck,
        ),
        input_data,
    )
    
    return GuardrailFunctionOutput(
        output_info=result.final_output,
        tripwire_triggered=not result.final_output.is_safe,
    )


# MeshGuard guardrail: Action authorization
async def meshguard_action_guardrail(context, agent, input_data) -> GuardrailFunctionOutput:
    """MeshGuard guardrail for action-level governance."""
    decision = mesh.check(
        action=f"invoke:{agent.name}",
        context={"input_length": len(str(input_data))},
    )
    
    return GuardrailFunctionOutput(
        output_info={"allowed": decision.allowed, "reason": decision.reason},
        tripwire_triggered=not decision.allowed,
    )


# Agent with both guardrail layers
governed_agent = Agent(
    name="Customer Support",
    instructions="Help customers with their requests.",
    tools=[lookup_customer, process_refund],
    input_guardrails=[
        InputGuardrail(guardrail_function=content_safety_guardrail),
        InputGuardrail(guardrail_function=meshguard_action_guardrail),
    ],
)
```

## Tracing and Audit Integration

The Agents SDK includes tracing for observability. Integrate with MeshGuard audit for combined visibility:

```python
from agents import Agent, Runner, trace
from meshguard import MeshGuardClient
import uuid

mesh = MeshGuardClient()


async def run_with_audit(agent: Agent, message: str, user_id: str) -> dict:
    """Run an agent with combined OpenAI tracing and MeshGuard audit."""
    trace_id = str(uuid.uuid4())
    
    # Start MeshGuard trace
    mesh.audit_log(
        action="session:start",
        decision="allowed",
        metadata={
            "trace_id": trace_id,
            "user_id": user_id,
            "agent": agent.name,
        },
    )
    
    # Run with OpenAI tracing
    with trace(workflow_name=f"governed-{agent.name}", trace_id=trace_id):
        result = await Runner.run(agent, message)
    
    # Log completion
    mesh.audit_log(
        action="session:complete",
        decision="allowed",
        metadata={
            "trace_id": trace_id,
            "final_agent": result.last_agent.name,
            "output_length": len(result.final_output),
        },
    )
    
    return {
        "output": result.final_output,
        "trace_id": trace_id,
        "final_agent": result.last_agent.name,
    }
```

## Full Example: Governed Customer Support System

```python
#!/usr/bin/env python3
"""
Customer support system using OpenAI Agents SDK with MeshGuard governance.
"""

import asyncio
import os
import uuid
from agents import Agent, Runner, function_tool
from meshguard import MeshGuardClient

# Initialize MeshGuard
mesh = MeshGuardClient(
    gateway_url=os.getenv("MESHGUARD_GATEWAY_URL", "https://dashboard.meshguard.app"),
    agent_token=os.getenv("MESHGUARD_AGENT_TOKEN"),
)


# --- Governed Tools ---

@function_tool
def lookup_customer(email: str) -> str:
    """Look up a customer by email address."""
    decision = mesh.check("read:customer_data", context={"email": email})
    if not decision.allowed:
        return f"🚫 Customer lookup blocked: {decision.reason}"
    
    mesh.audit_log(action="read:customer_data", decision="allowed",
                   metadata={"email": email})
    # Mock implementation
    return f"Customer found: John Doe (john@example.com), ID: CUST-001, Gold tier"


@function_tool
def get_order_details(order_id: str) -> str:
    """Get details for a specific order."""
    decision = mesh.check("read:order_data", context={"order_id": order_id})
    if not decision.allowed:
        return f"🚫 Order lookup blocked: {decision.reason}"
    
    mesh.audit_log(action="read:order_data", decision="allowed",
                   metadata={"order_id": order_id})
    return f"Order {order_id}: Wireless Headphones, $79.99, delivered 2024-01-15"


@function_tool
def process_refund(order_id: str, amount: float, reason: str) -> str:
    """Process a refund for an order. Governed by MeshGuard policy."""
    decision = mesh.check(
        "write:refund",
        context={"order_id": order_id, "amount": amount, "reason": reason},
    )
    if not decision.allowed:
        return f"🚫 Refund blocked: {decision.reason}"
    
    mesh.audit_log(
        action="write:refund",
        decision="allowed",
        metadata={"order_id": order_id, "amount": amount, "reason": reason},
    )
    return f"✅ Refund of ${amount:.2f} processed for order {order_id}. Ref: REF-{uuid.uuid4().hex[:8]}"


@function_tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email to a customer."""
    decision = mesh.check("write:email", context={"to": to})
    if not decision.allowed:
        return f"🚫 Email blocked: {decision.reason}"
    
    mesh.audit_log(action="write:email", decision="allowed",
                   metadata={"to": to, "subject": subject})
    return f"✅ Email sent to {to}: {subject}"


# --- Agent Definition ---

support_agent = Agent(
    name="Customer Support Agent",
    instructions="""You are a helpful customer support agent for an e-commerce company.

Your capabilities are governed by enterprise policy. You can:
- Look up customer information
- Check order details
- Process refunds (subject to policy limits)
- Send confirmation emails

If any action is blocked by policy:
1. Acknowledge the limitation clearly
2. Explain that you need to escalate
3. Offer alternatives within your capabilities

Always be professional, empathetic, and transparent about your limitations.""",
    tools=[lookup_customer, get_order_details, process_refund, send_email],
)


# --- Main ---

async def main():
    trace_id = str(uuid.uuid4())
    print(f"\n🔍 MeshGuard Trace: {trace_id}")
    print(f"   View: meshguard audit trace {trace_id}\n")
    
    queries = [
        "Can you look up the customer with email john@example.com?",
        "What's the status of order ORD-2024-001?",
        "I need a refund of $79.99 for order ORD-2024-001, the product was defective.",
    ]
    
    for query in queries:
        print(f"👤 User: {query}")
        result = await Runner.run(support_agent, query)
        print(f"🤖 Agent: {result.final_output}\n")
    
    print(f"🔍 Full audit: meshguard audit trace {trace_id}")


if __name__ == "__main__":
    asyncio.run(main())
```

## Audit Trail

Every governed action is logged:

```python
audit = mesh.get_audit_log(limit=10)

for entry in audit:
    print(f"{entry['timestamp']} - {entry['action']} - {entry['decision']}")
```

Or via CLI:
```bash
meshguard audit query --agent openai-support-agent
```

## Configuration Reference

### Environment Variables

| Variable | Description |
|----------|-------------|
| `MESHGUARD_GATEWAY_URL` | MeshGuard gateway URL |
| `MESHGUARD_AGENT_TOKEN` | Agent authentication token |
| `MESHGUARD_ADMIN_TOKEN` | Admin token (for management APIs) |
| `OPENAI_API_KEY` | OpenAI API key |

### Policy Example

```yaml
name: openai-support-agent-policy
version: "1.0"
description: Policy for OpenAI Agents SDK customer support

appliesTo:
  tags:
    - openai
    - support

rules:
  # Allow customer data reads
  - effect: allow
    actions:
      - "read:customer_data"
      - "read:order_data"

  # Allow web search
  - effect: allow
    actions:
      - "read:web_search"

  # Allow file search on approved vector stores
  - effect: allow
    actions:
      - "read:file_search"

  # Allow refunds under $100
  - effect: allow
    actions:
      - "write:refund"
    conditions:
      amount_max: 100

  # Block large refunds
  - effect: deny
    actions:
      - "write:refund"
    conditions:
      amount_min: 100.01
    reason: "Refunds over $100 require manager approval"

  # Allow email sending during business hours
  - effect: allow
    actions:
      - "write:email"
    conditions:
      time_range: "09:00-18:00"

  # Block computer use by default
  - effect: deny
    actions:
      - "execute:computer_use"
    reason: "Computer use requires explicit admin approval"

  # Allow handoff to billing
  - effect: allow
    actions:
      - "handoff:Billing Specialist"

  # Allow handoff to escalation
  - effect: allow
    actions:
      - "handoff:Escalation Manager"

defaultEffect: deny
```

## Troubleshooting

### Governed tools not blocking actions

Ensure the MeshGuard check happens before the tool logic:

```python
@function_tool
def my_tool(param: str) -> str:
    # ✅ Check FIRST
    decision = mesh.check("action:name")
    if not decision.allowed:
        return f"Blocked: {decision.reason}"
    
    # Then execute
    return do_something(param)
```

### Handoffs not being governed

Make sure you're using `governed_handoff()` instead of the raw `handoff()`:

```python
# ❌ Ungoverned
agent.handoffs = [handoff(other_agent)]

# ✅ Governed
agent.handoffs = [governed_handoff(other_agent, mesh)]
```

### Async compatibility issues

The Agents SDK is async-first. Ensure your governance checks work in async context:

```python
# If using sync MeshGuard client in async context
import asyncio

decision = await asyncio.to_thread(mesh.check, "action:name")
```

## Next Steps

- [Python SDK Reference](/integrations/python) — Full SDK documentation
- [Policy Configuration](/guide/policies) — Define what agents can do
- [Bedrock Integration](/integrations/bedrock) — For AWS Bedrock agents
- [Vertex AI Integration](/integrations/vertex-ai) — For Google Cloud agents
- [API Reference](/api/overview) — Direct API access
