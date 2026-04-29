---
title: "Go SDK"
description: "Official MeshGuard Go SDK for governing AI agents"
---

# Go SDK

The official MeshGuard Go SDK for governing AI agents from Go applications.

[![Go Reference](https://pkg.go.dev/badge/github.com/meshguard/meshguard-go.svg)](https://pkg.go.dev/github.com/meshguard/meshguard-go)

## Installation

```bash
go get github.com/meshguard/meshguard-go
```

Requires **Go 1.21+**. No external dependencies -- only the standard library.

## Quick Start

```go
package main

import (
    "context"
    "fmt"
    "log"

    meshguard "github.com/meshguard/meshguard-go"
)

func main() {
    client := meshguard.NewClient(
        "https://dashboard.meshguard.app",
        "your-agent-token",
    )

    ctx := context.Background()

    // Check if an action is allowed (never errors on deny)
    decision, err := client.Check(ctx, "agent-1", "read:contacts", nil)
    if err != nil {
        log.Fatal(err)
    }
    if decision.Allowed {
        fmt.Println("Access granted")
    } else {
        fmt.Printf("Denied: %s\n", decision.Reason)
    }
}
```

## Client Initialization

### With Explicit Configuration

```go
client := meshguard.NewClient(
    "https://dashboard.meshguard.app",
    "your-agent-token",
    meshguard.WithAdminToken("admin-token"),
    meshguard.WithTimeout(10 * time.Second),
    meshguard.WithTraceID("custom-trace-id"),
    meshguard.WithHTTPClient(customHTTPClient),
    meshguard.WithUserAgent("my-app/1.0"),
)
```

### With Environment Variables

```bash
export MESHGUARD_GATEWAY_URL="https://dashboard.meshguard.app"
export MESHGUARD_AGENT_TOKEN="your-agent-token"
export MESHGUARD_ADMIN_TOKEN="your-admin-token"
```

```go
// Uses env vars as fallbacks when constructor args are empty
client := meshguard.NewClient("", "")
```

### Configuration Options

| Option | Env Variable | Default | Description |
|--------|-------------|---------|-------------|
| `gatewayURL` (arg) | `MESHGUARD_GATEWAY_URL` | `https://dashboard.meshguard.app` | Gateway URL |
| `apiKey` (arg) | `MESHGUARD_AGENT_TOKEN` | -- | Agent JWT token (required) |
| `WithAdminToken()` | `MESHGUARD_ADMIN_TOKEN` | -- | Admin token for management APIs |
| `WithTimeout()` | -- | `30s` | Request timeout |
| `WithTraceID()` | -- | auto-generated | Trace ID for correlation |
| `WithHTTPClient()` | -- | default `http.Client` | Custom HTTP client |
| `WithUserAgent()` | -- | `meshguard-go/0.1.0` | User-Agent header |

## Policy Evaluation

### Check(ctx, agentID, action, meta)

Non-error check -- returns a `*PolicyDecision` without returning an error on denial. Errors are reserved for transport failures and authentication problems.

```go
decision, err := client.Check(ctx, "agent-1", "write:email", map[string]any{
    "recipient": "user@example.com",
})
if err != nil {
    // Transport or auth error
    log.Fatal(err)
}

fmt.Println(decision.Allowed)   // true or false
fmt.Println(decision.Action)    // "write:email"
fmt.Println(decision.Decision)  // "allow" or "deny"
fmt.Println(decision.Policy)    // Policy name that matched
fmt.Println(decision.Reason)    // Reason for denial (if denied)
fmt.Println(decision.TraceID)   // Trace ID for correlation
```

### Enforce(ctx, agentID, action, meta)

Returns an error if the action is denied. The error is a `*PolicyDeniedError` that wraps `ErrPolicyDenied`.

```go
err := client.Enforce(ctx, "agent-1", "delete:records", nil)
if errors.Is(err, meshguard.ErrPolicyDenied) {
    var pde *meshguard.PolicyDeniedError
    errors.As(err, &pde)
    fmt.Printf("Denied by %s: %s\n", pde.Policy, pde.Reason)
    return
}
if err != nil {
    log.Fatal(err)
}

// Action is allowed, proceed
deleteRecords()
```

### Govern(ctx, agentID, action, meta, fn)

Checks the policy and only calls your function if the action is allowed. If the policy denies the action, `fn` is never called and a `*PolicyDeniedError` is returned.

```go
err := client.Govern(ctx, "agent-1", "read:contacts", nil, func() error {
    contacts, err := db.FetchContacts()
    if err != nil {
        return err
    }
    fmt.Printf("Found %d contacts\n", len(contacts))
    return nil
})
if err != nil {
    log.Fatal(err)
}
```

## Proxy Requests

Route HTTP requests through the MeshGuard governance proxy:

```go
// GET request
resp, err := client.Get(ctx, "/api/users")
if err != nil {
    log.Fatal(err)
}
defer resp.Body.Close()

// POST request
resp, err = client.Post(ctx, "/api/users", strings.NewReader(`{"name":"Alice"}`))
if err != nil {
    log.Fatal(err)
}
defer resp.Body.Close()

// PUT request
resp, err = client.Put(ctx, "/api/records/123", strings.NewReader(`{"status":"updated"}`))

// DELETE request
resp, err = client.Delete(ctx, "/api/records/123")

// Generic request
resp, err = client.Request(ctx, http.MethodPatch, "/api/records/123", body)
```

## Admin Operations

Admin methods require an admin token, set via `WithAdminToken` or the `MESHGUARD_ADMIN_TOKEN` environment variable.

```go
client := meshguard.NewClient(
    "https://dashboard.meshguard.app",
    "agent-token",
    meshguard.WithAdminToken("admin-token"),
)
```

### List Agents

```go
agents, err := client.ListAgents(ctx)
if err != nil {
    log.Fatal(err)
}
for _, a := range agents {
    fmt.Printf("%s (%s)\n", a.Name, a.TrustTier)
}
```

### Create Agent

```go
agent, err := client.CreateAgent(ctx, meshguard.CreateAgentRequest{
    Name:      "my-agent",
    TrustTier: "verified",
    Tags:      []string{"production", "sales"},
    Capabilities: []string{"read:contacts", "write:email"},
})
if err != nil {
    log.Fatal(err)
}
fmt.Printf("Agent ID: %s\n", agent.ID)
```

### Revoke Agent

```go
err := client.RevokeAgent(ctx, "agent_abc123")
```

### List Policies

```go
policies, err := client.ListPolicies(ctx)
if err != nil {
    log.Fatal(err)
}
for _, p := range policies {
    fmt.Printf("%s: %d rules\n", p.Name, len(p.Rules))
}
```

### Query Audit Log

```go
// Recent entries
entries, err := client.AuditLog(ctx, meshguard.AuditQueryOptions{
    Limit: 50,
})

// Only denials
denials, err := client.AuditLog(ctx, meshguard.AuditQueryOptions{
    Limit:    100,
    Decision: "deny",
})

// By agent
agentLogs, err := client.AuditLog(ctx, meshguard.AuditQueryOptions{
    AgentID: "agent_abc123",
    Action:  "write:email",
})

for _, entry := range denials {
    fmt.Printf("%s: %s -> %s\n", entry.Timestamp, entry.Action, entry.Decision)
}
```

## Error Handling

The SDK provides sentinel errors for use with `errors.Is` and a structured `*PolicyDeniedError` type:

```go
import (
    "errors"
    meshguard "github.com/meshguard/meshguard-go"
)

err := client.Enforce(ctx, "agent-1", "dangerous:action", nil)

var pde *meshguard.PolicyDeniedError
if errors.As(err, &pde) {
    // Action blocked by policy
    fmt.Printf("Action: %s\n", pde.Action)
    fmt.Printf("Policy: %s\n", pde.Policy)
    fmt.Printf("Rule:   %s\n", pde.Rule)
    fmt.Printf("Reason: %s\n", pde.Reason)
} else if errors.Is(err, meshguard.ErrAuthentication) {
    // Invalid or expired token (HTTP 401)
    fmt.Println("Re-authenticate and retry")
} else if errors.Is(err, meshguard.ErrRateLimit) {
    // Rate limit exceeded (HTTP 429)
    fmt.Println("Too many requests")
} else if err != nil {
    // APIError or other transport error
    var apiErr *meshguard.APIError
    if errors.As(err, &apiErr) {
        fmt.Printf("HTTP %d: %s\n", apiErr.StatusCode, apiErr.Body)
    } else {
        fmt.Printf("Error: %v\n", err)
    }
}
```

### Error Types

| Error | Description |
|-------|-------------|
| `ErrAuthentication` | Invalid or expired token (HTTP 401) |
| `ErrPolicyDenied` | Action denied by policy (HTTP 403) |
| `ErrRateLimit` | Rate limit exceeded (HTTP 429) |
| `*PolicyDeniedError` | Structured denial details (`Action`, `Policy`, `Rule`, `Reason`); unwraps to `ErrPolicyDenied` |
| `*APIError` | Unexpected HTTP error with `StatusCode` and `Body` |

## Health Check

```go
if err := client.Health(ctx); err != nil {
    log.Printf("Gateway unhealthy: %v", err)
} else {
    fmt.Println("Gateway is healthy")
}
```

## Types

### PolicyDecision

```go
type PolicyDecision struct {
    Allowed   bool      `json:"allowed"`
    Action    string    `json:"action"`
    Decision  string    `json:"decision"`   // "allow" or "deny"
    Policy    string    `json:"policy"`
    Rule      string    `json:"rule"`
    Reason    string    `json:"reason"`
    TraceID   string    `json:"traceId"`
    Timestamp time.Time `json:"timestamp"`
}
```

### Agent

```go
type Agent struct {
    ID           string    `json:"id"`
    Name         string    `json:"name"`
    TrustTier    string    `json:"trustTier"`
    Capabilities []string  `json:"capabilities"`
    Tags         []string  `json:"tags"`
    OrgID        string    `json:"orgId"`
    CreatedAt    time.Time `json:"createdAt"`
}
```

### AuditEntry

```go
type AuditEntry struct {
    ID        string         `json:"id"`
    Timestamp time.Time      `json:"timestamp"`
    Action    string         `json:"action"`
    Decision  string         `json:"decision"`
    AgentID   string         `json:"agentId"`
    Policy    string         `json:"policy"`
    Rule      string         `json:"rule"`
    Reason    string         `json:"reason"`
    Resource  string         `json:"resource"`
    Meta      map[string]any `json:"meta"`
}
```

## Related

- [Python SDK](/integrations/python) -- Python SDK reference
- [JavaScript SDK](/integrations/javascript) -- JavaScript/TypeScript SDK
- [Rust SDK](/integrations/rust) -- Rust SDK reference
- [Generic HTTP](/integrations/http) -- Use MeshGuard with any HTTP client
- [API Reference](/api/overview) -- Gateway and Admin API documentation
- [Policies](/guide/policies) -- Policy format and syntax
