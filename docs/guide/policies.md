# Policies

Policies define what agents can and cannot do.

## Policy Format

```yaml
name: my-policy
version: "1.0"
description: Example policy

appliesTo:
  trustTiers:
    - verified
    - trusted
  tags:
    - production

rules:
  - effect: allow
    actions:
      - "read:*"
  
  - effect: deny
    actions:
      - "write:email"
      - "execute:*"

defaultEffect: deny

delegation:
  maxDepth: 2
  permissionCeiling:
    - "read:*"
```

## Policy Fields

### appliesTo

Determines which agents this policy applies to:

- `trustTiers` — List of trust tiers
- `tags` — List of agent tags
- `agentIds` — Specific agent IDs

### rules

List of rules evaluated in order:

- `effect` — `allow` or `deny`
- `actions` — List of action patterns

### Action Patterns

Supports wildcards:

- `read:contacts` — Exact match
- `read:*` — Match any read action
- `*:email` — Match any action on email

### defaultEffect

What to do if no rules match: `allow` or `deny`

### delegation

Controls agent-to-agent delegation:

- `maxDepth` — Max delegation chain depth
- `permissionCeiling` — Max permissions delegates can have

## Applying Policies

```bash
meshguard policy apply ./my-policy.yaml
```

## Testing Policies

```bash
meshguard policy test agent_abc123 read:contacts
# Output: ALLOW (rule: allow-reads, policy: my-policy)

meshguard policy test agent_abc123 write:email
# Output: DENY (rule: deny-email, policy: my-policy)
```
