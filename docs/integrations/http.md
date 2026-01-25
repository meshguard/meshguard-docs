# Generic HTTP Integration

Integrate any AI agent or application with MeshGuard using standard HTTP calls. No SDK required.

## Overview

MeshGuard provides a simple HTTP API that any agent can use:

1. **Authenticate** — Include your JWT token in requests
2. **Route through proxy** — Send requests to `/proxy/*`
3. **Handle responses** — Check for policy decisions in status codes

This guide shows you how to integrate using any HTTP client.

## Prerequisites

- MeshGuard gateway running (see [Quickstart](../QUICKSTART.md))
- An agent token
- Any HTTP client (curl, Python requests, fetch, etc.)

## Quick Start

### 1. Get Your Token

```bash
# Create an agent
bun run src/cli/index.ts agent create my-agent --trust verified

# Copy the JWT token that's printed
```

### 2. Make a Request

```bash
# Set your token
export TOKEN="eyJhbGciOiJIUzI1NiIs..."

# Make a governed request
curl http://localhost:3100/proxy/any/path \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Check the Response

| Status | Meaning |
|--------|---------|
| 2xx | Request allowed and proxied successfully |
| 401 | Invalid or expired token |
| 403 | Policy denied the request |
| 429 | Rate limited |
| 5xx | Gateway or target error |

## Authentication

### Bearer Token

Include your JWT in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Token Structure

Your token contains:

```json
{
  "sub": "agent_abc123",        // Agent ID
  "name": "my-agent",           // Agent name
  "trust": "verified",          // Trust tier
  "tags": ["myapp"],            // Tags for policy matching
  "org": "org_xyz",             // Organization (optional)
  "iat": 1706000000,            // Issued at
  "exp": 1706086400             // Expires at
}
```

### Token Refresh

Tokens expire (default: 24h). Generate a new one:

```bash
bun run src/cli/index.ts agent token <agent-id>
```

## API Reference

### Gateway Endpoints

#### Root Info

```bash
curl http://localhost:3100/
```

```json
{
  "name": "MeshGuard Gateway",
  "version": "0.1.0",
  "mode": "enforce",
  "docs": "https://meshguard.app/docs"
}
```

#### Health Check

```bash
curl http://localhost:3100/health
```

```json
{
  "status": "healthy",
  "timestamp": "2026-01-25T12:00:00Z",
  "version": "0.1.0",
  "mode": "enforce"
}
```

#### Proxy Requests

All requests to `/proxy/*` are authenticated, policy-checked, and forwarded:

```bash
# GET request
curl http://localhost:3100/proxy/api/users \
  -H "Authorization: Bearer $TOKEN"

# POST request
curl http://localhost:3100/proxy/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "John"}'

# Any method works
curl -X DELETE http://localhost:3100/proxy/api/users/123 \
  -H "Authorization: Bearer $TOKEN"
```

### Response Headers

MeshGuard adds headers to responses:

| Header | Description |
|--------|-------------|
| `X-MeshGuard-Decision` | `allow` or `deny` |
| `X-MeshGuard-Policy` | Policy name that matched |
| `X-MeshGuard-Trace-Id` | Trace ID for this request |
| `X-MeshGuard-Agent-Id` | Your agent ID |

### Error Responses

#### 401 Unauthorized

```json
{
  "error": "unauthorized",
  "message": "Invalid or expired token"
}
```

#### 403 Forbidden

```json
{
  "error": "forbidden",
  "message": "Policy denied request",
  "reason": "Action 'delete:users' not allowed",
  "policy": "default-policy",
  "action": "delete:users",
  "trace_id": "trace_abc123"
}
```

#### 429 Too Many Requests

```json
{
  "error": "rate_limited",
  "message": "Rate limit exceeded",
  "retry_after": 60,
  "limit": "30 requests per minute"
}
```

## Action Mapping

MeshGuard maps HTTP requests to actions:

| Method | Path | Action |
|--------|------|--------|
| GET | `/proxy/api/users` | `read:api/users` |
| POST | `/proxy/api/users` | `write:api/users` |
| PUT | `/proxy/api/users/123` | `write:api/users/123` |
| PATCH | `/proxy/api/users/123` | `write:api/users/123` |
| DELETE | `/proxy/api/users/123` | `delete:api/users/123` |

### Custom Action Header

Override the automatic action mapping:

```bash
curl http://localhost:3100/proxy/api/data \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-MeshGuard-Action: custom:action"
```

## curl Examples

### Basic GET

```bash
curl -s http://localhost:3100/proxy/api/data \
  -H "Authorization: Bearer $TOKEN" \
  | jq .
```

### POST with JSON

```bash
curl -s http://localhost:3100/proxy/api/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Widget", "price": 9.99}' \
  | jq .
```

### With Trace ID

```bash
curl -s http://localhost:3100/proxy/api/data \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Trace-ID: my-trace-123" \
  | jq .
```

### Check Policy Decision

```bash
# Get headers to see decision
curl -sI http://localhost:3100/proxy/api/data \
  -H "Authorization: Bearer $TOKEN" \
  | grep -i meshguard
```

### Handle Errors

```bash
#!/bin/bash
TOKEN="your-token"
MESHGUARD="http://localhost:3100"

response=$(curl -s -w "\n%{http_code}" "$MESHGUARD/proxy/api/data" \
  -H "Authorization: Bearer $TOKEN")

body=$(echo "$response" | head -n -1)
status=$(echo "$response" | tail -n 1)

case $status in
  200) echo "Success: $body" ;;
  401) echo "Auth failed - check token" ;;
  403) echo "Policy denied: $(echo $body | jq -r .reason)" ;;
  429) echo "Rate limited - slow down" ;;
  *)   echo "Error $status: $body" ;;
esac
```

## Python Examples

### Using requests

```python
import requests
import os

MESHGUARD_URL = os.getenv("MESHGUARD_URL", "http://localhost:3100")
MESHGUARD_TOKEN = os.getenv("MESHGUARD_TOKEN")

class MeshGuardClient:
    """Simple MeshGuard HTTP client."""
    
    def __init__(self, url: str, token: str):
        self.base_url = url.rstrip("/")
        self.session = requests.Session()
        self.session.headers["Authorization"] = f"Bearer {token}"
    
    def request(self, method: str, path: str, **kwargs) -> dict:
        """Make a governed request."""
        url = f"{self.base_url}/proxy{path}"
        response = self.session.request(method, url, **kwargs)
        
        # Handle common errors
        if response.status_code == 401:
            raise AuthError("Invalid or expired token")
        if response.status_code == 403:
            data = response.json()
            raise PolicyError(data.get("reason", "Policy denied"))
        if response.status_code == 429:
            raise RateLimitError("Rate limit exceeded")
        
        response.raise_for_status()
        return response.json() if response.content else {}
    
    def get(self, path: str, **kwargs):
        return self.request("GET", path, **kwargs)
    
    def post(self, path: str, **kwargs):
        return self.request("POST", path, **kwargs)
    
    def put(self, path: str, **kwargs):
        return self.request("PUT", path, **kwargs)
    
    def delete(self, path: str, **kwargs):
        return self.request("DELETE", path, **kwargs)


class MeshGuardError(Exception):
    pass

class AuthError(MeshGuardError):
    pass

class PolicyError(MeshGuardError):
    pass

class RateLimitError(MeshGuardError):
    pass


# Usage
client = MeshGuardClient(MESHGUARD_URL, MESHGUARD_TOKEN)

try:
    # Read data
    data = client.get("/api/users")
    print(data)
    
    # Create item
    result = client.post("/api/items", json={"name": "Widget"})
    print(result)
    
except PolicyError as e:
    print(f"Blocked by policy: {e}")
except AuthError as e:
    print(f"Auth failed: {e}")
except RateLimitError:
    print("Slow down!")
```

### Async with httpx

```python
import httpx
import asyncio
import os

MESHGUARD_URL = os.getenv("MESHGUARD_URL", "http://localhost:3100")
MESHGUARD_TOKEN = os.getenv("MESHGUARD_TOKEN")

async def governed_request(method: str, path: str, **kwargs):
    """Make an async governed request."""
    async with httpx.AsyncClient() as client:
        response = await client.request(
            method,
            f"{MESHGUARD_URL}/proxy{path}",
            headers={"Authorization": f"Bearer {MESHGUARD_TOKEN}"},
            **kwargs
        )
        
        if response.status_code == 403:
            data = response.json()
            raise PermissionError(data.get("reason"))
        
        response.raise_for_status()
        return response.json() if response.content else {}


async def main():
    # Parallel governed requests
    results = await asyncio.gather(
        governed_request("GET", "/api/users"),
        governed_request("GET", "/api/items"),
        governed_request("GET", "/api/settings"),
        return_exceptions=True
    )
    
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"Request {i} failed: {result}")
        else:
            print(f"Request {i} succeeded: {result}")


asyncio.run(main())
```

## JavaScript/TypeScript Examples

### Using fetch

```typescript
const MESHGUARD_URL = process.env.MESHGUARD_URL ?? 'http://localhost:3100';
const MESHGUARD_TOKEN = process.env.MESHGUARD_TOKEN!;

class MeshGuardClient {
  private baseUrl: string;
  private token: string;

  constructor(url: string, token: string) {
    this.baseUrl = url.replace(/\/$/, '');
    this.token = token;
  }

  async request<T = any>(
    method: string,
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/proxy${path}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (response.status === 401) {
      throw new Error('Invalid or expired token');
    }
    
    if (response.status === 403) {
      const data = await response.json();
      throw new Error(`Policy denied: ${data.reason}`);
    }
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  get<T = any>(path: string) {
    return this.request<T>('GET', path);
  }

  post<T = any>(path: string, body: any) {
    return this.request<T>('POST', path, { body: JSON.stringify(body) });
  }

  put<T = any>(path: string, body: any) {
    return this.request<T>('PUT', path, { body: JSON.stringify(body) });
  }

  delete<T = any>(path: string) {
    return this.request<T>('DELETE', path);
  }
}

// Usage
const client = new MeshGuardClient(MESHGUARD_URL, MESHGUARD_TOKEN);

async function main() {
  try {
    const users = await client.get('/api/users');
    console.log('Users:', users);

    const newItem = await client.post('/api/items', { name: 'Widget' });
    console.log('Created:', newItem);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
```

### Node.js with axios

```javascript
const axios = require('axios');

const meshguard = axios.create({
  baseURL: process.env.MESHGUARD_URL || 'http://localhost:3100',
  headers: {
    'Authorization': `Bearer ${process.env.MESHGUARD_TOKEN}`,
  },
});

// Add response interceptor for error handling
meshguard.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 403) {
      const reason = error.response.data?.reason || 'Policy denied';
      return Promise.reject(new Error(`MeshGuard: ${reason}`));
    }
    return Promise.reject(error);
  }
);

// Usage
async function fetchData() {
  const { data } = await meshguard.get('/proxy/api/data');
  return data;
}
```

## Go Example

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
)

type MeshGuardClient struct {
    BaseURL string
    Token   string
    Client  *http.Client
}

func NewMeshGuardClient(url, token string) *MeshGuardClient {
    return &MeshGuardClient{
        BaseURL: url,
        Token:   token,
        Client:  &http.Client{},
    }
}

func (c *MeshGuardClient) Request(method, path string, body interface{}) ([]byte, error) {
    var bodyReader io.Reader
    if body != nil {
        jsonBody, _ := json.Marshal(body)
        bodyReader = bytes.NewBuffer(jsonBody)
    }

    req, err := http.NewRequest(method, c.BaseURL+"/proxy"+path, bodyReader)
    if err != nil {
        return nil, err
    }

    req.Header.Set("Authorization", "Bearer "+c.Token)
    req.Header.Set("Content-Type", "application/json")

    resp, err := c.Client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    respBody, _ := io.ReadAll(resp.Body)

    if resp.StatusCode == 403 {
        return nil, fmt.Errorf("policy denied: %s", string(respBody))
    }
    if resp.StatusCode >= 400 {
        return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respBody))
    }

    return respBody, nil
}

func main() {
    client := NewMeshGuardClient(
        os.Getenv("MESHGUARD_URL"),
        os.Getenv("MESHGUARD_TOKEN"),
    )

    // GET request
    data, err := client.Request("GET", "/api/users", nil)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    fmt.Println("Response:", string(data))
}
```

## Tracing

### Set Trace ID

Include a trace ID to correlate requests:

```bash
curl http://localhost:3100/proxy/api/data \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Trace-ID: my-conversation-123"
```

### View Trace

```bash
bun run src/cli/index.ts audit trace my-conversation-123
```

### Generate Trace IDs

```python
import uuid

# Per-conversation trace
conversation_id = str(uuid.uuid4())

# Include in all requests for that conversation
headers = {
    "Authorization": f"Bearer {token}",
    "X-Trace-ID": conversation_id
}
```

## Best Practices

### 1. Handle All Error Cases

```python
try:
    result = client.get("/api/data")
except AuthError:
    # Token expired - refresh and retry
    refresh_token()
    result = client.get("/api/data")
except PolicyError as e:
    # Log and inform user
    log_policy_violation(e)
    return "This action is not allowed by policy"
except RateLimitError:
    # Back off and retry
    time.sleep(60)
    result = client.get("/api/data")
```

### 2. Use Meaningful Trace IDs

```python
# ❌ Bad - random trace per request
trace_id = str(uuid.uuid4())

# ✅ Good - trace per conversation/workflow
trace_id = f"user-{user_id}-chat-{chat_id}"
```

### 3. Log Policy Decisions

```python
response = requests.get(url, headers=headers)

# Log the decision
decision = response.headers.get("X-MeshGuard-Decision")
policy = response.headers.get("X-MeshGuard-Policy")
logger.info(f"MeshGuard: {decision} by {policy}")
```

### 4. Implement Retry Logic

```python
import time
from functools import wraps

def with_retry(max_attempts=3, backoff=1):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except RateLimitError:
                    last_error = "Rate limited"
                    time.sleep(backoff * (2 ** attempt))
                except AuthError:
                    # Don't retry auth errors
                    raise
            raise Exception(f"Max retries exceeded: {last_error}")
        return wrapper
    return decorator

@with_retry(max_attempts=3)
def fetch_data():
    return client.get("/api/data")
```

## Testing

### Test Authentication

```bash
# Valid token should work
curl -s http://localhost:3100/proxy/api/test \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nStatus: %{http_code}\n"

# Invalid token should fail
curl -s http://localhost:3100/proxy/api/test \
  -H "Authorization: Bearer invalid-token" \
  -w "\nStatus: %{http_code}\n"
```

### Test Policy Enforcement

```bash
# Allowed action
curl -s http://localhost:3100/proxy/api/read \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nStatus: %{http_code}\n"

# Denied action
curl -s -X DELETE http://localhost:3100/proxy/api/delete \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nStatus: %{http_code}\n"
```

### Automated Tests

```python
import pytest

def test_authentication():
    """Test that valid tokens work."""
    response = requests.get(
        f"{MESHGUARD_URL}/proxy/api/test",
        headers={"Authorization": f"Bearer {VALID_TOKEN}"}
    )
    assert response.status_code == 200

def test_invalid_token():
    """Test that invalid tokens are rejected."""
    response = requests.get(
        f"{MESHGUARD_URL}/proxy/api/test",
        headers={"Authorization": "Bearer invalid"}
    )
    assert response.status_code == 401

def test_policy_allow():
    """Test that allowed actions succeed."""
    response = requests.get(
        f"{MESHGUARD_URL}/proxy/api/read",
        headers={"Authorization": f"Bearer {TOKEN}"}
    )
    assert response.status_code == 200

def test_policy_deny():
    """Test that denied actions fail."""
    response = requests.delete(
        f"{MESHGUARD_URL}/proxy/api/delete",
        headers={"Authorization": f"Bearer {TOKEN}"}
    )
    assert response.status_code == 403
```

## Troubleshooting

### Connection Refused

MeshGuard isn't running:

```bash
cd meshguard
bun run src/index.ts
```

### 401 on Every Request

Token issues:

```bash
# Check token validity
echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .

# Generate new token
bun run src/cli/index.ts agent token <agent-id>
```

### 403 on Expected Allow

Policy mismatch:

```bash
# See what's allowed
bun run src/cli/index.ts policy allowed <agent-id>

# Test specific action
bun run src/cli/index.ts policy test <agent-id> "read:api/data"

# Check audit log
bun run src/cli/index.ts audit tail -n 5
```

### Requests Timing Out

Check target connectivity:

```bash
# Test direct connection to target
curl -v $PROXY_TARGET/api/test

# Check MeshGuard health
curl http://localhost:3100/health
```

## Next Steps

- [LangChain Integration](./langchain.md) — Python agent framework
- [CrewAI Integration](./crewai.md) — Multi-agent systems
- [AutoGPT Integration](./autogpt.md) — Autonomous agents
- [Policy Reference](../GETTING_STARTED.md#understanding-policies) — Write custom policies
