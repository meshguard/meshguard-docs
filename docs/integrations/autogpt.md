# AutoGPT Integration

Integrate MeshGuard with AutoGPT to add governance, policy enforcement, and audit logging to autonomous AI agents.

## Overview

AutoGPT agents operate with significant autonomy, making governance especially important. MeshGuard provides:

- **Action-level control** — Govern every command the agent executes
- **Rate limiting** — Prevent runaway autonomous loops
- **Audit trail** — Complete history of all agent actions
- **Kill switch** — Instantly revoke an agent's permissions

## Prerequisites

- Python 3.10+
- AutoGPT installed (from [agpt.co](https://agpt.co))
- MeshGuard gateway running (see [Quickstart](/guide/quickstart.md))
- An agent token from MeshGuard

## Installation

There are two approaches:

1. **Plugin approach** — Add MeshGuard as an AutoGPT plugin
2. **Wrapper approach** — Wrap AutoGPT commands through MeshGuard

This guide covers both.

## Quick Start

### 1. Create a MeshGuard Agent

```bash
# Create an agent with appropriate trust level
meshguard agent create autogpt-agent \
  --trust verified \
  --tags autogpt,autonomous

# Save the token!
```

### 2. Create a Policy

Create `policies/autogpt.yaml`:

```yaml
name: autogpt-policy
version: "1.0"
description: Policy for AutoGPT autonomous agents

appliesTo:
  tags:
    - autogpt

rules:
  # Allow information gathering
  - effect: allow
    actions:
      - "read:*"
      - "search:web"
      - "browse:*"

  # Allow file operations in workspace
  - effect: allow
    actions:
      - "write:workspace/*"
      - "read:workspace/*"
  
  # Allow code execution (sandboxed)
  - effect: allow
    actions:
      - "execute:python"
      - "execute:javascript"

  # DENY dangerous operations
  - effect: deny
    actions:
      - "execute:shell"      # No shell access
      - "write:system/*"     # No system file writes
      - "delete:*"           # No deletions
      - "send:email"         # No email sending
      - "pay:*"              # No financial transactions

defaultEffect: deny

# Rate limits for autonomous agents
rateLimits:
  requestsPerMinute: 30
  requestsPerHour: 500
```

## Method 1: Plugin Approach

### Create the Plugin

Create `autogpt-meshguard-plugin/`:

```
autogpt-meshguard-plugin/
├── __init__.py
├── meshguard_plugin.py
└── pyproject.toml
```

**`__init__.py`:**

```python
from .meshguard_plugin import MeshGuardPlugin

__all__ = ["MeshGuardPlugin"]
```

**`meshguard_plugin.py`:**

```python
"""
MeshGuard Plugin for AutoGPT
Intercepts commands and routes them through MeshGuard for governance.
"""

import os
import requests
from typing import Any, Dict, Optional
from auto_gpt_plugin_template import AutoGPTPluginTemplate

MESHGUARD_URL = os.getenv("MESHGUARD_URL", "http://localhost:3100")
MESHGUARD_TOKEN = os.getenv("MESHGUARD_TOKEN")


class MeshGuardPlugin(AutoGPTPluginTemplate):
    """
    MeshGuard governance plugin for AutoGPT.
    """

    def __init__(self):
        super().__init__()
        self._name = "MeshGuard-Plugin"
        self._version = "0.1.0"
        self._description = "Governance control plane integration for AutoGPT"
        
        if not MESHGUARD_TOKEN:
            raise ValueError("MESHGUARD_TOKEN environment variable required")
        
        self.session = requests.Session()
        self.session.headers["Authorization"] = f"Bearer {MESHGUARD_TOKEN}"
        self.session.headers["Content-Type"] = "application/json"

    def _check_permission(self, action: str, resource: str) -> bool:
        """Check if an action is allowed by MeshGuard policy."""
        try:
            response = self.session.post(
                f"{MESHGUARD_URL}/proxy/governance/check",
                json={
                    "action": action,
                    "resource": resource
                }
            )
            return response.status_code == 200
        except requests.RequestException:
            # Fail closed - deny on error
            return False

    def _record_action(self, action: str, resource: str, result: str):
        """Record an action in the MeshGuard audit log."""
        try:
            self.session.post(
                f"{MESHGUARD_URL}/proxy/governance/record",
                json={
                    "action": action,
                    "resource": resource,
                    "result": result[:500]  # Truncate long results
                }
            )
        except requests.RequestException:
            pass  # Best effort logging

    def can_handle_pre_command(self) -> bool:
        return True

    def pre_command(
        self, 
        command_name: str, 
        arguments: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Called before each command. Check permission with MeshGuard.
        Return None to block, or the arguments to proceed.
        """
        # Map command names to MeshGuard actions
        action_map = {
            "browse_website": "browse:web",
            "read_file": "read:workspace",
            "write_file": "write:workspace",
            "execute_python_code": "execute:python",
            "execute_shell": "execute:shell",
            "google_search": "search:web",
            "send_email": "send:email",
            "delete_file": "delete:workspace",
        }
        
        action = action_map.get(command_name, f"execute:{command_name}")
        resource = str(arguments.get("filename", arguments.get("url", "*")))
        
        if not self._check_permission(action, resource):
            print(f"🛡️ MeshGuard: Blocked '{command_name}' - policy denied")
            return None  # Block the command
        
        print(f"🛡️ MeshGuard: Allowed '{command_name}'")
        return arguments  # Allow the command

    def can_handle_post_command(self) -> bool:
        return True

    def post_command(self, command_name: str, response: str) -> str:
        """Called after each command. Record in audit log."""
        self._record_action(
            action=command_name,
            resource="autogpt-output",
            result=response
        )
        return response

    def can_handle_on_response(self) -> bool:
        return False

    def can_handle_pre_instruction(self) -> bool:
        return False

    def can_handle_on_planning(self) -> bool:
        return False

    def can_handle_post_planning(self) -> bool:
        return False

    def can_handle_pre_prompt(self) -> bool:
        return False

    def can_handle_chat_completion(
        self, 
        messages: list, 
        model: str, 
        temperature: float, 
        max_tokens: int
    ) -> bool:
        return False
```

**`pyproject.toml`:**

```toml
[build-system]
requires = ["setuptools>=45", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "autogpt-meshguard-plugin"
version = "0.1.0"
description = "MeshGuard governance plugin for AutoGPT"
requires-python = ">=3.10"
dependencies = [
    "requests>=2.28.0",
]

[project.entry-points."autogpt_plugins"]
meshguard = "meshguard_plugin:MeshGuardPlugin"
```

### Install the Plugin

```bash
# From the plugin directory
pip install -e .

# Or install directly
pip install autogpt-meshguard-plugin
```

### Configure AutoGPT

Add to your AutoGPT `.env`:

```bash
# MeshGuard Configuration
MESHGUARD_URL=http://localhost:3100
MESHGUARD_TOKEN=your-agent-token-here

# Enable the plugin
ALLOWLISTED_PLUGINS=autogpt-meshguard-plugin
```

## Method 2: Wrapper Approach

If you can't use plugins, wrap AutoGPT's command execution:

### Create a Wrapper Script

**`meshguard_autogpt.py`:**

```python
#!/usr/bin/env python3
"""
MeshGuard wrapper for AutoGPT command execution.
Intercepts all commands and routes them through MeshGuard.
"""

import os
import sys
import json
import requests
from typing import Any, Callable, Optional
from functools import wraps

# Configuration
MESHGUARD_URL = os.getenv("MESHGUARD_URL", "http://localhost:3100")
MESHGUARD_TOKEN = os.getenv("MESHGUARD_TOKEN")

if not MESHGUARD_TOKEN:
    print("ERROR: Set MESHGUARD_TOKEN environment variable")
    sys.exit(1)


class MeshGuardGateway:
    """Gateway for all AutoGPT commands."""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers["Authorization"] = f"Bearer {MESHGUARD_TOKEN}"
        self.trace_id = None
    
    def set_trace(self, trace_id: str):
        self.trace_id = trace_id
        self.session.headers["X-Trace-ID"] = trace_id
    
    def check_permission(self, action: str, resource: str = "*") -> dict:
        """Check if action is allowed. Returns decision details."""
        response = self.session.post(
            f"{MESHGUARD_URL}/proxy/governance/check",
            json={"action": action, "resource": resource}
        )
        
        if response.status_code == 403:
            return {
                "allowed": False,
                "reason": response.json().get("reason", "Policy denied")
            }
        
        return {"allowed": True, "reason": None}
    
    def execute(
        self, 
        action: str, 
        resource: str, 
        executor: Callable[[], Any]
    ) -> Any:
        """Execute an action through MeshGuard governance."""
        
        # Check permission
        decision = self.check_permission(action, resource)
        
        if not decision["allowed"]:
            return {
                "status": "blocked",
                "action": action,
                "reason": decision["reason"]
            }
        
        # Execute the actual command
        try:
            result = executor()
            status = "success"
        except Exception as e:
            result = str(e)
            status = "error"
        
        # Record in audit log
        self.session.post(
            f"{MESHGUARD_URL}/proxy/governance/record",
            json={
                "action": action,
                "resource": resource,
                "status": status,
                "result": str(result)[:1000]
            }
        )
        
        return result


gateway = MeshGuardGateway()


def governed(action: str, resource_key: str = None):
    """
    Decorator to govern a function through MeshGuard.
    
    Args:
        action: The MeshGuard action (e.g., "browse:web")
        resource_key: Kwarg name to use as resource (optional)
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Determine resource
            resource = "*"
            if resource_key and resource_key in kwargs:
                resource = str(kwargs[resource_key])
            
            # Execute through gateway
            return gateway.execute(
                action=action,
                resource=resource,
                executor=lambda: func(*args, **kwargs)
            )
        return wrapper
    return decorator


# --- Governed AutoGPT Commands ---
# Wrap the actual AutoGPT command implementations

@governed("browse:web", "url")
def browse_website(url: str, question: str = "") -> str:
    """Browse a website (governed)."""
    # Import and call the actual AutoGPT implementation
    from autogpt.commands.web_browser import browse_website as _browse
    return _browse(url, question)


@governed("read:workspace", "filename")
def read_file(filename: str) -> str:
    """Read a file (governed)."""
    from autogpt.commands.file_operations import read_file as _read
    return _read(filename)


@governed("write:workspace", "filename")
def write_file(filename: str, contents: str) -> str:
    """Write a file (governed)."""
    from autogpt.commands.file_operations import write_file as _write
    return _write(filename, contents)


@governed("execute:python")
def execute_python_code(code: str) -> str:
    """Execute Python code (governed)."""
    from autogpt.commands.execute_code import execute_python_code as _exec
    return _exec(code)


@governed("execute:shell")
def execute_shell(command: str) -> str:
    """Execute shell command (governed)."""
    from autogpt.commands.execute_code import execute_shell as _exec
    return _exec(command)


@governed("search:web", "query")
def google_search(query: str, num_results: int = 8) -> str:
    """Google search (governed)."""
    from autogpt.commands.web_search import google_search as _search
    return _search(query, num_results)


# --- Monkey Patching ---
def patch_autogpt():
    """Replace AutoGPT commands with governed versions."""
    import autogpt.commands.web_browser
    import autogpt.commands.file_operations
    import autogpt.commands.execute_code
    import autogpt.commands.web_search
    
    autogpt.commands.web_browser.browse_website = browse_website
    autogpt.commands.file_operations.read_file = read_file
    autogpt.commands.file_operations.write_file = write_file
    autogpt.commands.execute_code.execute_python_code = execute_python_code
    autogpt.commands.execute_code.execute_shell = execute_shell
    autogpt.commands.web_search.google_search = google_search
    
    print("🛡️ MeshGuard: AutoGPT commands patched")


if __name__ == "__main__":
    # Patch and run AutoGPT
    patch_autogpt()
    
    # Import and run AutoGPT main
    from autogpt.main import main
    main()
```

### Run with Wrapper

```bash
# Set your token
export MESHGUARD_TOKEN="your-token-here"

# Run AutoGPT through the wrapper
python meshguard_autogpt.py
```

## Configuration

### Environment Variables

```bash
# Required
MESHGUARD_TOKEN=eyJhbG...       # Your agent token

# Optional
MESHGUARD_URL=http://localhost:3100  # Gateway URL (default)
MESHGUARD_TRACE_ID=custom-trace-id   # Custom trace ID
```

### Recommended Policy Settings

For autonomous agents, use restrictive defaults:

```yaml
name: autogpt-production
version: "1.0"
description: Production policy for AutoGPT

appliesTo:
  tags:
    - autogpt
    - production

rules:
  # Read-only web access
  - effect: allow
    actions:
      - "browse:web"
      - "search:web"
    conditions:
      rateLimit:
        requestsPerMinute: 10

  # Limited file operations
  - effect: allow
    actions:
      - "read:workspace/*"
      - "write:workspace/*"
    conditions:
      # Only within workspace directory
      resourcePattern: "workspace/*"

  # Sandboxed code execution only
  - effect: allow
    actions:
      - "execute:python"
    conditions:
      # Execution must be in sandbox
      sandbox: true

  # Deny everything dangerous
  - effect: deny
    actions:
      - "execute:shell"
      - "delete:*"
      - "send:*"
      - "pay:*"
      - "admin:*"

defaultEffect: deny

# Strict rate limits for autonomous operation
rateLimits:
  requestsPerMinute: 30
  requestsPerHour: 300
  
# Require human approval for certain actions
humanInTheLoop:
  requireApproval:
    - "send:email"
    - "post:social"
    - "pay:*"
```

## Monitoring Autonomous Agents

### Real-Time Monitoring

```bash
# Follow the audit log in real-time
meshguard audit tail --follow --agent autogpt-agent

# Watch for policy denials
meshguard audit tail --follow --decision deny
```

### Rate Limit Alerts

```bash
# Check current rate usage
meshguard audit stats --agent autogpt-agent --period 1

# See hourly breakdown
meshguard audit stats --agent autogpt-agent --period 24 --breakdown hourly
```

### Emergency Revocation

If an agent is misbehaving:

```bash
# Immediately revoke the agent
meshguard agent revoke autogpt-agent

# The agent's next request will receive 401 Unauthorized
```

## Testing

### Test Policy Enforcement

```python
import pytest
from meshguard_autogpt import gateway

def test_allowed_action():
    """Test that allowed actions pass."""
    decision = gateway.check_permission("browse:web", "https://example.com")
    assert decision["allowed"] == True

def test_denied_action():
    """Test that shell execution is blocked."""
    decision = gateway.check_permission("execute:shell", "rm -rf /")
    assert decision["allowed"] == False
    assert "denied" in decision["reason"].lower()

def test_rate_limiting():
    """Test that rate limits are enforced."""
    # Make many requests quickly
    for i in range(50):
        gateway.check_permission("browse:web", f"https://example.com/{i}")
    
    # Next request should be rate limited
    decision = gateway.check_permission("browse:web", "https://example.com/final")
    assert decision["allowed"] == False
    assert "rate" in decision["reason"].lower()
```

### Integration Test

```python
def test_full_workflow():
    """Test a complete AutoGPT workflow through MeshGuard."""
    import uuid
    
    # Set trace for this test
    trace_id = str(uuid.uuid4())
    gateway.set_trace(trace_id)
    
    # Simulate AutoGPT workflow
    results = []
    
    # 1. Web search (should succeed)
    result = google_search("Python tutorials")
    assert "blocked" not in str(result).lower()
    results.append(("search", result))
    
    # 2. Browse website (should succeed)
    result = browse_website("https://python.org")
    assert "blocked" not in str(result).lower()
    results.append(("browse", result))
    
    # 3. Write file (should succeed)
    result = write_file("workspace/notes.txt", "Some notes")
    assert "blocked" not in str(result).lower()
    results.append(("write", result))
    
    # 4. Execute Python (should succeed)
    result = execute_python_code("print('Hello')")
    assert "blocked" not in str(result).lower()
    results.append(("python", result))
    
    # 5. Execute shell (should be BLOCKED)
    result = execute_shell("ls -la")
    assert result["status"] == "blocked"
    results.append(("shell", result))
    
    print(f"\n🔍 View audit: meshguard audit trace {trace_id}")
    return results
```

## Troubleshooting

### "401 Unauthorized"

Token expired or invalid:

```bash
# Generate new token
meshguard agent token autogpt-agent

# Update environment
export MESHGUARD_TOKEN="new-token"
```

### "403 Forbidden" on Expected Allow

Check your policy:

```bash
# See what actions are allowed
meshguard policy allowed autogpt-agent

# Test a specific action
meshguard policy test autogpt-agent "browse:web"
```

### Rate Limited

Adjust rate limits in policy or wait:

```bash
# Check current usage
meshguard audit stats --agent autogpt-agent --period 1
```

### Plugin Not Loading

Verify plugin installation:

```bash
# Check plugin is installed
pip list | grep meshguard

# Verify allowlist in AutoGPT .env
grep ALLOWLISTED_PLUGINS .env
```

## Security Considerations

### For Production Autonomous Agents

1. **Use restrictive policies** — Start with deny-all, allow specific actions
2. **Enable rate limiting** — Prevent runaway loops
3. **Set up alerts** — Monitor for policy violations
4. **Prepare kill switch** — Know how to revoke instantly
5. **Regular audits** — Review audit logs weekly
6. **Separate tokens** — Each AutoGPT instance gets its own token

### Human-in-the-Loop

For sensitive actions, require human approval:

```python
class HumanApprovalRequired(Exception):
    pass

@governed("send:email", "recipient")
def send_email(recipient: str, subject: str, body: str):
    # Check if human approval is needed
    decision = gateway.check_permission("send:email", recipient)
    
    if decision.get("requires_approval"):
        raise HumanApprovalRequired(
            f"Email to {recipient} requires human approval. "
            f"Approval ID: {decision.get('approval_id')}"
        )
    
    # Proceed with sending
    ...
```

## Next Steps

- [LangChain Integration](./langchain.md) — For chain-based agents
- [CrewAI Integration](./crewai.md) — For multi-agent systems
- [Generic HTTP Integration](/integrations/http.md) — For custom setups
- [Policy Reference](/guide/getting-started.md#understanding-policies) — Write custom policies
