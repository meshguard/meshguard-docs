---
title: "Claude Code Integration"
description: "Full technical reference for integrating MeshGuard governance with Claude Code AI coding agents"
---

# Claude Code Integration

Integrate MeshGuard's governance control plane with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — Anthropic's agentic CLI for autonomous coding — to enforce policies on every file access, shell command, and web request.

## Overview

Claude Code is a powerful autonomous coding agent with:

- **File system access** — Read, Write, and Edit tools operate directly on your codebase
- **Shell command execution** — Runs arbitrary Bash commands via the `exec` tool
- **Web browsing** — Fetches URLs and searches the web
- **MCP server support** — Connects to external tool servers via the Model Context Protocol
- **Hooks system** — Pre/post tool interception via `.claude/settings.json`
- **CLAUDE.md instructions** — Project-level instructions the agent follows

These capabilities make Claude Code extraordinarily productive — and extraordinarily risky without governance.

### Claude Code Built-in Permissions vs MeshGuard

Claude Code has a built-in permission system (allow/deny lists in `.claude/settings.json`). MeshGuard complements and extends this:

| Concern | Claude Code Built-in | MeshGuard |
|---------|---------------------|-----------|
| Tool allow/deny lists | ✅ Static allowlists | ✅ Dynamic, context-aware policies |
| File path restrictions | 🟡 Via permission prompts | ✅ Pattern-based allow/deny rules |
| Shell command filtering | 🟡 Regex-based allowlist | ✅ Semantic command governance |
| Per-project settings | ✅ `.claude/settings.json` | ✅ Centralized + per-project policies |
| Centralized policy management | ❌ Local config only | ✅ Dashboard + API |
| Audit logging | ❌ No built-in audit | ✅ Full audit trail |
| Cross-agent governance | ❌ Single agent only | ✅ Multi-agent, multi-framework |
| Trust tiers | ❌ Binary allow/deny | ✅ Graduated trust levels |
| Runtime context evaluation | ❌ Static rules only | ✅ Time, resource, context conditions |
| Anomaly detection | ❌ Not supported | ✅ Pattern-based alerting |

**Key distinction:** Claude Code's built-in permissions are static, local, and binary. MeshGuard adds dynamic, centralized, context-aware governance with full audit trails.

## Prerequisites

- Python 3.9+
- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)
- MeshGuard account ([sign up free](https://meshguard.app))

## Installation

```bash
pip install meshguard
```

Or with all optional dependencies:

```bash
pip install meshguard[all]
```

## Configuration

### Environment Variables

Set these in your shell profile or `.env`:

```bash
export MESHGUARD_API_KEY="mg_live_abc123..."
export MESHGUARD_GATEWAY_URL="https://dashboard.meshguard.app"
export MESHGUARD_AGENT_NAME="claude-code-dev"
export MESHGUARD_MODE="enforce"  # or "audit" for log-only
```

| Variable | Required | Description |
|----------|----------|-------------|
| `MESHGUARD_API_KEY` | Yes | Agent API key from the MeshGuard dashboard |
| `MESHGUARD_GATEWAY_URL` | Yes | Gateway URL (cloud or self-hosted) |
| `MESHGUARD_AGENT_NAME` | No | Override agent name (defaults to hostname) |
| `MESHGUARD_MODE` | No | `enforce` (default) or `audit` (log-only, never block) |
| `MESHGUARD_TIMEOUT` | No | Request timeout in seconds (default: `10`) |
| `MESHGUARD_TRACE_HEADER` | No | Custom trace ID header name |

## Integration Approaches

MeshGuard integrates with Claude Code through three complementary approaches. Use one or combine them for defense in depth.

### 1. Hooks-Based Integration (Primary)

Claude Code supports pre-tool and post-tool hooks in `.claude/settings.json`. This is the **recommended primary approach** — it intercepts every tool call before execution.

#### How It Works

```
Claude Code invokes tool → Pre-hook runs → MeshGuard checks policy
                                            ├─ Allow → Tool executes → Post-hook logs
                                            └─ Deny  → Tool blocked, error returned
```

#### Hook Script

Create a Python script that Claude Code's hook system calls before each tool invocation:

```python
#!/usr/bin/env python3
"""meshguard_hook.py — Pre-tool hook for Claude Code governance."""

import json
import sys
import os
from meshguard import MeshGuardClient, PolicyDeniedError

client = MeshGuardClient(
    gateway_url=os.getenv("MESHGUARD_GATEWAY_URL", "https://dashboard.meshguard.app"),
    agent_token=os.getenv("MESHGUARD_API_KEY"),
)

def get_action_and_resource(tool_name: str, tool_input: dict) -> tuple[str, str]:
    """Map Claude Code tool invocations to MeshGuard actions."""
    if tool_name == "Read":
        return "read:file", tool_input.get("path", tool_input.get("file_path", ""))
    elif tool_name == "Write":
        return "write:file", tool_input.get("path", tool_input.get("file_path", ""))
    elif tool_name == "Edit":
        return "write:file", tool_input.get("path", tool_input.get("file_path", ""))
    elif tool_name == "exec":
        cmd = tool_input.get("command", "")
        return "execute:shell", cmd
    elif tool_name == "web_search":
        return "read:web_search", tool_input.get("query", "")
    elif tool_name == "web_fetch":
        return "read:web_fetch", tool_input.get("url", "")
    elif tool_name == "browser":
        return "read:web_browse", tool_input.get("action", "")
    else:
        return f"invoke:{tool_name}", json.dumps(tool_input)[:200]

def main():
    """Read hook input from stdin and enforce policy."""
    hook_input = json.loads(sys.stdin.read())

    tool_name = hook_input.get("tool_name", "")
    tool_input = hook_input.get("tool_input", {})

    action, resource = get_action_and_resource(tool_name, tool_input)

    try:
        client.enforce(action, resource=resource, context={
            "tool": tool_name,
            "agent": "claude-code",
            "working_directory": os.getcwd(),
        })
        # Allowed — exit 0, no output needed
        sys.exit(0)
    except PolicyDeniedError as e:
        # Denied — output error message and exit non-zero
        result = {
            "error": f"MeshGuard policy denied: {e.reason}",
            "policy": e.policy,
            "trace_id": e.trace_id,
        }
        print(json.dumps(result))
        sys.exit(1)

if __name__ == "__main__":
    main()
```

#### Configure `.claude/settings.json`

Add the pre-tool hook to your project's Claude Code settings:

```json
{
  "hooks": {
    "pre-tool": [
      {
        "command": "python3 /path/to/meshguard_hook.py",
        "timeout": 10000
      }
    ],
    "post-tool": [
      {
        "command": "python3 /path/to/post_hook.py",
        "timeout": 5000
      }
    ]
  },
  "permissions": {
    "allow": [
      "Read",
      "Write",
      "Edit",
      "exec",
      "web_search",
      "web_fetch"
    ]
  }
}
```

The `permissions.allow` list enables the tools at the Claude Code level, while MeshGuard's hooks enforce fine-grained policy on top.

### 2. MCP Server Integration

Run MeshGuard as an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that wraps tools with governance. This approach is useful when you want MeshGuard to provide governed tool implementations directly.

#### MCP Server Configuration

Add MeshGuard as an MCP server in `.claude/settings.json`:

```json
{
  "mcpServers": {
    "meshguard": {
      "command": "meshguard",
      "args": ["mcp-server", "--policy", "./policies/dev-assistant.yaml"],
      "env": {
        "MESHGUARD_API_KEY": "mg_live_abc123...",
        "MESHGUARD_GATEWAY_URL": "https://dashboard.meshguard.app"
      }
    }
  }
}
```

The MeshGuard MCP server exposes governed versions of common tools:

```python
# MeshGuard MCP server provides these tools:
# - governed_read_file(path) — File read with policy check
# - governed_write_file(path, content) — File write with policy check
# - governed_exec(command) — Shell execution with policy check
# - governed_web_fetch(url) — URL fetch with policy check
# - audit_query(filters) — Query the audit log
# - policy_test(action, resource) — Test if an action would be allowed
```

### 3. CLAUDE.md Policy Injection

Inject governance rules directly into `CLAUDE.md` project instructions. This is a **soft governance** approach — the agent is instructed to follow rules, but enforcement is advisory rather than technical.

Use this alongside hooks-based integration for defense in depth:

```markdown
<!-- CLAUDE.md -->

## Governance Rules (MeshGuard)

This project is governed by MeshGuard policies. Before performing any action:

1. **File access**: Only read/write files within the project workspace. Never access:
   - `/etc/*`, `/var/*`, or system directories
   - `~/.ssh/*`, `~/.aws/*`, or credential files
   - Files outside the current working directory

2. **Shell commands**: Only run development-related commands:
   - Allowed: `git`, `npm`, `python`, `pip`, `pytest`, `make`, `cargo`
   - Denied: `rm -rf`, `sudo`, `curl` to external URLs, `chmod 777`
   - Never run commands that modify system configuration

3. **Web access**: Only fetch documentation and package registries:
   - Allowed: docs.*, github.com, stackoverflow.com, npmjs.com, pypi.org
   - Denied: social media, file sharing, unknown domains

4. **When denied**: If a MeshGuard hook blocks an action, do not retry. Explain to the user what was blocked and why.
```

::: tip Defense in Depth
Combine all three approaches: Hooks enforce policy technically, CLAUDE.md provides instructions the agent follows proactively, and MCP gives you governed tool alternatives. This layered approach is the most secure.
:::

## Policy YAML Examples

### File Access Governance

```yaml
name: claude-code-file-policy
version: "1.0"
description: File access governance for Claude Code agents

appliesTo:
  tags:
    - claude-code
    - dev-agent

rules:
  # Allow reading any file in the workspace
  - effect: allow
    actions:
      - "read:file"
    conditions:
      resource:
        matches: "./\*\*"

  # Allow writing to source and test files
  - effect: allow
    actions:
      - "write:file"
    conditions:
      resource:
        matches:
          - "./src/**"
          - "./tests/**"
          - "./docs/**"
          - "./*.md"
          - "./*.json"
          - "./*.yaml"

  # Deny access to credential and key files
  - effect: deny
    actions:
      - "read:file"
      - "write:file"
    conditions:
      resource:
        matches:
          - "**/.env"
          - "**/.env.*"
          - "**/*.pem"
          - "**/*.key"
          - "**/id_rsa*"
          - "**/.ssh/*"
          - "**/.aws/*"
    reason: "Access to credential files is prohibited"

  # Deny system file access
  - effect: deny
    actions:
      - "read:file"
      - "write:file"
    conditions:
      resource:
        matches:
          - "/etc/**"
          - "/var/**"
          - "/usr/**"
          - "/System/**"
    reason: "System file access is prohibited"

defaultEffect: deny
```

### Shell Command Governance

```yaml
name: claude-code-shell-policy
version: "1.0"
description: Shell command governance for Claude Code agents

appliesTo:
  tags:
    - claude-code

rules:
  # Allow common dev commands
  - effect: allow
    actions:
      - "execute:shell"
    conditions:
      resource:
        startsWith:
          - "git "
          - "npm "
          - "npx "
          - "pnpm "
          - "yarn "
          - "python "
          - "python3 "
          - "pip "
          - "pip3 "
          - "pytest "
          - "cargo "
          - "make "
          - "ls "
          - "cat "
          - "head "
          - "tail "
          - "grep "
          - "find "
          - "wc "
          - "echo "
          - "mkdir "
          - "cp "

  # Allow running tests and builds
  - effect: allow
    actions:
      - "execute:shell"
    conditions:
      resource:
        startsWith:
          - "npm test"
          - "npm run "
          - "pytest "
          - "cargo test"
          - "make test"
          - "make build"

  # Deny destructive commands
  - effect: deny
    actions:
      - "execute:shell"
    conditions:
      resource:
        contains:
          - "rm -rf"
          - "rm -r /"
          - "sudo "
          - "chmod 777"
          - "> /dev/"
          - "mkfs"
          - "dd if="
          - ":(){:|:&};:"
    reason: "Destructive or privileged commands are prohibited"

  # Deny network exfiltration
  - effect: deny
    actions:
      - "execute:shell"
    conditions:
      resource:
        contains:
          - "curl "
          - "wget "
          - "nc "
          - "netcat "
          - "ssh "
          - "scp "
          - "rsync "
    reason: "Network commands require explicit approval"

  # Deny package publishing
  - effect: deny
    actions:
      - "execute:shell"
    conditions:
      resource:
        contains:
          - "npm publish"
          - "pip upload"
          - "twine upload"
          - "cargo publish"
    reason: "Package publishing requires human approval"

defaultEffect: deny
```

### Web Browsing Governance

```yaml
name: claude-code-web-policy
version: "1.0"
description: Web access governance for Claude Code agents

appliesTo:
  tags:
    - claude-code

rules:
  # Allow documentation sites
  - effect: allow
    actions:
      - "read:web_search"
      - "read:web_fetch"
      - "read:web_browse"
    conditions:
      resource:
        matches:
          - "*docs.*"
          - "*github.com*"
          - "*stackoverflow.com*"
          - "*npmjs.com*"
          - "*pypi.org*"
          - "*crates.io*"
          - "*developer.mozilla.org*"
          - "*man7.org*"

  # Allow web search (search engine queries)
  - effect: allow
    actions:
      - "read:web_search"

  # Deny social media
  - effect: deny
    actions:
      - "read:web_fetch"
      - "read:web_browse"
    conditions:
      resource:
        matches:
          - "*twitter.com*"
          - "*x.com*"
          - "*facebook.com*"
          - "*instagram.com*"
          - "*tiktok.com*"
          - "*reddit.com*"
    reason: "Social media access is not allowed"

  # Deny file sharing and paste sites
  - effect: deny
    actions:
      - "read:web_fetch"
      - "read:web_browse"
    conditions:
      resource:
        matches:
          - "*pastebin.com*"
          - "*hastebin.com*"
          - "*transfer.sh*"
          - "*file.io*"
    reason: "File sharing sites are not allowed"

defaultEffect: deny
```

## Audit Logging

### Automatic Audit via Hooks

With the hooks-based integration, every tool invocation is automatically audited. The post-tool hook logs the result:

```python
#!/usr/bin/env python3
"""post_hook.py — Post-tool hook for audit logging."""

import json
import sys
import os
from meshguard import MeshGuardClient

client = MeshGuardClient()

def main():
    hook_input = json.loads(sys.stdin.read())

    tool_name = hook_input.get("tool_name", "")
    tool_input = hook_input.get("tool_input", {})
    tool_output = hook_input.get("tool_output", "")
    exit_code = hook_input.get("exit_code", 0)

    action_map = {
        "Read": "read:file",
        "Write": "write:file",
        "Edit": "write:file",
        "exec": "execute:shell",
        "web_search": "read:web_search",
        "web_fetch": "read:web_fetch",
    }

    action = action_map.get(tool_name, f"invoke:{tool_name}")

    client.audit_log(
        action=action,
        decision="allow",
        metadata={
            "tool": tool_name,
            "exit_code": exit_code,
            "output_length": len(str(tool_output)),
            "working_directory": os.getcwd(),
        },
    )

if __name__ == "__main__":
    main()
```

### Querying Audit Logs

```python
# Get recent Claude Code actions
audit = client.get_audit_log(
    limit=50,
    agent="claude-code-dev",
    actions=["read:file", "write:file", "execute:shell"],
)

for entry in audit:
    print(f"{entry['timestamp']}: {entry['action']} → {entry['decision']}")
    print(f"  Resource: {entry.get('resource', 'N/A')}")
    print(f"  Trace: {entry['trace_id']}")
```

### CLI Audit Queries

```bash
# Tail Claude Code audit in real-time
meshguard audit tail -f --agent claude-code-dev

# Filter by action type
meshguard audit query --agent claude-code-dev --action "execute:shell" --limit 20

# Show only denials
meshguard audit query --agent claude-code-dev --decision deny

# Export for compliance
meshguard audit export --agent claude-code-dev --from 2026-01-01 --format csv > audit.csv
```

## Handling Denied Actions

When MeshGuard denies an action, the hook script returns a non-zero exit code. Claude Code receives the error and should explain the denial to the user.

### Denial Flow

```
1. Claude Code attempts: exec("rm -rf /tmp/old-build")
2. Pre-hook calls MeshGuard: enforce("execute:shell", resource="rm -rf /tmp/old-build")
3. MeshGuard evaluates policy → DENY (rule: deny-destructive-commands)
4. Hook returns exit 1 with error JSON
5. Claude Code receives error, explains to user:
   "I'm unable to run that command — it was blocked by governance policy.
    The 'rm -rf' pattern is prohibited. Would you like me to use a safer
    alternative, or would you prefer to run this command manually?"
```

### Customizing Denial Messages

In your policy YAML, add clear `reason` fields:

```yaml
rules:
  - effect: deny
    actions:
      - "execute:shell"
    conditions:
      resource:
        contains: "rm -rf"
    reason: >
      Recursive force-delete commands are prohibited by security policy.
      Use 'trash' for recoverable deletion, or run this command manually
      outside of Claude Code.
```

## Full Example: A Governed Developer Assistant

This example sets up Claude Code as a governed dev assistant with file, shell, and web policies.

### 1. Install Dependencies

```bash
pip install meshguard
```

### 2. Create the Hook Scripts

Save `meshguard_hook.py` and `post_hook.py` (shown above) to your project's `.claude/hooks/` directory.

### 3. Configure `.claude/settings.json`

```json
{
  "hooks": {
    "pre-tool": [
      {
        "command": "python3 .claude/hooks/meshguard_hook.py",
        "timeout": 10000
      }
    ],
    "post-tool": [
      {
        "command": "python3 .claude/hooks/post_hook.py",
        "timeout": 5000
      }
    ]
  },
  "permissions": {
    "allow": [
      "Read",
      "Write",
      "Edit",
      "exec",
      "web_search",
      "web_fetch"
    ]
  }
}
```

### 4. Create a Combined Policy

```yaml
name: claude-code-dev-assistant
version: "1.0"
description: Full governance policy for a Claude Code developer assistant

appliesTo:
  tags:
    - claude-code
    - dev-assistant

rules:
  # --- File Access ---
  # Read anything in workspace
  - effect: allow
    actions: ["read:file"]
    conditions:
      resource:
        matches: "./**"

  # Write to source, tests, docs
  - effect: allow
    actions: ["write:file"]
    conditions:
      resource:
        matches: ["./src/**", "./tests/**", "./docs/**", "./*.md", "./*.json"]

  # Block credentials and secrets
  - effect: deny
    actions: ["read:file", "write:file"]
    conditions:
      resource:
        matches: ["**/.env*", "**/*.pem", "**/*.key", "**/.ssh/**", "**/.aws/**"]
    reason: "Credential file access is blocked by security policy"

  # Block system paths
  - effect: deny
    actions: ["read:file", "write:file"]
    conditions:
      resource:
        matches: ["/etc/**", "/var/**", "/usr/**"]
    reason: "System file access is prohibited"

  # --- Shell Commands ---
  # Allow dev tooling
  - effect: allow
    actions: ["execute:shell"]
    conditions:
      resource:
        startsWith: ["git ", "npm ", "npx ", "python", "pip", "pytest ", "make ", "cargo ", "ls ", "cat ", "grep ", "find "]

  # Block destructive and privileged commands
  - effect: deny
    actions: ["execute:shell"]
    conditions:
      resource:
        contains: ["rm -rf", "sudo ", "chmod 777", "npm publish", "> /dev/"]
    reason: "Destructive or privileged command blocked by policy"

  # Block network exfiltration
  - effect: deny
    actions: ["execute:shell"]
    conditions:
      resource:
        contains: ["curl ", "wget ", "nc ", "ssh ", "scp "]
    reason: "Network commands require explicit approval"

  # --- Web Access ---
  # Allow search and documentation
  - effect: allow
    actions: ["read:web_search"]

  - effect: allow
    actions: ["read:web_fetch", "read:web_browse"]
    conditions:
      resource:
        matches: ["*docs.*", "*github.com*", "*stackoverflow.com*", "*npmjs.com*", "*pypi.org*"]

  # Block social media
  - effect: deny
    actions: ["read:web_fetch", "read:web_browse"]
    conditions:
      resource:
        matches: ["*twitter.com*", "*facebook.com*", "*reddit.com*"]
    reason: "Social media access is not allowed during work sessions"

defaultEffect: deny

# Audit configuration
audit:
  enabled: true
  log_level: info
  include: [tool_name, action, resource, decision, timestamp, trace_id]
  retention_days: 90
```

### 5. Apply and Test

```bash
# Apply the policy
meshguard policy apply ./policies/dev-assistant.yaml

# Test in audit mode first
export MESHGUARD_MODE=audit

# Run Claude Code — all actions are logged but not blocked
claude

# Review the audit log
meshguard audit query --agent claude-code-dev --limit 20

# Switch to enforce mode when satisfied
export MESHGUARD_MODE=enforce
```

### 6. Run Claude Code

```bash
# Start Claude Code with governance active
claude

# Claude Code will now have all tool calls checked by MeshGuard
# Allowed actions proceed normally
# Denied actions return policy error messages
```

## Troubleshooting

### Hook script not running

Verify the hook path is correct and the script is executable:

```bash
# Check the script exists
ls -la .claude/hooks/meshguard_hook.py

# Test it manually
echo '{"tool_name": "Read", "tool_input": {"path": "README.md"}}' | python3 .claude/hooks/meshguard_hook.py
echo $?  # Should be 0 for allowed
```

### Hook timeout errors

If hooks are too slow, increase the timeout in `.claude/settings.json`:

```json
{
  "hooks": {
    "pre-tool": [
      {
        "command": "python3 .claude/hooks/meshguard_hook.py",
        "timeout": 15000
      }
    ]
  }
}
```

Also check network latency to the MeshGuard gateway:

```bash
curl -w "%{time_total}s\n" -o /dev/null -s https://dashboard.meshguard.app/health
```

### Unexpected denials

Debug with the policy test command:

```bash
# Test a specific action
meshguard policy test claude-code-dev "read:file" --resource "./src/main.py"

# Test shell command
meshguard policy test claude-code-dev "execute:shell" --resource "git status"

# Verbose mode for rule evaluation trace
meshguard policy test claude-code-dev "write:file" --resource "./.env" --verbose
```

### MeshGuard not blocking in enforce mode

Verify mode is set correctly:

```bash
echo $MESHGUARD_MODE  # Should be "enforce"

# Check the hook is actually being called
# Add debug logging to meshguard_hook.py:
import logging
logging.basicConfig(filename="/tmp/meshguard-hook.log", level=logging.DEBUG)
```

### Authentication errors

```
meshguard.errors.AuthenticationError: Invalid or expired token
```

- Regenerate API key from the [MeshGuard dashboard](https://dashboard.meshguard.app)
- Verify `MESHGUARD_API_KEY` is set (no trailing whitespace)
- Check the agent hasn't been revoked: `meshguard agent list`

### Audit mode (no enforcement)

To test policies without blocking actions:

```bash
export MESHGUARD_MODE=audit
```

In audit mode, all actions are allowed but denials are still logged. Review logs to tune policies before switching to `enforce`.

## Related

- **Learning Guide:** [Governing Claude Code Agents](/guides/governing-claude-code-agents) — Step-by-step tutorial
- **Example Project:** [Claude Code Dev Assistant](https://github.com/meshguard/meshguard-examples/tree/main/claude-code-dev-assistant) — Full working example
- [Python SDK](/integrations/python) — Full Python SDK reference
- [Policies](/guide/policies) — Policy format and syntax
- [Audit Logging](/guide/audit) — Audit log configuration and queries
- [Self-Hosted Deployment](/guide/self-hosted) — Run MeshGuard on your own infrastructure
