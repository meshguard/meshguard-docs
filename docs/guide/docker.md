# Docker Deployment

Run MeshGuard in Docker containers.

## Quick Start

```bash
docker run -d \
  -p 3100:3100 \
  -e JWT_SECRET=your-secret-min-32-chars \
  -e ADMIN_TOKEN=your-admin-token \
  -e PROXY_TARGET=https://your-backend.com \
  -v meshguard-data:/app/data \
  ghcr.io/dbhurley/meshguard:latest
```

## Docker Compose

```yaml
version: '3.8'

services:
  meshguard:
    image: ghcr.io/dbhurley/meshguard:latest
    ports:
      - "3100:3100"
    environment:
      - PORT=3100
      - MODE=enforce
      - JWT_SECRET=${JWT_SECRET}
      - ADMIN_TOKEN=${ADMIN_TOKEN}
      - PROXY_TARGET=${PROXY_TARGET}
    volumes:
      - meshguard-data:/app/data
      - ./policies:/app/policies:ro
    restart: unless-stopped

volumes:
  meshguard-data:
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Gateway port | 3100 |
| `HOST` | Bind address | 0.0.0.0 |
| `MODE` | enforce/audit/bypass | enforce |
| `JWT_SECRET` | Token signing key | (required) |
| `ADMIN_TOKEN` | Admin API token | (required) |
| `PROXY_TARGET` | Backend URL | (required) |

## Custom Policies

Mount your policies directory:

```bash
-v ./my-policies:/app/policies:ro
```

## Health Check

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3100/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```
