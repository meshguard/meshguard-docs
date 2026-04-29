---
title: "GitHub Action"
description: "Validate MeshGuard policies and run governance dry-run checks in CI"
---

# GitHub Action

Validate MeshGuard policies and run governance dry-run checks in CI pipelines. Catch policy misconfigurations in pull requests before they reach production.

[![GitHub Marketplace](https://img.shields.io/badge/marketplace-meshguard--action-blue.svg)](https://github.com/marketplace/actions/meshguard-policy-check)

## Overview

The `meshguard/meshguard-action` action scans YAML policy files in your repository and either validates their structure locally (**validate** mode) or tests them against a live MeshGuard gateway (**dry-run** mode).

## Quick Start

```yaml
name: Validate Policies
on:
  pull_request:
    paths:
      - "policies/**"

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: MeshGuard policy check
        uses: meshguard/meshguard-action@v1
        with:
          gateway-url: ${{ secrets.MESHGUARD_GATEWAY_URL }}
          api-key: ${{ secrets.MESHGUARD_API_KEY }}
          policy-path: policies/
          check-mode: validate
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `gateway-url` | Yes | -- | MeshGuard gateway URL |
| `api-key` | Yes | -- | MeshGuard API key |
| `policy-path` | No | `policies/` | Path to YAML policy files |
| `check-mode` | No | `validate` | `validate` (syntax only) or `dry-run` (test against gateway) |
| `fail-on-warning` | No | `false` | Fail the action if any warnings are found |
| `agent-id` | No | -- | Agent ID for dry-run checks |
| `actions` | No | -- | Comma-separated actions to test in dry-run mode |

## Outputs

| Output | Description |
|--------|-------------|
| `result` | `pass` or `fail` |
| `details` | JSON string with validation results |

## Check Modes

### Validate Mode (Syntax Check)

Parses each YAML policy file and checks that the structure is valid: `name` is present, `rules` is a non-empty array, each rule has a valid `effect` and `actions`, etc.

```yaml
name: Validate Policies
on:
  pull_request:
    paths:
      - "policies/**"

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: MeshGuard policy check
        uses: meshguard/meshguard-action@v1
        with:
          gateway-url: ${{ secrets.MESHGUARD_GATEWAY_URL }}
          api-key: ${{ secrets.MESHGUARD_API_KEY }}
          policy-path: policies/
          check-mode: validate
```

### Dry-Run Mode (Gateway Validation + Action Tests)

Sends each policy to the gateway's `/admin/policies/validate` endpoint, then tests specific actions against `/admin/policies/test`. This mode verifies that policies are syntactically correct **and** produce the expected allow/deny decisions.

```yaml
name: Dry-Run Policy Tests
on:
  pull_request:
    paths:
      - "policies/**"

jobs:
  dry-run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: MeshGuard dry-run check
        id: policy-check
        uses: meshguard/meshguard-action@v1
        with:
          gateway-url: ${{ secrets.MESHGUARD_GATEWAY_URL }}
          api-key: ${{ secrets.MESHGUARD_API_KEY }}
          policy-path: policies/
          check-mode: dry-run
          agent-id: agent-ci-test
          actions: "read:data,write:config,tool:exec"
          fail-on-warning: "true"

      - name: Show results
        if: always()
        run: |
          echo "Result: ${{ steps.policy-check.outputs.result }}"
          echo '${{ steps.policy-check.outputs.details }}' | jq .
```

## Workflow Examples

### Gate Deployments on Policy Checks

Block a deployment if the policy check fails:

```yaml
name: Deploy with Policy Gate
on:
  push:
    branches: [main]

jobs:
  policy-check:
    runs-on: ubuntu-latest
    outputs:
      result: ${{ steps.check.outputs.result }}
    steps:
      - uses: actions/checkout@v4

      - name: MeshGuard policy check
        id: check
        uses: meshguard/meshguard-action@v1
        with:
          gateway-url: ${{ secrets.MESHGUARD_GATEWAY_URL }}
          api-key: ${{ secrets.MESHGUARD_API_KEY }}
          check-mode: dry-run
          agent-id: deploy-agent
          actions: "deploy:production,write:config"

  deploy:
    needs: policy-check
    if: needs.policy-check.outputs.result == 'pass'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: ./deploy.sh
```

### PR Comment with Results

Post the validation details as a pull request comment:

```yaml
name: Policy Review
on:
  pull_request:
    paths:
      - "policies/**"

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - name: MeshGuard policy check
        id: policy-check
        uses: meshguard/meshguard-action@v1
        with:
          gateway-url: ${{ secrets.MESHGUARD_GATEWAY_URL }}
          api-key: ${{ secrets.MESHGUARD_API_KEY }}
          check-mode: validate
          fail-on-warning: "true"

      - name: Comment on PR
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const result = '${{ steps.policy-check.outputs.result }}';
            const details = JSON.parse('${{ steps.policy-check.outputs.details }}');
            const icon = result === 'pass' ? ':white_check_mark:' : ':x:';

            let body = `## ${icon} MeshGuard Policy Check: ${result}\n\n`;
            body += '```json\n' + JSON.stringify(details, null, 2) + '\n```';

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body,
            });
```

### Scheduled Policy Audit

Run a nightly dry-run to detect drift between committed policies and the live gateway:

```yaml
name: Nightly Policy Audit
on:
  schedule:
    - cron: "0 2 * * *"
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: MeshGuard dry-run audit
        id: audit
        uses: meshguard/meshguard-action@v1
        with:
          gateway-url: ${{ secrets.MESHGUARD_GATEWAY_URL }}
          api-key: ${{ secrets.MESHGUARD_API_KEY }}
          check-mode: dry-run
          agent-id: audit-agent
          actions: "read:data,write:data,delete:data,admin:config"
          fail-on-warning: "true"

      - name: Notify on failure
        if: steps.audit.outputs.result == 'fail'
        run: |
          echo "Policy audit failed. Details:"
          echo '${{ steps.audit.outputs.details }}' | jq .
          # Add Slack/email notification here
```

## Policy File Format

Policy YAML files should follow the MeshGuard policy schema:

```yaml
name: production-guardrails
version: "1.0"
description: Restrict dangerous actions for unverified agents

appliesTo:
  trustTiers:
    - unverified
    - basic

rules:
  - effect: deny
    actions:
      - "tool:exec"
      - "admin:*"
      - "write:delete"
  - effect: allow
    actions:
      - "read:*"

defaultEffect: deny
```

### Required Fields

- `name` -- Policy name (string)
- `rules` -- Non-empty array of rule objects
  - `rules[].effect` -- `allow` or `deny`
  - `rules[].actions` -- Non-empty array of action patterns

### Validated but Optional

- `version` -- Triggers a warning if missing
- `appliesTo` -- Object with `trustTiers`, `agentIds`, `tags`, or `orgIds`
- `defaultEffect` -- `allow` or `deny` (defaults to `deny`)

## Using Outputs in Downstream Steps

The `result` and `details` outputs can drive conditional logic in your workflow:

```yaml
      - name: Gate deployment
        if: steps.policy-check.outputs.result == 'fail'
        run: |
          echo "Policy check failed -- blocking deploy"
          exit 1

      - name: Parse details
        if: always()
        run: |
          echo '${{ steps.policy-check.outputs.details }}' | jq '.warnings'
```

## Related

- [Terraform Provider](/integrations/terraform) -- Infrastructure as code for MeshGuard
- [Policies](/guide/policies) -- Policy format and syntax
- [API Reference](/api/overview) -- Gateway and Admin API documentation
- [Alerting](/guide/alerting) -- Alert channel configuration
