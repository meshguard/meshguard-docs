---
title: "SSO / OAuth Login"
description: "Set up Google and GitHub SSO for the MeshGuard dashboard using OAuth2 authorization code flow"
---

# SSO / OAuth Login

MeshGuard supports single sign-on via Google and GitHub OAuth2. Users authenticate with their existing provider account and are automatically matched to a MeshGuard organization based on their email address.

## Supported Providers

| Provider | Scopes Requested | What MeshGuard Reads |
|----------|-----------------|---------------------|
| **Google** | `openid email profile` | Email, name, avatar |
| **GitHub** | `read:user user:email` | Email (primary verified), name, avatar |

## How It Works

The SSO flow follows the standard OAuth2 authorization code grant:

1. **User clicks "Sign in with Google/GitHub"** on the dashboard login page.
2. **MeshGuard redirects** to the provider's authorize URL with a CSRF state token.
3. **User authenticates** with the provider and grants the requested scopes.
4. **Provider redirects back** to MeshGuard's callback URL with an authorization code.
5. **MeshGuard exchanges** the code for an access token (server-side).
6. **MeshGuard fetches** the user's profile and verified email from the provider API.
7. **Org matching** — MeshGuard matches the email to an existing organization:
   - **Exact match**: The user's email matches an org's registered email.
   - **Domain match**: The user's email domain matches an org's email domain (corporate domains only — public providers like `gmail.com`, `outlook.com`, etc. are excluded).
   - **No match**: A new organization is created on the Free plan.
8. **Dashboard JWT issued** — MeshGuard signs a JWT with the user's org ID, email, and plan, then redirects to the dashboard.

::: info Domain Matching
Domain-based org matching is a best-effort heuristic for corporate email domains. Common public email providers (Gmail, Outlook, Yahoo, iCloud, ProtonMail, etc.) are excluded to prevent false matches. If you need strict control over which users join your org, use the Admin API to pre-register authorized emails.
:::

## Setup

### 1. Create OAuth Applications

#### Google

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create a new OAuth 2.0 Client ID (Web application).
3. Add the authorized redirect URI: `https://your-domain.com/auth/google/callback`
4. Copy the **Client ID** and **Client Secret**.

#### GitHub

1. Go to [GitHub Developer Settings](https://github.com/settings/developers).
2. Create a new OAuth App.
3. Set the Authorization callback URL: `https://your-domain.com/auth/github/callback`
4. Copy the **Client ID** and **Client Secret**.

### 2. Configure Environment Variables

Set the following environment variables on your MeshGuard deployment:

```bash
# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Base URL for OAuth redirects (no trailing slash)
OAUTH_REDIRECT_BASE="https://dashboard.meshguard.app"
```

For Docker deployments, add these to your `docker-compose.yml` or pass them via `-e` flags:

```yaml
services:
  meshguard:
    environment:
      GOOGLE_CLIENT_ID: "${GOOGLE_CLIENT_ID}"
      GOOGLE_CLIENT_SECRET: "${GOOGLE_CLIENT_SECRET}"
      GITHUB_CLIENT_ID: "${GITHUB_CLIENT_ID}"
      GITHUB_CLIENT_SECRET: "${GITHUB_CLIENT_SECRET}"
      OAUTH_REDIRECT_BASE: "https://dashboard.meshguard.app"
```

### 3. Verify Callback URLs

The callback URLs must exactly match what you registered with each provider:

| Provider | Callback URL |
|----------|-------------|
| Google | `{OAUTH_REDIRECT_BASE}/auth/google/callback` |
| GitHub | `{OAUTH_REDIRECT_BASE}/auth/github/callback` |

If `OAUTH_REDIRECT_BASE` is `https://dashboard.meshguard.app`, the Google callback URL is `https://dashboard.meshguard.app/auth/google/callback`.

## CSRF Protection

MeshGuard generates a cryptographically random state parameter for each OAuth flow and validates it on the callback. State tokens are:

- Generated using `crypto.randomBytes(24)` encoded as base64url
- Stored in-memory with a 10-minute TTL
- Consumed on use (one-time)
- Validated against the expected provider

If the state parameter is missing, expired, or mismatched, the callback returns an error.

## JWT Token Structure

After successful OAuth login, MeshGuard issues a dashboard JWT containing:

```json
{
  "orgId": "org_abc123",
  "email": "user@company.com",
  "plan": "professional",
  "isSuperAdmin": false,
  "iat": 1713800000,
  "exp": 1713886400,
  "iss": "meshguard"
}
```

This JWT is used for all subsequent dashboard API calls.

## Troubleshooting

### "Invalid or expired OAuth state"

The state token expired (10-minute window) or was already consumed. The user should try signing in again. This can also occur if the browser session was interrupted or the user navigated away and returned to the callback URL manually.

### "Could not retrieve a verified email from GitHub"

The user's GitHub account has no verified email address. GitHub requires the `user:email` scope to access emails. Ensure the OAuth app requests this scope and that the user has at least one verified email on their GitHub account.

### "Could not retrieve email from Google"

The user's Google account did not return an email. This is uncommon but can occur with certain Google Workspace configurations. Ensure the OAuth app requests the `email` scope.

### User lands in the wrong organization

Domain-based matching associated the user with an existing org that shares their email domain. To fix this, use the Admin API to explicitly assign the user's email to the correct organization, or contact support.

### User creates a new org instead of joining an existing one

The user's email did not match any existing org by exact email or domain. Use the Admin API to add the user's email to the target organization before they sign in.

## Security Considerations

- **Never expose client secrets in client-side code.** The OAuth token exchange happens server-side.
- **Use HTTPS for `OAUTH_REDIRECT_BASE`.** OAuth providers require HTTPS callback URLs in production.
- **Rotate client secrets periodically.** If a secret is compromised, rotate it in both the provider console and your MeshGuard environment variables.
- **Restrict redirect URIs.** Only register the exact callback URLs your deployment uses. Do not use wildcard redirects.

## Next Steps

- [Agent Identity](/guide/identity) — How agent tokens work alongside SSO
- [Enterprise](/guide/enterprise) — Enterprise SSO options (SAML, OIDC)
- [Billing & Subscriptions](/guide/billing) — Plan management for SSO-created organizations
