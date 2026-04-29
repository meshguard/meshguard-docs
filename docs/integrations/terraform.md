---
title: "Terraform Provider"
description: "Manage MeshGuard resources with Terraform infrastructure as code"
---

# Terraform Provider

Manage MeshGuard AI gateway resources with Terraform. Define agents, policies, and alert channels as infrastructure as code.

[![Terraform Registry](https://img.shields.io/badge/terraform-registry-blueviolet.svg)](https://registry.terraform.io/providers/meshguard/meshguard)

## Requirements

- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.0

## Provider Configuration

```hcl
terraform {
  required_providers {
    meshguard = {
      source = "registry.terraform.io/meshguard/meshguard"
    }
  }
}

provider "meshguard" {
  gateway_url = "https://gw.meshguard.app"   # or MESHGUARD_GATEWAY_URL
  admin_token = var.meshguard_admin_token     # or MESHGUARD_ADMIN_TOKEN
}

variable "meshguard_admin_token" {
  description = "MeshGuard admin API token"
  type        = string
  sensitive   = true
}
```

### Configuration Reference

| Argument | Environment Variable | Description |
|----------|---------------------|-------------|
| `gateway_url` | `MESHGUARD_GATEWAY_URL` | MeshGuard gateway URL |
| `admin_token` | `MESHGUARD_ADMIN_TOKEN` | Admin API token |

Both arguments can be omitted if the corresponding environment variable is set.

## Resources

### meshguard_agent

Manages an AI agent registered with the MeshGuard gateway.

```hcl
resource "meshguard_agent" "code_reviewer" {
  name       = "code-reviewer"
  trust_tier = "verified"
  tags       = ["ci", "code-review"]
  metadata = {
    team        = "platform"
    environment = "production"
  }
}
```

#### Argument Reference

| Argument | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Display name for the agent |
| `trust_tier` | No | Trust level: `unverified`, `verified`, `trusted`, or `privileged` (default: `verified`) |
| `tags` | No | List of labels for the agent |
| `metadata` | No | Map of key-value metadata |

#### Attribute Reference

| Attribute | Description |
|-----------|-------------|
| `id` | Unique agent ID assigned by the gateway |
| `api_key` | Agent API key (sensitive) |

#### Import

```bash
terraform import meshguard_agent.code_reviewer <agent-id>
```

### meshguard_policy

Manages a YAML policy document.

```hcl
resource "meshguard_policy" "code_review_policy" {
  name = "code-review-policy"
  content = yamlencode({
    name          = "code-review-policy"
    version       = "1.0"
    description   = "Policy for code review agents"
    appliesTo     = ["code-reviewer"]
    defaultEffect = "deny"
    rules = [
      {
        name   = "allow-read-repos"
        effect = "allow"
        conditions = {
          action = ["read"]
          path   = ["/api/repos/*"]
        }
      },
      {
        name   = "allow-post-comments"
        effect = "allow"
        conditions = {
          action = ["write"]
          path   = ["/api/repos/*/comments"]
        }
      },
    ]
  })
}
```

You can also load policy content from a file:

```hcl
resource "meshguard_policy" "from_file" {
  name    = "production-guardrails"
  content = file("policies/production-guardrails.yaml")
}
```

#### Argument Reference

| Argument | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Policy name |
| `content` | Yes | YAML policy document (as a string) |

#### Attribute Reference

| Attribute | Description |
|-----------|-------------|
| `id` | Unique policy ID assigned by the gateway |

#### Import

```bash
terraform import meshguard_policy.code_review_policy <policy-id>
```

### meshguard_alert_channel

Manages an alert notification channel.

#### Slack Channel

```hcl
resource "meshguard_alert_channel" "slack_alerts" {
  type          = "slack"
  endpoint      = "https://hooks.slack.com/services/T00/B00/xxx"
  slack_channel = "#meshguard-alerts"
  severity      = "warning"
  triggers      = ["deny", "error"]
}
```

#### PagerDuty Channel

```hcl
resource "meshguard_alert_channel" "pagerduty_critical" {
  type                  = "pagerduty"
  endpoint              = "https://events.pagerduty.com/v2/enqueue"
  pagerduty_routing_key = var.pagerduty_key
  severity              = "critical"
  triggers              = ["deny"]
}

variable "pagerduty_key" {
  description = "PagerDuty routing key"
  type        = string
  sensitive   = true
}
```

#### Argument Reference

| Argument | Required | Description |
|----------|----------|-------------|
| `type` | Yes | Channel type: `slack`, `pagerduty`, `webhook` |
| `endpoint` | Yes | Notification endpoint URL |
| `severity` | No | Minimum severity: `info`, `warning`, `critical` |
| `triggers` | No | Events that trigger alerts: `deny`, `error`, `rate_limit` |
| `slack_channel` | No | Slack channel name (required when `type = "slack"`) |
| `pagerduty_routing_key` | No | PagerDuty routing key (required when `type = "pagerduty"`) |

#### Import

```bash
terraform import meshguard_alert_channel.slack_alerts <channel-id>
```

## Data Sources

### meshguard_agents

Read all agents from the gateway, with an optional trust tier filter.

```hcl
# All agents
data "meshguard_agents" "all" {}

# Filtered by trust tier
data "meshguard_agents" "trusted_only" {
  trust_tier = "trusted"
}
```

#### Argument Reference

| Argument | Required | Description |
|----------|----------|-------------|
| `trust_tier` | No | Filter agents by trust tier |

#### Attribute Reference

| Attribute | Description |
|-----------|-------------|
| `agents` | List of agent objects |
| `count` | Total number of matching agents |

### meshguard_policies

Read all policies from the gateway.

```hcl
data "meshguard_policies" "all" {}
```

#### Attribute Reference

| Attribute | Description |
|-----------|-------------|
| `policies` | List of policy objects |

## Complete Example

```hcl
terraform {
  required_providers {
    meshguard = {
      source = "registry.terraform.io/meshguard/meshguard"
    }
  }
}

provider "meshguard" {
  gateway_url = "https://gw.meshguard.app"
  admin_token = var.meshguard_admin_token
}

variable "meshguard_admin_token" {
  description = "MeshGuard admin API token"
  type        = string
  sensitive   = true
}

# --- Agents ---

resource "meshguard_agent" "code_reviewer" {
  name       = "code-reviewer"
  trust_tier = "verified"
  tags       = ["ci", "code-review"]
  metadata = {
    team        = "platform"
    environment = "production"
  }
}

resource "meshguard_agent" "summarizer" {
  name       = "doc-summarizer"
  trust_tier = "trusted"
  tags       = ["docs"]
}

# --- Policies ---

resource "meshguard_policy" "code_review_policy" {
  name = "code-review-policy"
  content = yamlencode({
    name          = "code-review-policy"
    version       = "1.0"
    description   = "Policy for code review agents"
    appliesTo     = ["code-reviewer"]
    defaultEffect = "deny"
    rules = [
      {
        name   = "allow-read-repos"
        effect = "allow"
        conditions = {
          action = ["read"]
          path   = ["/api/repos/*"]
        }
      },
      {
        name   = "allow-post-comments"
        effect = "allow"
        conditions = {
          action = ["write"]
          path   = ["/api/repos/*/comments"]
        }
      },
    ]
  })
}

# --- Alert Channels ---

resource "meshguard_alert_channel" "slack_alerts" {
  type          = "slack"
  endpoint      = "https://hooks.slack.com/services/T00/B00/xxx"
  slack_channel = "#meshguard-alerts"
  severity      = "warning"
  triggers      = ["deny", "error"]
}

# --- Data Sources ---

data "meshguard_agents" "all" {}

data "meshguard_policies" "all" {}

# --- Outputs ---

output "code_reviewer_id" {
  description = "ID of the code-reviewer agent"
  value       = meshguard_agent.code_reviewer.id
}

output "code_reviewer_api_key" {
  description = "API key for the code-reviewer agent"
  value       = meshguard_agent.code_reviewer.api_key
  sensitive   = true
}

output "total_agents" {
  description = "Total number of agents"
  value       = data.meshguard_agents.all.count
}

output "policy_count" {
  description = "Total number of policies"
  value       = length(data.meshguard_policies.all.policies)
}
```

## Related

- [GitHub Action](/integrations/github-action) -- CI/CD policy validation
- [Python SDK](/integrations/python) -- Python SDK reference
- [API Reference](/api/overview) -- Gateway and Admin API documentation
- [Policies](/guide/policies) -- Policy format and syntax
- [Alerting](/guide/alerting) -- Alert channel configuration
