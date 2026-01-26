---
title: "Semantic Kernel Integration"
description: "Add MeshGuard governance to Microsoft Semantic Kernel agents with a drop-in function invocation filter"
---

# Semantic Kernel Integration

Add MeshGuard governance to your [Microsoft Semantic Kernel](https://learn.microsoft.com/en-us/semantic-kernel/overview/) agents with a single line of code. The `MeshGuard.SemanticKernel` package implements Semantic Kernel's `IFunctionInvocationFilter` interface, intercepting every function call for policy checks and audit logging — no changes to your existing plugins required.

## Installation

```bash
dotnet add package MeshGuard
dotnet add package MeshGuard.SemanticKernel
```

Requires .NET 8+ and Semantic Kernel 1.x.

## Quick Start

### 1. Get Your Credentials

Sign up at [meshguard.app](https://meshguard.app) or use your existing credentials. You'll need your **Gateway URL** and an **API key**.

### 2. Add Governance to Your Kernel

```csharp
using Microsoft.SemanticKernel;
using MeshGuard.SemanticKernel;

// Build the kernel with your AI service and plugins
var builder = Kernel.CreateBuilder();

builder.AddAzureOpenAIChatCompletion(
    deploymentName: "gpt-4o",
    endpoint: "https://your-resource.openai.azure.com/",
    apiKey: Environment.GetEnvironmentVariable("AZURE_OPENAI_KEY")!
);

// One-liner: add MeshGuard governance
builder.AddMeshGuardGovernance(options =>
{
    options.GatewayUrl = "https://gateway.meshguard.app";
    options.ApiKey = Environment.GetEnvironmentVariable("MESHGUARD_API_KEY")!;
    options.AgentId = "support-agent-prod";
});

var kernel = builder.Build();

// Import your plugins as usual
kernel.ImportPluginFromType<EmailPlugin>();
kernel.ImportPluginFromType<CalendarPlugin>();

// Every function call is now governed by MeshGuard policy
var result = await kernel.InvokeAsync("EmailPlugin", "SendEmail", new()
{
    ["to"] = "customer@example.com",
    ["subject"] = "Your order update",
    ["body"] = "Your order has shipped!"
});
```

That's it. Every plugin function call now checks permissions against your MeshGuard gateway before executing, and logs an audit entry after.

## How It Works

`MeshGuard.SemanticKernel` registers an `IFunctionInvocationFilter` that intercepts the Semantic Kernel function pipeline:

1. **Before invocation** — the filter sends a permission check to the MeshGuard gateway, including the function name, plugin name, agent identity, and call arguments. The gateway evaluates the request against your configured policies.

2. **After invocation** — regardless of outcome, the filter posts an audit entry recording the function call, the policy decision, execution duration, and (optionally) a summary of the result.

3. **Denied actions** — if the gateway denies the call, the filter throws a `MeshGuardDeniedException` by default. This integrates cleanly with Semantic Kernel's error handling. You can configure it to return a soft denial instead (see `ThrowOnDenied` below).

```
Agent → Kernel.InvokeAsync()
         ├── MeshGuard Filter (pre-invocation)
         │     └── POST /v1/check → gateway evaluates policies
         │           ├── ✅ Allowed → continue to function
         │           └── ❌ Denied  → throw MeshGuardDeniedException
         ├── Plugin Function executes
         └── MeshGuard Filter (post-invocation)
               └── POST /v1/audit → log result
```

## Configuration Options

Pass options to `AddMeshGuardGovernance()` or bind from `IConfiguration`:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `GatewayUrl` | `string` | — | MeshGuard gateway endpoint (required) |
| `ApiKey` | `string` | — | API key for gateway authentication (required) |
| `AgentId` | `string` | — | Unique identifier for this agent instance (required) |
| `DefaultTrustTier` | `string` | `"standard"` | Trust tier sent with permission checks (`"standard"`, `"elevated"`, `"restricted"`) |
| `ThrowOnDenied` | `bool` | `true` | When `false`, denied calls return a `MeshGuardDenialResult` instead of throwing |
| `TimeoutSeconds` | `int` | `5` | HTTP timeout for gateway calls; the function proceeds on timeout if `ThrowOnDenied` is `false` |

### Binding from appsettings.json

```json
{
  "MeshGuard": {
    "GatewayUrl": "https://gateway.meshguard.app",
    "ApiKey": "mg_live_...",
    "AgentId": "support-agent-prod",
    "DefaultTrustTier": "standard",
    "ThrowOnDenied": true,
    "TimeoutSeconds": 5
  }
}
```

```csharp
builder.AddMeshGuardGovernance(
    builder.Configuration.GetSection("MeshGuard")
);
```

## Policy Examples

Define policies in your MeshGuard gateway configuration (YAML). These examples target Semantic Kernel function calls:

### Restrict Email Plugin to Trusted Agents

```yaml
# Only agents with "elevated" trust can send email
- name: email-trusted-only
  match:
    plugin: EmailPlugin
    function: SendEmail
  rules:
    - condition: agent.trust_tier != "elevated"
      action: deny
      reason: "Email sending requires elevated trust tier"
```

### Rate Limit API Calls

```yaml
# Limit any single agent to 100 API plugin calls per minute
- name: api-rate-limit
  match:
    plugin: ApiPlugin
  rules:
    - condition: rate_limit("per_agent", 100, "1m")
      action: deny
      reason: "API call rate limit exceeded (100/min)"
```

### Block File Access to Sensitive Directories

```yaml
# Prevent file operations targeting sensitive paths
- name: block-sensitive-dirs
  match:
    plugin: FilePlugin
  rules:
    - condition: >
        args.path starts_with "/etc" or
        args.path starts_with "/var/secrets" or
        args.path contains ".ssh"
      action: deny
      reason: "File access to sensitive directories is prohibited"
```

## Advanced Usage

### Custom Context Enrichment

Add business context to every governance check by implementing `IMeshGuardContextEnricher`:

```csharp
public class TenantContextEnricher : IMeshGuardContextEnricher
{
    private readonly ITenantService _tenants;

    public TenantContextEnricher(ITenantService tenants)
        => _tenants = tenants;

    public async Task EnrichAsync(MeshGuardContext context)
    {
        var tenant = await _tenants.GetCurrentAsync();
        context.Properties["tenant_id"] = tenant.Id;
        context.Properties["tenant_plan"] = tenant.Plan;
        context.Properties["environment"] = "production";
    }
}

// Register it
builder.Services.AddSingleton<IMeshGuardContextEnricher, TenantContextEnricher>();
```

Enriched properties are available in policy conditions as `context.tenant_id`, `context.tenant_plan`, etc.

### Per-Plugin Governance Policies

Override governance options for specific plugins when you need different trust tiers or timeout behavior:

```csharp
builder.AddMeshGuardGovernance(options =>
{
    options.GatewayUrl = "https://gateway.meshguard.app";
    options.ApiKey = Environment.GetEnvironmentVariable("MESHGUARD_API_KEY")!;
    options.AgentId = "multi-plugin-agent";

    // Elevated trust for the calendar plugin
    options.PluginOverrides["CalendarPlugin"] = new PluginGovernanceOptions
    {
        TrustTier = "elevated",
        TimeoutSeconds = 10,
    };

    // Restricted trust for file operations
    options.PluginOverrides["FilePlugin"] = new PluginGovernanceOptions
    {
        TrustTier = "restricted",
        ThrowOnDenied = true,
    };
});
```

### Integration with Entra ID for Agent Identity

Bind agent identity to Microsoft Entra ID (Azure AD) managed identities for zero-secret deployments:

```csharp
builder.AddMeshGuardGovernance(options =>
{
    options.GatewayUrl = "https://gateway.meshguard.app";
    options.AgentId = "support-agent-prod";

    // Use Entra ID managed identity instead of a static API key
    options.UseEntraIdAuthentication(
        tenantId: "your-tenant-id",
        clientId: "your-app-client-id"
    );
});
```

The SDK acquires tokens via `Azure.Identity.DefaultAzureCredential` and sends them as bearer tokens to the gateway.

### Feeding Audit Logs to Microsoft Purview

Route MeshGuard audit events to Microsoft Purview for unified compliance reporting:

```csharp
builder.AddMeshGuardGovernance(options =>
{
    options.GatewayUrl = "https://gateway.meshguard.app";
    options.ApiKey = Environment.GetEnvironmentVariable("MESHGUARD_API_KEY")!;
    options.AgentId = "compliance-agent";

    // Forward audit logs to Purview
    options.AuditSinks.Add(new PurviewAuditSink(
        purviewAccountName: "your-purview-account",
        collectionName: "ai-agent-governance"
    ));
});
```

Audit events appear in Purview's Data Map with full lineage — linking agent identity, function call, policy decision, and outcome.

## Related

- [MeshGuard .NET SDK on GitHub](https://github.com/meshguard/meshguard-dotnet) — Source code, issues, and contribution guide
- [Governing Microsoft Copilot Agents](/learn/governing-microsoft-copilot) — Patterns for governing Copilot-based agents with MeshGuard
- [MeshGuard vs Microsoft Purview](/learn/meshguard-vs-microsoft-purview) — Comparison of runtime governance vs compliance monitoring

## Next Steps

- [Policy Configuration](/guide/policies) — Define what your agents can do
- [Audit Logging](/guide/audit) — Query and export audit trails
- [Generic HTTP Integration](/integrations/http) — For custom .NET or non-SK workloads
- [API Reference](/api/overview) — Direct gateway API access
