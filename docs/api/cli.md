# CLI Reference

MeshGuard CLI for managing agents, policies, and viewing audit logs.

## Installation

```bash
git clone https://github.com/dbhurley/meshguard
cd meshguard
bun install
```

## Agent Commands

```bash
# Create agent
meshguard agent create <name> --trust <tier> --tags <tags>

# List agents
meshguard agent list

# Show agent details
meshguard agent show <agent_id>

# Revoke agent
meshguard agent revoke <agent_id>

# Generate new token
meshguard agent token <agent_id>
```

## Policy Commands

```bash
# List policies
meshguard policy list

# Show policy
meshguard policy show <name>

# Validate policy file
meshguard policy validate ./policy.yaml

# Apply policy
meshguard policy apply ./policy.yaml

# Test policy
meshguard policy test <agent_id> <action>
```

## Audit Commands

```bash
# Tail recent entries
meshguard audit tail -n 20

# Follow mode
meshguard audit tail -f

# Query with filters
meshguard audit query --from 2026-01-01 --decision deny

# Follow a trace
meshguard audit trace <trace_id>

# Statistics
meshguard audit stats --period 24
```

## Gateway Commands

```bash
# Start in enforce mode
meshguard serve --port 3100

# Audit mode (allow but log)
meshguard serve --mode audit

# Bypass mode (development)
meshguard serve --mode bypass
```

## Alert Commands

```bash
# Show alert configuration
meshguard alerts config

# Send test alert
meshguard alerts test

# List available triggers
meshguard alerts triggers
```
