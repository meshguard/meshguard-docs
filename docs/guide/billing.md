---
title: "Billing & Subscriptions"
description: "Plan comparison, pricing, and subscription management for MeshGuard"
---

# Billing & Subscriptions

MeshGuard offers tiered plans for individuals, teams, and enterprises. All paid plans include a 14-day free trial.

## Plans

| Feature | Free | Starter | Professional | Enterprise |
|---------|------|---------|-------------|------------|
| **Price (monthly)** | $0 | $29/mo | $99/mo | Custom |
| **Price (annual)** | $0 | $278/yr | $950/yr | Custom |
| **Agents** | 2 | 10 | 50 | Unlimited |
| **Policy checks/mo** | 1,000 | 25,000 | 250,000 | Unlimited |
| **Policies** | 3 | 25 | Unlimited | Unlimited |
| **Audit log retention** | 7 days | 30 days | 90 days | Custom |
| **Team members** | 1 | 5 | 25 | Unlimited |
| **Custom policies** | ✗ | ✓ | ✓ | ✓ |
| **Webhook alerts** | ✗ | ✓ | ✓ | ✓ |
| **Delegation chains** | ✗ | ✗ | ✓ | ✓ |
| **SSO/SAML** | ✗ | ✗ | ✗ | ✓ |
| **Self-hosted** | ✗ | ✗ | ✓ | ✓ |
| **Dedicated support** | ✗ | ✗ | ✗ | ✓ |
| **SLA** | ✗ | ✗ | 99.9% | 99.99% |
| **Support** | Community | Email | Priority email | Dedicated Slack |

Annual billing saves **20%** compared to monthly.

## Feature Limits

### Policy Checks

Each call to `client.check()`, `client.enforce()`, or the `/proxy/*` gateway endpoint counts as one policy check. Health checks and audit queries do not count.

When you reach your plan's limit, behavior depends on your configuration:

- **Enforce mode**: Additional checks return `allow` by default (fail-open) and a warning is logged
- **Strict mode**: Additional checks return `deny` (fail-closed) — enable with `MESHGUARD_STRICT_LIMITS=true`

Usage resets on the 1st of each calendar month (UTC).

### Agents

Each registered agent identity counts toward your agent limit. Revoked agents do not count. You can view active agents at any time:

```bash
meshguard agent list
```

### Audit Log Retention

Audit entries older than your plan's retention period are automatically purged. Export logs before they expire:

```bash
meshguard audit export --from 2026-01-01 --format json > audit-backup.json
```

## How to Upgrade

### Via the Pricing Page

Visit [meshguard.app/pricing](https://meshguard.app/pricing) and select a plan. You'll be redirected to Stripe Checkout to complete payment.

### Via the API

```bash
curl -X POST https://dashboard.meshguard.app/billing/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@company.com",
    "plan": "professional",
    "interval": "month"
  }'
```

Response:

```json
{
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_live_...",
  "sessionId": "cs_live_abc123"
}
```

Open the `checkoutUrl` in a browser to complete checkout.

### Via the Dashboard

Navigate to **Settings → Billing** in the [MeshGuard dashboard](https://dashboard.meshguard.app) and click **Upgrade**.

## Stripe Checkout Flow

1. You initiate checkout (pricing page, API, or dashboard)
2. Stripe Checkout opens with your selected plan and interval
3. Enter payment details and confirm
4. Stripe processes payment and sends a `checkout.session.completed` webhook to MeshGuard
5. Your account is upgraded immediately
6. A confirmation email is sent to your billing address

MeshGuard never stores credit card details. All payment processing is handled by [Stripe](https://stripe.com).

## Managing Subscriptions

### Customer Portal

Access your Stripe customer portal to:

- Update payment method
- Change billing address
- View invoice history
- Download invoices (PDF)
- Cancel subscription

#### Via Dashboard

Navigate to **Settings → Billing → Manage Subscription**.

#### Via API

```bash
curl -X POST https://dashboard.meshguard.app/billing/portal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "customerId": "cus_abc123"
  }'
```

Response:

```json
{
  "portalUrl": "https://billing.stripe.com/p/session/..."
}
```

### Switching Plans

Upgrade or downgrade at any time through the customer portal. Changes take effect immediately:

- **Upgrade**: You're charged a prorated amount for the remainder of the billing cycle
- **Downgrade**: A credit is applied to your next invoice

### Cancellation

Cancel anytime from the customer portal. Your plan remains active until the end of the current billing period — no partial refunds, but you keep access until the period ends.

## Annual Billing

Annual plans are **20% cheaper** than monthly. To switch:

1. Open the customer portal
2. Click **Update plan**
3. Select the annual interval

Or via API, specify `"interval": "year"` when creating a checkout session.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/billing/checkout` | Create a Stripe Checkout session |
| `POST` | `/billing/portal` | Create a customer portal session |
| `GET` | `/billing/plans` | List available plans and pricing |

See the full [Billing API Reference](/api/billing) for request/response schemas.

## Enterprise Custom Pricing

For organizations needing:

- Unlimited agents and policy checks
- Custom audit log retention
- SSO/SAML integration
- Dedicated support channel
- Custom SLA
- On-premises deployment support
- Volume discounts

Contact **sales@meshguard.app** or visit [meshguard.app/enterprise](https://meshguard.app/enterprise).

## FAQ

### How does proration work?

When you upgrade mid-cycle, you're charged only for the remaining days at the new rate. A credit for unused time on the old plan is applied automatically. Stripe handles all proration calculations.

### Can I cancel anytime?

Yes. Cancel through the customer portal. Your plan stays active until the end of the current billing period. There are no cancellation fees.

### Do you offer refunds?

We do not offer partial refunds for unused time. If you cancel, you retain access until the end of your billing period. For exceptional circumstances, contact **support@meshguard.app**.

### What happens when my trial ends?

After 14 days, you're automatically moved to the Free plan unless you've entered payment details. No charge is made without your consent.

### Can I change plans mid-cycle?

Yes. Upgrades are effective immediately with prorated billing. Downgrades take effect at the next billing cycle.

### Do you support invoicing?

Enterprise customers can pay by invoice with NET-30 terms. Contact sales for details.

### What currency do you bill in?

All plans are billed in USD. Stripe handles currency conversion for international cards.

### Is there a non-profit or education discount?

Yes. Contact **support@meshguard.app** with verification for 50% off any plan.

## Related

- [Billing API Reference](/api/billing) — Full API documentation for billing endpoints
- [Enterprise](/guide/enterprise) — Enterprise features and deployment
- [Self-Hosted Deployment](/guide/self-hosted) — Run MeshGuard on your own infrastructure
- [Getting Started](/guide/getting-started) — Set up your first MeshGuard agent
