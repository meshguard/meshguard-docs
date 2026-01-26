---
title: "Self-Hosted Deployment"
description: "Deploy MeshGuard on your own infrastructure with Docker, Nginx, and production hardening"
---

# Self-Hosted Deployment

Run the MeshGuard governance gateway on your own infrastructure for full data sovereignty.

::: warning Enterprise Feature
Self-hosted deployment is available on **Professional** and **Enterprise** plans only. It requires a signed license agreement with MeshGuard. Contact [contact@meshguard.app](mailto:contact@meshguard.app) to get started.
:::

## How It Works

Once your license agreement is in place, our team will:

1. **Provision access** to the private container registry with your licensed MeshGuard image
2. **Provide a license key** for your deployment
3. **Guide your setup** with deployment support included in your plan

## Docker Deployment

### Quick Start

```bash
# Requires registry access — contact contact@meshguard.app
docker login registry.meshguard.app
docker pull registry.meshguard.app/meshguard:latest

docker run -d \
  --name meshguard \
  -p 3000:3000 \
  -e MESHGUARD_LICENSE_KEY="your-license-key" \
  -e JWT_SECRET="your-secure-secret-here" \
  -e ADMIN_TOKEN="your-admin-token" \
  -e MODE=enforce \
  -v meshguard-data:/data \
  registry.meshguard.app/meshguard:latest
```

### Docker Compose

Create a `docker-compose.yml`:

```yaml
version: "3.8"

services:
  meshguard:
    image: registry.meshguard.app/meshguard:latest
    container_name: meshguard
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      PORT: "3000"
      HOST: "0.0.0.0"
      MODE: "enforce"
      JWT_SECRET: "${JWT_SECRET}"
      ADMIN_TOKEN: "${ADMIN_TOKEN}"
      PROXY_TARGET: "https://api.yourapp.com"
      POLICIES_DIR: "/data/policies"
      DB_PATH: "/data/meshguard.db"
      AUDIT_RETENTION_DAYS: "90"

      # Email alerts (optional)
      SMTP_HOST: "smtp.mailgun.org"
      SMTP_PORT: "587"
      SMTP_USER: "${SMTP_USER}"
      SMTP_PASS: "${SMTP_PASS}"
      SMTP_FROM: "alerts@meshguard.yourcompany.com"
      ALERT_EMAIL: "ops@yourcompany.com"

      # Stripe billing (optional)
      STRIPE_SECRET_KEY: "${STRIPE_SECRET_KEY}"
      STRIPE_WEBHOOK_SECRET: "${STRIPE_WEBHOOK_SECRET}"
      STRIPE_PRICE_STARTER_MONTHLY: "price_abc123"
      STRIPE_PRICE_STARTER_ANNUAL: "price_def456"
      STRIPE_PRICE_PRO_MONTHLY: "price_ghi789"
      STRIPE_PRICE_PRO_ANNUAL: "price_jkl012"
    volumes:
      - meshguard-data:/data
      - ./policies:/data/policies:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  meshguard-data:
```

Create a `.env` file (do **not** commit this):

```bash
JWT_SECRET=change-me-to-a-64-char-random-string
ADMIN_TOKEN=change-me-to-a-secure-admin-token
SMTP_USER=postmaster@mg.yourcompany.com
SMTP_PASS=your-smtp-password
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Start the stack:

```bash
docker compose up -d
```

## Environment Variables Reference

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address |
| `MODE` | `enforce` | Gateway mode: `enforce` or `audit` |
| `JWT_SECRET` | — | **Required.** Secret for signing agent JWTs. Min 32 characters. |
| `ADMIN_TOKEN` | — | **Required.** Token for admin API endpoints. |
| `PROXY_TARGET` | — | Upstream URL for proxy pass-through |
| `POLICIES_DIR` | `./policies` | Path to YAML policy files |
| `DB_PATH` | `./meshguard.db` | SQLite database path |
| `AUDIT_RETENTION_DAYS` | `90` | Days to retain audit log entries |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `CORS_ORIGIN` | `*` | Allowed CORS origins (comma-separated) |
| `RATE_LIMIT_RPM` | `600` | Rate limit: requests per minute per IP |

### SMTP (Email Alerts)

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | — | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |
| `SMTP_FROM` | — | Sender email address |
| `SMTP_SECURE` | `true` | Use TLS (`true` or `false`) |
| `ALERT_EMAIL` | — | Recipient for alert emails |

### Stripe (Billing)

| Variable | Default | Description |
|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | — | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | — | Stripe webhook signing secret |
| `STRIPE_PRICE_STARTER_MONTHLY` | — | Stripe Price ID for Starter monthly |
| `STRIPE_PRICE_STARTER_ANNUAL` | — | Stripe Price ID for Starter annual |
| `STRIPE_PRICE_PRO_MONTHLY` | — | Stripe Price ID for Professional monthly |
| `STRIPE_PRICE_PRO_ANNUAL` | — | Stripe Price ID for Professional annual |

## Nginx Reverse Proxy

Place MeshGuard behind Nginx for TLS termination, rate limiting, and caching.

### `/etc/nginx/sites-available/meshguard`

```nginx
upstream meshguard {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name meshguard.yourcompany.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name meshguard.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/meshguard.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/meshguard.yourcompany.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Request size limit
    client_max_body_size 10m;

    location / {
        proxy_pass http://meshguard;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 10s;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
    }

    # Health check (no auth required)
    location /health {
        proxy_pass http://meshguard/health;
        access_log off;
    }

    # Block direct access to admin without IP restriction
    location /admin {
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;

        proxy_pass http://meshguard;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/meshguard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d meshguard.yourcompany.com

# Auto-renewal (certbot installs a systemd timer automatically)
sudo certbot renew --dry-run
```

Certificates auto-renew every 60 days. Verify the timer:

```bash
sudo systemctl status certbot.timer
```

## Database

MeshGuard uses **SQLite** by default — no external database required.

### Configuration

```bash
DB_PATH=/data/meshguard.db
```

The database stores:

- Agent registrations and tokens
- Policy definitions
- Audit log entries
- Billing/subscription data (if Stripe is configured)

### Path Recommendations

| Environment | Path |
|-------------|------|
| Docker | `/data/meshguard.db` (mount a volume) |
| Bare metal | `/var/lib/meshguard/meshguard.db` |
| Development | `./meshguard.db` (current directory) |

### Performance

SQLite handles thousands of requests per second with WAL mode (enabled by default). For extremely high throughput (>10,000 policy checks/second), contact us about PostgreSQL support.

## Health Check Endpoint

```bash
GET /health
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2026-01-26T17:30:00.000Z",
  "version": "0.1.0",
  "mode": "enforce",
  "uptime": 86400,
  "checks": {
    "database": "ok",
    "policies": "ok"
  }
}
```

Use this endpoint for:

- Docker health checks (`HEALTHCHECK` directive)
- Load balancer health probes
- Uptime monitoring (Gatus, UptimeRobot, etc.)

Returns HTTP `200` when healthy, `503` when unhealthy.

## Production Hardening Checklist

- [ ] **JWT_SECRET**: Generate with `openssl rand -hex 32` — at least 64 hex characters
- [ ] **ADMIN_TOKEN**: Generate with `openssl rand -hex 24` — unique, high-entropy
- [ ] **TLS**: Always terminate TLS (Nginx, Caddy, or cloud load balancer)
- [ ] **Firewall**: Only expose ports 80/443; block direct access to port 3000
- [ ] **Admin access**: Restrict `/admin` endpoints to internal IPs (see Nginx config above)
- [ ] **CORS**: Set `CORS_ORIGIN` to your specific domains, not `*`
- [ ] **Rate limiting**: Configure `RATE_LIMIT_RPM` appropriate for your traffic
- [ ] **Log level**: Set to `warn` or `error` in production to reduce noise
- [ ] **Secrets in env**: Never commit `.env` files — use Docker secrets or a vault
- [ ] **Volumes**: Mount `/data` as a named Docker volume for persistence
- [ ] **Backups**: Schedule daily backups of the SQLite database
- [ ] **Updates**: Pin image tags (`ghcr.io/meshguard/meshguard:0.1.0`) and update deliberately
- [ ] **Monitoring**: Set up health check alerting (see below)

## Monitoring

### With Gatus

Add to your `gatus-config.yaml`:

```yaml
endpoints:
  - name: MeshGuard Gateway
    url: https://meshguard.yourcompany.com/health
    interval: 30s
    conditions:
      - "[STATUS] == 200"
      - "[BODY].status == healthy"
    alerts:
      - type: slack
        send-on-resolved: true
```

### With UptimeRobot

1. Add a new HTTP(s) monitor
2. URL: `https://meshguard.yourcompany.com/health`
3. Monitoring interval: 5 minutes
4. Alert contacts: your ops team

### With Prometheus

MeshGuard exposes metrics at `/metrics` (when `METRICS_ENABLED=true`):

```yaml
# prometheus.yml
scrape_configs:
  - job_name: meshguard
    static_configs:
      - targets: ["meshguard:3000"]
    metrics_path: /metrics
    scrape_interval: 15s
```

Key metrics:

- `meshguard_policy_checks_total` — Total policy evaluations (labels: `decision`, `action`)
- `meshguard_request_duration_seconds` — Request latency histogram
- `meshguard_active_agents` — Currently registered agents
- `meshguard_audit_entries_total` — Total audit log entries

## Backup and Restore

### Backup

The SQLite database is a single file. Back it up with:

```bash
# Using SQLite's built-in backup (safe during writes)
sqlite3 /data/meshguard.db ".backup /backups/meshguard-$(date +%Y%m%d).db"

# Or copy the file (stop the container first for consistency)
docker compose stop meshguard
cp /data/meshguard.db /backups/meshguard-$(date +%Y%m%d).db
docker compose start meshguard
```

### Automated Daily Backup (cron)

```bash
# /etc/cron.d/meshguard-backup
0 2 * * * root sqlite3 /var/lib/meshguard/meshguard.db ".backup /backups/meshguard-$(date +\%Y\%m\%d).db" && find /backups -name "meshguard-*.db" -mtime +30 -delete
```

This backs up nightly at 2 AM and retains 30 days of backups.

### Backup Policies

Policy YAML files should be version-controlled in Git. If you mount them read-only (`:ro`), the source of truth is your Git repo:

```bash
git clone https://github.com/yourorg/meshguard-policies.git ./policies
```

### Restore

```bash
# Stop the gateway
docker compose stop meshguard

# Replace the database
cp /backups/meshguard-20260125.db /data/meshguard.db

# Restart
docker compose start meshguard
```

### Restore Policies

```bash
# Re-apply all policies from your Git repo
meshguard policy apply ./policies/
```

## Upgrading

```bash
# Pull latest image
docker compose pull

# Restart with new version
docker compose up -d

# Verify health
curl https://meshguard.yourcompany.com/health
```

Database migrations run automatically on startup. Always back up before upgrading.

## Related

- [Getting Started](/guide/getting-started) — Initial setup and first agent
- [Policies](/guide/policies) — Policy format and management
- [Enterprise](/guide/enterprise) — Enterprise features and support
- [Billing & Subscriptions](/guide/billing) — Plans and pricing
- [Gateway Endpoints](/api/gateway) — API reference for the gateway
- [Admin Endpoints](/api/admin) — API reference for admin operations
