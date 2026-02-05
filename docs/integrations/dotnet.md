---
title: ".NET SDK"
description: "MeshGuard .NET SDK with Semantic Kernel integration"
---

# .NET SDK

The official MeshGuard .NET SDK for AI agent governance, with first-class support for **Microsoft Semantic Kernel**.

[![NuGet](https://img.shields.io/nuget/v/MeshGuard.svg)](https://www.nuget.org/packages/MeshGuard)

## Installation

```bash
dotnet add package MeshGuard
dotnet add package MeshGuard.SemanticKernel  # Optional: Semantic Kernel integration
```

## Quick Start

```csharp
using MeshGuard;

var client = new MeshGuardClient(new MeshGuardOptions
{
    GatewayUrl = "https://dashboard.meshguard.app",
    ApiKey = Environment.GetEnvironmentVariable("MESHGUARD_API_KEY")!
});

// Check if an action is allowed
var result = await client.CheckPermissionAsync(new PermissionRequest
{
    AgentId = "customer-support-bot",
    Action = "send:email",
    Resource = "customer-emails",
    Context = new { department = "support" }
});

if (result.Allowed)
{
    // Proceed with the action
    await SendEmail(to, subject, body);
    
    // Log the action
    await client.LogAuditAsync(new AuditEntry
    {
        AgentId = "customer-support-bot",
        Action = "send:email",
        Result = "allow",
        Details = new { to, subject }
    });
}
else
{
    Console.WriteLine($"Action denied: {result.Reason}");
}
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `GatewayUrl` | string | `https://dashboard.meshguard.app` | MeshGuard gateway URL |
| `ApiKey` | string | required | Your MeshGuard API key |
| `AgentId` | string | optional | Default agent ID for requests |
| `Timeout` | TimeSpan | 30 seconds | Request timeout |

### Environment Variables

```bash
MESHGUARD_API_KEY=msk_xxx
MESHGUARD_GATEWAY_URL=https://dashboard.meshguard.app
MESHGUARD_AGENT_ID=my-agent
```

## Semantic Kernel Integration

Add governance to any Semantic Kernel agent with a single line:

```csharp
using Microsoft.SemanticKernel;
using MeshGuard.SemanticKernel;

var builder = Kernel.CreateBuilder();
builder.AddOpenAIChatCompletion("gpt-4", apiKey);

// Add MeshGuard governance filter
builder.Services.AddMeshGuardGovernance(options =>
{
    options.GatewayUrl = "https://dashboard.meshguard.app";
    options.ApiKey = Environment.GetEnvironmentVariable("MESHGUARD_API_KEY")!;
    options.AgentId = "copilot-assistant";
    options.DefaultTrustTier = "verified";
});

var kernel = builder.Build();

// Every function call is now governed by MeshGuard policies
var result = await kernel.InvokePromptAsync("Send an email to the CEO about Q4 results");
```

### How It Works

MeshGuard integrates via Semantic Kernel's [function invocation filter](https://learn.microsoft.com/en-us/semantic-kernel/concepts/enterprise-readiness/filters):

```csharp
public class MeshGuardFilter : IFunctionInvocationFilter
{
    private readonly MeshGuardClient _client;
    private readonly string _agentId;

    public async Task OnFunctionInvocationAsync(
        FunctionInvocationContext context, 
        Func<FunctionInvocationContext, Task> next)
    {
        // Check permission before execution
        var result = await _client.CheckPermissionAsync(new PermissionRequest
        {
            AgentId = _agentId,
            Action = $"invoke:{context.Function.PluginName}.{context.Function.Name}",
            Resource = context.Function.PluginName,
            Context = context.Arguments
        });

        if (!result.Allowed)
        {
            throw new MeshGuardDeniedException(result.Reason, result.Policy);
        }

        // Execute the function
        await next(context);

        // Log to audit trail
        await _client.LogAuditAsync(new AuditEntry
        {
            AgentId = _agentId,
            Action = $"invoke:{context.Function.PluginName}.{context.Function.Name}",
            Result = "allow"
        });
    }
}
```

## Core Methods

### CheckPermissionAsync

Check if an action is allowed without throwing an exception:

```csharp
var result = await client.CheckPermissionAsync(new PermissionRequest
{
    AgentId = "my-agent",
    Action = "read:customer-data",
    Resource = "customers/123",
    Context = new { requestedFields = new[] { "name", "email" } }
});

// Result properties
result.Allowed      // bool - whether action is permitted
result.Reason       // string - human-readable reason (on deny)
result.Policy       // string - policy that matched
result.Rule         // string - specific rule that matched
result.TraceId      // string - for audit correlation
```

### EnforcePermissionAsync

Check permission and throw `MeshGuardDeniedException` if denied:

```csharp
try
{
    await client.EnforcePermissionAsync(new PermissionRequest
    {
        AgentId = "my-agent",
        Action = "delete:records",
        Resource = "sensitive-data"
    });
    
    // Action is allowed, proceed
    await DeleteRecords();
}
catch (MeshGuardDeniedException ex)
{
    logger.LogWarning("Action denied: {Reason} (Policy: {Policy})", 
        ex.Reason, ex.Policy);
}
```

### LogAuditAsync

Log custom audit entries:

```csharp
await client.LogAuditAsync(new AuditEntry
{
    AgentId = "my-agent",
    Action = "custom:data-export",
    Result = "allow",
    Details = new
    {
        format = "csv",
        recordCount = 1500,
        destination = "s3://exports/"
    }
});
```

## Policy Examples

### Semantic Kernel Plugin Governance

```yaml
name: semantic-kernel-policy
version: "1.0"
appliesTo:
  agentIds:
    - copilot-assistant

rules:
  # Allow read-only plugins
  - effect: allow
    actions:
      - "invoke:SearchPlugin.*"
      - "invoke:MathPlugin.*"
      - "invoke:TimePlugin.*"

  # Restrict email sending
  - effect: deny
    actions:
      - "invoke:EmailPlugin.SendEmail"
    conditions:
      context:
        to:
          not_matches: "*@yourcompany.com"
    reason: "External emails require approval"

  # Allow internal emails
  - effect: allow
    actions:
      - "invoke:EmailPlugin.*"

defaultEffect: deny
```

## Error Handling

```csharp
try
{
    await client.EnforcePermissionAsync(request);
}
catch (MeshGuardDeniedException ex)
{
    // Action was denied by policy
    logger.LogWarning("Denied: {Reason}", ex.Reason);
}
catch (MeshGuardConnectionException ex)
{
    // Network error connecting to MeshGuard
    // Default behavior: fail closed (deny)
}
catch (MeshGuardAuthException ex)
{
    // Invalid API key
}
```

### Fail-Open Configuration

By default, MeshGuard fails closed (denies actions) if the gateway is unreachable. To fail open:

```csharp
var client = new MeshGuardClient(new MeshGuardOptions
{
    ApiKey = "...",
    FailOpen = true  // Allow actions if gateway unreachable
});
```

::: warning Production Warning
Only enable `FailOpen` if you have alternative monitoring in place. Recommended: use `FailOpen = false` (default).
:::

## ASP.NET Core Integration

Register MeshGuard as a service:

```csharp
// Program.cs
builder.Services.AddMeshGuard(options =>
{
    options.ApiKey = builder.Configuration["MeshGuard:ApiKey"]!;
    options.GatewayUrl = builder.Configuration["MeshGuard:GatewayUrl"];
});

// Use in controllers/services
public class MyService
{
    private readonly MeshGuardClient _meshGuard;
    
    public MyService(MeshGuardClient meshGuard)
    {
        _meshGuard = meshGuard;
    }
}
```

## Related

- [Semantic Kernel Integration](/integrations/semantic-kernel) — Detailed Semantic Kernel guide
- [Python SDK](/integrations/python) — Python SDK reference
- [JavaScript SDK](/integrations/javascript) — JavaScript/TypeScript SDK
- [Policies](/guide/policies) — Policy syntax and examples
