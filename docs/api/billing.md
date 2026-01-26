---
title: "Billing API Reference"
description: "API reference for MeshGuard billing endpoints — checkout, portal, plans, and webhooks"
---

# Billing API Reference

Programmatic access to MeshGuard billing and subscription management. All billing is powered by [Stripe](https://stripe.com).

**Base URL:** `https://dashboard.meshguard.app`

## Authentication

Billing endpoints that modify state require an admin token:

```
Authorization: Bearer <ADMIN_TOKEN>
```

The `POST /billing/checkout` endpoint accepts unauthenticated requests (used from public pricing pages). The `GET /billing/plans` endpoint is public.

## Endpoints

---

### POST /billing/checkout

Create a Stripe Checkout session for a new subscription.

#### Request

```bash
POST /billing/checkout
Content-Type: application/json
```

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Customer email address |
| `plan` | string | Yes | Plan identifier: `starter` or `professional` |
| `interval` | string | Yes | Billing interval: `month` or `year` |

**Example:**

```bash
curl -X POST https://dashboard.meshguard.app/billing/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "plan": "professional",
    "interval": "year"
  }'
```

#### Response

**`200 OK`**

```json
{
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_live_a1b2c3...",
  "sessionId": "cs_live_a1b2c3d4e5f6"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `checkoutUrl` | string | Redirect the user to this URL to complete payment |
| `sessionId` | string | Stripe Checkout Session ID for tracking |

**Errors:**

| Status | Reason |
|--------|--------|
| `400` | Missing or invalid `email`, `plan`, or `interval` |
| `500` | Stripe API error |

**`400` Example:**

```json
{
  "error": "Bad Request",
  "message": "Invalid plan: 'premium'. Must be 'starter' or 'professional'."
}
```

#### Usage

After receiving the response, redirect the user to `checkoutUrl`:

```javascript
const res = await fetch('/billing/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@company.com',
    plan: 'professional',
    interval: 'month',
  }),
});

const { checkoutUrl } = await res.json();
window.location.href = checkoutUrl;
```

---

### POST /billing/portal

Create a Stripe Customer Portal session for managing an existing subscription.

#### Request

```bash
POST /billing/portal
Content-Type: application/json
Authorization: Bearer <ADMIN_TOKEN>
```

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customerId` | string | Yes | Stripe Customer ID (`cus_...`) |

**Example:**

```bash
curl -X POST https://dashboard.meshguard.app/billing/portal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "customerId": "cus_abc123def456"
  }'
```

#### Response

**`200 OK`**

```json
{
  "portalUrl": "https://billing.stripe.com/p/session/bps_1abc..."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `portalUrl` | string | Redirect the user to this URL to manage their subscription |

**Errors:**

| Status | Reason |
|--------|--------|
| `400` | Missing `customerId` |
| `401` | Missing or invalid admin token |
| `404` | Customer not found in Stripe |
| `500` | Stripe API error |

**`404` Example:**

```json
{
  "error": "Not Found",
  "message": "No customer found with ID 'cus_abc123def456'"
}
```

#### Portal Capabilities

The customer portal allows users to:

- Update payment method (credit card)
- Change billing address
- View and download invoices
- Upgrade or downgrade plans
- Cancel subscription

---

### GET /billing/plans

List all available plans and their current pricing.

#### Request

```bash
GET /billing/plans
```

No authentication required.

**Example:**

```bash
curl https://dashboard.meshguard.app/billing/plans
```

#### Response

**`200 OK`**

```json
{
  "plans": [
    {
      "id": "free",
      "name": "Free",
      "description": "For individuals exploring MeshGuard",
      "limits": {
        "agents": 2,
        "policyChecksPerMonth": 1000,
        "policies": 3,
        "auditRetentionDays": 7,
        "teamMembers": 1
      },
      "pricing": {
        "monthly": 0,
        "annual": 0
      },
      "features": [
        "2 agents",
        "1,000 policy checks/month",
        "7-day audit retention",
        "Community support"
      ]
    },
    {
      "id": "starter",
      "name": "Starter",
      "description": "For small teams getting started with governance",
      "limits": {
        "agents": 10,
        "policyChecksPerMonth": 25000,
        "policies": 25,
        "auditRetentionDays": 30,
        "teamMembers": 5
      },
      "pricing": {
        "monthly": 2900,
        "annual": 27800,
        "currency": "usd"
      },
      "stripePrices": {
        "monthly": "price_starter_monthly",
        "annual": "price_starter_annual"
      },
      "features": [
        "10 agents",
        "25,000 policy checks/month",
        "30-day audit retention",
        "Custom policies",
        "Webhook alerts",
        "Email support"
      ]
    },
    {
      "id": "professional",
      "name": "Professional",
      "description": "For teams that need full governance capabilities",
      "limits": {
        "agents": 50,
        "policyChecksPerMonth": 250000,
        "policies": -1,
        "auditRetentionDays": 90,
        "teamMembers": 25
      },
      "pricing": {
        "monthly": 9900,
        "annual": 95000,
        "currency": "usd"
      },
      "stripePrices": {
        "monthly": "price_pro_monthly",
        "annual": "price_pro_annual"
      },
      "features": [
        "50 agents",
        "250,000 policy checks/month",
        "90-day audit retention",
        "Unlimited policies",
        "Delegation chains",
        "Self-hosted deployment",
        "Priority email support",
        "99.9% SLA"
      ]
    },
    {
      "id": "enterprise",
      "name": "Enterprise",
      "description": "Custom solutions for large organizations",
      "limits": {
        "agents": -1,
        "policyChecksPerMonth": -1,
        "policies": -1,
        "auditRetentionDays": -1,
        "teamMembers": -1
      },
      "pricing": null,
      "features": [
        "Unlimited everything",
        "SSO/SAML",
        "Custom audit retention",
        "Dedicated support (Slack)",
        "99.99% SLA",
        "On-premises deployment"
      ]
    }
  ]
}
```

::: info
Pricing amounts are in **cents** (e.g., `2900` = $29.00 USD). A value of `-1` for limits means unlimited. Enterprise pricing is `null` — contact sales.
:::

---

### POST /billing/webhook

Stripe webhook handler. This endpoint receives events from Stripe and updates MeshGuard subscriptions accordingly.

::: warning
This endpoint is called by Stripe, not by your application. You must configure your Stripe webhook endpoint URL to point here.
:::

#### Configuration

In the [Stripe Dashboard](https://dashboard.stripe.com/webhooks):

1. Add endpoint: `https://meshguard.yourcompany.com/billing/webhook`
2. Select events (see below)
3. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

#### Request

```bash
POST /billing/webhook
Content-Type: application/json
Stripe-Signature: t=...,v1=...,v0=...
```

The request body is a Stripe event object. The `Stripe-Signature` header is used to verify the webhook's authenticity.

#### Events Handled

| Event | Description | Action Taken |
|-------|-------------|--------------|
| `checkout.session.completed` | Customer completed checkout | Creates/updates subscription, provisions plan features |
| `customer.subscription.updated` | Subscription changed (upgrade, downgrade, renewal) | Updates plan limits and features |
| `customer.subscription.deleted` | Subscription cancelled or expired | Reverts account to Free plan |

#### Event: `checkout.session.completed`

Triggered when a customer completes Stripe Checkout.

```json
{
  "id": "evt_1abc...",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_live_abc123",
      "customer": "cus_def456",
      "customer_email": "admin@company.com",
      "subscription": "sub_ghi789",
      "metadata": {
        "plan": "professional"
      }
    }
  }
}
```

MeshGuard will:

1. Look up or create the customer record
2. Set the subscription plan and limits
3. Generate an audit log entry
4. Send a confirmation email (if SMTP is configured)

#### Event: `customer.subscription.updated`

Triggered on plan changes, renewals, or payment method updates.

```json
{
  "id": "evt_2def...",
  "type": "customer.subscription.updated",
  "data": {
    "object": {
      "id": "sub_ghi789",
      "customer": "cus_def456",
      "status": "active",
      "items": {
        "data": [
          {
            "price": {
              "id": "price_pro_monthly",
              "recurring": {
                "interval": "month"
              }
            }
          }
        ]
      }
    }
  }
}
```

MeshGuard will:

1. Update the plan and limits based on the new price ID
2. Log the change in the audit trail

#### Event: `customer.subscription.deleted`

Triggered when a subscription is cancelled or expires.

```json
{
  "id": "evt_3ghi...",
  "type": "customer.subscription.deleted",
  "data": {
    "object": {
      "id": "sub_ghi789",
      "customer": "cus_def456",
      "status": "canceled"
    }
  }
}
```

MeshGuard will:

1. Revert the account to the Free plan
2. Retain existing agents and policies (but enforce Free limits)
3. Log the cancellation in the audit trail

#### Response

**`200 OK`** — Webhook processed successfully.

```json
{
  "received": true
}
```

**`400 Bad Request`** — Invalid signature or malformed payload.

```json
{
  "error": "Webhook signature verification failed"
}
```

#### Webhook Signature Verification

MeshGuard verifies every webhook using the `Stripe-Signature` header and the `STRIPE_WEBHOOK_SECRET` environment variable. Requests with invalid signatures are rejected with `400`.

```bash
# Set the webhook secret
STRIPE_WEBHOOK_SECRET=whsec_abc123...
```

#### Testing Webhooks Locally

Use the Stripe CLI to forward webhooks to your local instance:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward events to your local gateway
stripe listen --forward-to http://localhost:3000/billing/webhook

# Trigger a test event
stripe trigger checkout.session.completed
```

## Error Responses

All billing endpoints return errors in a consistent format:

```json
{
  "error": "Error Type",
  "message": "Human-readable description of what went wrong"
}
```

| Status | Error | Description |
|--------|-------|-------------|
| `400` | Bad Request | Missing or invalid parameters |
| `401` | Unauthorized | Missing or invalid admin token |
| `404` | Not Found | Resource not found (customer, subscription) |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Stripe API error or server failure |

## Rate Limits

Billing endpoints share the global rate limit configured by `RATE_LIMIT_RPM` (default: 600 requests/minute). The `POST /billing/webhook` endpoint is exempt from rate limiting.

## Related

- [Billing & Subscriptions](/guide/billing) — Plan comparison and FAQ
- [Gateway Endpoints](/api/gateway) — Core gateway API reference
- [Admin Endpoints](/api/admin) — Agent and policy management API
- [Authentication](/api/authentication) — Token and JWT authentication
- [Self-Hosted Deployment](/guide/self-hosted) — Stripe configuration for self-hosted instances
