---
title: "Rust SDK"
description: "Official MeshGuard Rust SDK for governing AI agents"
---

# Rust SDK

The official MeshGuard Rust SDK for governing AI agents from async Rust applications.

[![crates.io](https://img.shields.io/crates/v/meshguard.svg)](https://crates.io/crates/meshguard)
[![docs.rs](https://docs.rs/meshguard/badge.svg)](https://docs.rs/meshguard)

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
meshguard = "0.1.0"
tokio = { version = "1", features = ["full"] }
```

The SDK uses `reqwest` with `rustls-tls`, `serde`/`serde_json` for serialization, `thiserror` for error types, and `chrono` for timestamps. All dependencies are pulled in transitively.

## Quick Start

```rust
use meshguard::{MeshGuardClient, MeshGuardError};

#[tokio::main]
async fn main() -> meshguard::Result<()> {
    // Create a client from environment variables
    let client = MeshGuardClient::from_env()?;

    // Or with explicit values
    let client = MeshGuardClient::new(
        "https://dashboard.meshguard.app",
        "your-agent-token",
    );

    // Check if an action is allowed
    let decision = client.check("agent-1", "read:contacts", None).await?;
    if decision.allowed {
        println!("Access granted");
    } else {
        println!("Denied: {}", decision.reason);
    }

    Ok(())
}
```

## Client Initialization

### With Explicit Values

```rust
let client = MeshGuardClient::new(
    "https://dashboard.meshguard.app",
    "your-agent-token",
);
```

### From Environment Variables

```bash
export MESHGUARD_GATEWAY_URL="https://dashboard.meshguard.app"
export MESHGUARD_AGENT_TOKEN="your-agent-token"
export MESHGUARD_ADMIN_TOKEN="your-admin-token"
```

```rust
// Reads MESHGUARD_GATEWAY_URL (optional) and MESHGUARD_AGENT_TOKEN (required)
// Also reads MESHGUARD_ADMIN_TOKEN if present
let client = MeshGuardClient::from_env()?;
```

### Configuration

```rust
let mut client = MeshGuardClient::new(
    "https://dashboard.meshguard.app",
    "your-agent-token",
);

// Set admin token for management APIs
client.set_admin_token("your-admin-token");

// Set a custom trace ID for request correlation
client.set_trace_id("custom-trace-id");
```

### Configuration Options

| Method | Env Variable | Default | Description |
|--------|-------------|---------|-------------|
| `new(url, key)` | `MESHGUARD_GATEWAY_URL` | `https://dashboard.meshguard.app` | Gateway URL |
| `new(url, key)` | `MESHGUARD_AGENT_TOKEN` | -- | Agent JWT token (required) |
| `set_admin_token()` | `MESHGUARD_ADMIN_TOKEN` | -- | Admin token for management APIs |
| `set_trace_id()` | -- | auto-generated | Trace ID for correlation |

## Policy Evaluation

### check(agent_id, action, metadata)

Non-error check -- returns a `PolicyDecision` without returning an error on denial. Errors are reserved for transport failures and authentication problems.

```rust
let decision = client.check("agent-1", "write:email", None).await?;

println!("{}", decision.allowed);    // true or false
println!("{}", decision.action);     // "write:email"
println!("{}", decision.decision);   // Decision::Allow or Decision::Deny
println!("{}", decision.policy);     // Policy name that matched
println!("{}", decision.reason);     // Reason for denial (if denied)
println!("{}", decision.trace_id);   // Trace ID for correlation
```

### check with metadata

```rust
use std::collections::HashMap;

let mut meta = HashMap::new();
meta.insert("recipient".to_string(), serde_json::json!("user@example.com"));
meta.insert("subject".to_string(), serde_json::json!("Sales outreach"));

let decision = client.check("agent-1", "write:email", Some(&meta)).await?;
```

### enforce(agent_id, action, metadata)

Returns `Err(MeshGuardError::PolicyDenied { .. })` if the action is denied:

```rust
match client.enforce("agent-1", "delete:records", None).await {
    Ok(()) => {
        // Action allowed -- proceed
        delete_records().await?;
    }
    Err(MeshGuardError::PolicyDenied { action, policy, reason, .. }) => {
        eprintln!("Denied: {action} blocked by {policy}: {reason}");
    }
    Err(e) => {
        eprintln!("Error: {e}");
    }
}
```

### govern(agent_id, action, metadata, closure)

Enforces a policy check and, if allowed, executes the given closure. If the policy denies the action, the closure is never called.

```rust
let result = client.govern("agent-1", "db.query", None, || {
    // This closure only runs if the policy allows the action
    let data = run_query()?;
    Ok(data)
}).await?;
```

## Proxy Requests

Send HTTP requests through the MeshGuard governance proxy:

```rust
use reqwest::Method;

// POST request with JSON body
let response = client.request(
    Method::POST,
    "api/data",
    Some(serde_json::json!({"key": "value"})),
).await?;

// GET request (no body)
let response = client.request(
    Method::GET,
    "api/users",
    None,
).await?;

// DELETE request
let response = client.request(
    Method::DELETE,
    "api/records/123",
    None,
).await?;
```

## Admin Operations

Admin methods require an admin token, set via `set_admin_token()` or the `MESHGUARD_ADMIN_TOKEN` environment variable.

```rust
use meshguard::{MeshGuardClient, CreateAgentRequest, AuditQueryOptions};

let mut client = MeshGuardClient::new(
    "https://dashboard.meshguard.app",
    "agent-token",
);
client.set_admin_token("your-admin-token");
```

### List Agents

```rust
let agents = client.list_agents().await?;
for agent in &agents {
    println!("{} ({})", agent.name, agent.trust_tier);
}
```

### Create Agent

```rust
let agent = client.create_agent(CreateAgentRequest {
    name: "my-agent".into(),
    trust_tier: Some("verified".into()),
    tags: vec!["production".into(), "sales".into()],
    capabilities: vec!["read:contacts".into(), "write:email".into()],
}).await?;

println!("Agent ID: {}", agent.id);
```

### Revoke Agent

```rust
client.revoke_agent("agent_abc123").await?;
```

### List Policies

```rust
let policies = client.list_policies().await?;
for policy in &policies {
    println!("{}: {} rules", policy.name, policy.rules.len());
}
```

### Query Audit Log

```rust
// Recent entries
let entries = client.audit_log(AuditQueryOptions {
    limit: Some(50),
    ..Default::default()
}).await?;

// Only denials
let denials = client.audit_log(AuditQueryOptions {
    limit: Some(100),
    decision: Some("deny".into()),
    ..Default::default()
}).await?;

// By agent
let agent_logs = client.audit_log(AuditQueryOptions {
    agent_id: Some("agent_abc123".into()),
    action: Some("write:email".into()),
    ..Default::default()
}).await?;

for entry in &denials {
    println!("{}: {} -> {}", entry.timestamp, entry.action, entry.decision);
}
```

## Error Handling

All methods return `Result<T, MeshGuardError>`. The error type is an enum with variants for each failure mode:

```rust
use meshguard::MeshGuardError;

match client.enforce("agent-1", "dangerous:action", None).await {
    Ok(()) => println!("Allowed"),
    Err(MeshGuardError::PolicyDenied { action, policy, reason, .. }) => {
        // Action blocked by policy
        eprintln!("Action: {action}");
        eprintln!("Policy: {policy}");
        eprintln!("Reason: {reason}");
    }
    Err(MeshGuardError::Authentication) => {
        // Invalid or expired token (HTTP 401)
        eprintln!("Bad credentials");
    }
    Err(MeshGuardError::RateLimit) => {
        // Rate limit exceeded (HTTP 429)
        eprintln!("Too many requests");
    }
    Err(MeshGuardError::Api { status, message }) => {
        // Unexpected HTTP error
        eprintln!("HTTP {status}: {message}");
    }
    Err(MeshGuardError::Network(e)) => {
        // Transport/connection error
        eprintln!("Network error: {e}");
    }
    Err(MeshGuardError::Unhealthy(msg)) => {
        // Gateway health check failed
        eprintln!("Unhealthy: {msg}");
    }
    Err(MeshGuardError::Env(msg)) => {
        // Missing environment variable
        eprintln!("Env error: {msg}");
    }
}
```

### Error Variants

| Variant | HTTP Status | Description |
|---------|------------|-------------|
| `Authentication` | 401 | Invalid or expired token |
| `PolicyDenied` | 403 | Action denied by policy (only from `enforce`/`govern`) |
| `RateLimit` | 429 | Rate limit exceeded |
| `Api` | 4xx/5xx | Other API errors |
| `Network` | -- | Transport/connection errors |
| `Unhealthy` | -- | Gateway health check failed |
| `Env` | -- | Missing environment variable |

## Health Check

```rust
match client.health().await {
    Ok(()) => println!("Gateway is healthy"),
    Err(e) => eprintln!("Gateway unhealthy: {e}"),
}
```

## Types

### PolicyDecision

```rust
pub struct PolicyDecision {
    pub allowed: bool,
    pub action: String,
    pub decision: Decision,          // Decision::Allow or Decision::Deny
    pub policy: String,
    pub rule: String,
    pub reason: String,
    pub trace_id: String,
    pub timestamp: Option<DateTime<Utc>>,
}
```

### Agent

```rust
pub struct Agent {
    pub id: String,
    pub name: String,
    pub trust_tier: String,
    pub capabilities: Vec<String>,
    pub tags: Vec<String>,
    pub org_id: String,
    pub created_at: Option<DateTime<Utc>>,
}
```

### AuditEntry

```rust
pub struct AuditEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub action: String,
    pub decision: String,
    pub agent_id: String,
    pub policy: String,
    pub rule: String,
    pub reason: String,
    pub resource: String,
    pub meta: HashMap<String, serde_json::Value>,
}
```

### CreateAgentRequest

```rust
pub struct CreateAgentRequest {
    pub name: String,
    pub trust_tier: Option<String>,
    pub tags: Vec<String>,
    pub capabilities: Vec<String>,
}
```

### AuditQueryOptions

```rust
pub struct AuditQueryOptions {
    pub limit: Option<u32>,
    pub decision: Option<String>,
    pub agent_id: Option<String>,
    pub action: Option<String>,
}
```

## Related

- [Python SDK](/integrations/python) -- Python SDK reference
- [JavaScript SDK](/integrations/javascript) -- JavaScript/TypeScript SDK
- [Go SDK](/integrations/go) -- Go SDK reference
- [Generic HTTP](/integrations/http) -- Use MeshGuard with any HTTP client
- [API Reference](/api/overview) -- Gateway and Admin API documentation
- [Policies](/guide/policies) -- Policy format and syntax
