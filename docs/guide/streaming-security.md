---
title: "Streaming Content Inspection"
description: "Real-time policy enforcement for streaming LLM output — detect PII, prompt injection, and sensitive data before it reaches users"
---

# Streaming Content Inspection

MeshGuard inspects streaming LLM output in real time, detecting sensitive data and prompt injection patterns before tokens reach the end user. This guide covers how the streaming proxy works, its enforcement modes, buffer management, and configuration.

## How It Works

When your application requests a streaming completion from an LLM provider (OpenAI, Anthropic, or any SSE-compatible API), MeshGuard sits between the provider and your client as a transparent proxy. Each chunk of the SSE stream passes through a policy evaluator that checks for pattern matches against your configured policies. Depending on the match and policy mode, MeshGuard can:

- **Allow** the chunk through unchanged
- **Redact** sensitive content in-line (replacing matches with `[REDACTED]`)
- **Warn** by injecting a warning event into the stream
- **Block** by terminating the stream with an error event

The proxy auto-detects the LLM provider from the target URL and parses the provider-specific chunk format (OpenAI `choices[].delta.content`, Anthropic `content_block_delta`, or generic fallbacks).

## Enforcement Modes

Each streaming policy has a mode that controls when it acts:

| Mode | Behavior | Use Case |
|------|----------|----------|
| `eager` | Act immediately on any match | High-confidence patterns like SSN, credit card, API keys |
| `confident` | Buffer chunks, act when confidence exceeds threshold | Patterns prone to false positives (phone numbers, emails) |
| `reconstruct` | Allow stream through, log violations, redact on replay | Post-hoc compliance auditing |
| `hybrid` | Eager for high-confidence matches (>0.9), confident for others | Recommended default — balances speed and accuracy |

The default mode is `hybrid` with a confidence threshold of `0.85`.

## Supported Pattern Types

MeshGuard detects the following pattern types in streaming content:

| Pattern | Confidence | Description |
|---------|-----------|-------------|
| `SSN` | 0.95 | Social Security Numbers (with Luhn-like validation) |
| `CREDIT_CARD` | 0.98 | Major credit card formats (with Luhn validation) |
| `PHONE` | 0.75 | Phone numbers (lower confidence — more false positives) |
| `EMAIL` | 0.90 | Email addresses |
| `IP_ADDRESS` | 0.85 | IPv4 addresses |
| `API_KEY` | 0.95 | Common API key formats (`sk_`, `pk_`, `api_`, `key_`) |
| `PASSWORD` | 0.90 | Password patterns in text |
| `HEALTH_DATA` | 0.92 | ICD codes, medical record numbers, DOB patterns |
| `KEYWORD` | 1.0 | Custom keyword blocklist |
| `REGEX` | 0.90 | Custom regex patterns |
| `PROMPT_INJECTION` | 0.85 | Prompt injection detection (see below) |

## Prompt Injection Detection

The streaming evaluator includes a built-in prompt injection scanner that detects common attack patterns in LLM output. This catches cases where an LLM has been manipulated into producing injection payloads intended for downstream agents.

Detected categories:

- **Instruction override** — "ignore previous instructions", behavioral modification attempts
- **Role manipulation** — "you are now X", developer mode, DAN jailbreaks
- **System prompt extraction** — attempts to reveal hidden prompts
- **Delimiter injection** — fake `<system>` tags, code fence escapes, XML injection
- **Encoding evasion** — base64 instructions, unicode manipulation, leetspeak
- **Payload smuggling** — hidden instruction markers, completion manipulation
- **Context manipulation** — token exhaustion, conversation reset

Each match includes a severity (`low`, `medium`, `high`, `critical`), a confidence score, and an overall risk score (0-100). The scanner produces an explicit recommendation (`allow`, `warn`, `review`, `block`) with confidence band metadata that includes estimated false positive and false negative rates.

::: warning Defense in Depth
Prompt injection detection is heuristic-based. It will have false negatives (missed attacks) and false positives (flagged legitimate text). Use it as one layer in a defense-in-depth strategy alongside action governance, not as sole protection.
:::

## Buffer Management

Streaming content arrives in small chunks that may split a pattern across boundaries. For example, a credit card number `4111-1111-1111-1111` might arrive as `4111-1111` in one chunk and `-1111-1111` in the next.

MeshGuard maintains a **sliding window buffer** per session that concatenates recent chunks for context-aware evaluation:

- **Buffer size** — Configurable token window (default: 20 tokens). The buffer retains up to 100 chunks and 50 tokens of context.
- **Token estimation** — Approximate, at ~4 characters per token.
- **Window evaluation** — Each new chunk is evaluated against the concatenated window, so patterns spanning chunk boundaries are caught.
- **Buffer pool** — A global pool manages buffers across concurrent sessions, with automatic pruning of stale sessions (default: 5 minutes).

## Configuration

### Proxy Configuration

The streaming proxy accepts the following top-level configuration:

```typescript
{
  enabled: true,                      // Enable/disable the proxy
  defaultMode: 'hybrid',             // Default enforcement mode
  defaultBufferTokens: 20,           // Sliding window size in tokens
  defaultConfidenceThreshold: 0.85,  // Confidence threshold for 'confident' mode
  maxLatencyMs: 100,                 // Circuit breaker threshold
  enableAudit: true,                 // Record audit entries per stream
  enableMetrics: true,               // Track session metrics
}
```

### Policy Configuration

Define policies as an array. Each policy targets specific pattern types with an enforcement mode and action:

```typescript
// Eagerly redact high-confidence PII
{
  name: 'pii-eager-redact',
  enabled: true,
  mode: 'eager',
  bufferTokens: 10,
  confidenceThreshold: 0.9,
  patterns: ['SSN', 'CREDIT_CARD'],
  action: 'redact',
  redactWith: '[REDACTED]',
}

// Block API keys and passwords immediately
{
  name: 'api-keys-block',
  enabled: true,
  mode: 'eager',
  bufferTokens: 5,
  confidenceThreshold: 0.95,
  patterns: ['API_KEY', 'PASSWORD'],
  action: 'block',
}

// Warn on lower-confidence PII with more context
{
  name: 'pii-confident-warn',
  enabled: true,
  mode: 'confident',
  bufferTokens: 20,
  confidenceThreshold: 0.8,
  patterns: ['PHONE', 'EMAIL', 'IP_ADDRESS'],
  action: 'warn',
  warnMessage: 'Response may contain personal information',
}
```

You can also add custom keywords and regex patterns:

```typescript
{
  name: 'custom-blocklist',
  enabled: true,
  mode: 'eager',
  bufferTokens: 10,
  confidenceThreshold: 0.9,
  patterns: ['KEYWORD', 'REGEX'],
  keywords: ['INTERNAL_SECRET', 'PROJECT_CODENAME'],
  customRegex: ['\\bACME-\\d{6}\\b'],
  action: 'redact',
  redactWith: '[REMOVED]',
}
```

## Using the Streaming Proxy

### Python SDK

```python
from meshguard import MeshGuardClient

client = MeshGuardClient(
    gateway_url="https://dashboard.meshguard.app",
    agent_token="your-agent-token",
)

# Proxy a streaming request through MeshGuard
response = client.proxy_stream(
    target_url="https://api.openai.com/v1/chat/completions",
    method="POST",
    headers={"Authorization": f"Bearer {openai_key}"},
    body={"model": "gpt-4o", "messages": messages, "stream": True},
    policies=[
        {"name": "redact-pii", "patterns": ["SSN", "CREDIT_CARD"], "action": "redact"},
    ],
)

for chunk in response:
    print(chunk.content, end="", flush=True)
```

### JavaScript SDK

```javascript
import { MeshGuardClient } from '@meshguard/sdk';

const client = new MeshGuardClient({
  gatewayUrl: 'https://dashboard.meshguard.app',
  agentToken: 'your-agent-token',
});

const response = await client.proxyStream({
  targetUrl: 'https://api.openai.com/v1/chat/completions',
  method: 'POST',
  headers: { Authorization: `Bearer ${openaiKey}` },
  body: JSON.stringify({ model: 'gpt-4o', messages, stream: true }),
  policies: [
    { name: 'redact-pii', patterns: ['SSN', 'CREDIT_CARD'], action: 'redact' },
  ],
});

for await (const chunk of response) {
  process.stdout.write(chunk.content);
}
```

## Intervention Behavior

When the evaluator triggers an intervention, the behavior depends on the action:

**Block** — The stream is immediately terminated. MeshGuard sends an SSE error event with a `CONTENT_BLOCKED` code and the policy violation reason, then closes the connection.

```json
{
  "error": {
    "message": "Content blocked by policy",
    "type": "policy_violation",
    "reason": "Blocked by policy 'api-keys-block': API Key",
    "code": "CONTENT_BLOCKED"
  }
}
```

**Redact** — The matched content is replaced with the configured `redactWith` string (default `[REDACTED]`). The chunk is reconstructed in the provider-specific format and delivered to the client. The original content is preserved in the audit log.

**Warn** — A warning SSE event is injected into the stream (sent once per session). The original content passes through unchanged.

```json
{
  "warning": {
    "message": "Response may contain personal information",
    "type": "policy_warning"
  }
}
```

**Allow** — The chunk passes through unchanged.

## Response Headers

Every proxied stream includes these response headers:

| Header | Value |
|--------|-------|
| `X-MeshGuard-Session` | Unique session ID for this stream |
| `X-MeshGuard-Trace` | Trace ID for audit correlation |
| `Content-Type` | `text/event-stream` |
| `Cache-Control` | `no-cache` |

## Audit Trail

When audit is enabled (default), every stream session produces a `StreamAuditEntry` containing:

- Original vs. delivered content for every chunk
- Each intervention applied (chunk index, action, reason, pattern matches)
- Summary counts (total interventions, whether the stream was blocked/redacted/warned)
- Session metadata (agent ID, org ID, provider, trace ID)

Query audit entries via the Admin API or the Analytics Dashboard.

## Monitoring

Use `getStreamingStats()` to retrieve real-time metrics:

- **Active sessions** — Number of streams currently being proxied
- **Total chunks** — Chunks processed across all sessions
- **Total interventions** — Interventions triggered across all sessions
- **Average latency** — Per-chunk evaluation latency in milliseconds

The circuit breaker threshold (`maxLatencyMs`, default 100ms) monitors per-chunk evaluation latency. If evaluation consistently exceeds this threshold, consider reducing buffer size or switching high-volume policies to `reconstruct` mode.

## Next Steps

- [Policies](/guide/policies) — Configure policy rules for your agents
- [Audit Logging](/guide/audit) — Query streaming audit entries
- [Analytics Dashboard](/guide/analytics) — Visualize streaming intervention metrics
- [Alerting](/guide/alerting) — Set up alerts on streaming violations
