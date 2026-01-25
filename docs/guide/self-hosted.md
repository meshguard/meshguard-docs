# Self-Hosted Deployment

Run MeshGuard on your own infrastructure.

## Requirements

- **Bun** v1.1+ or Node.js v18+
- SQLite (included)

## Installation

```bash
git clone https://github.com/dbhurley/meshguard
cd meshguard
bun install
```

## Configuration

Create `.env`:

```bash
PORT=3100
HOST=0.0.0.0
MODE=enforce

JWT_SECRET=your-secret-min-32-characters
JWT_EXPIRES_IN=24h
ADMIN_TOKEN=your-admin-token

POLICIES_DIR=./policies
AUDIT_DB_PATH=./data/audit.db
PROXY_TARGET=https://your-backend.com
```

## Running

```bash
# Create data directory
mkdir -p data

# Start gateway
bun run src/index.ts
```

## Production Checklist

- [ ] Set strong `JWT_SECRET` (min 32 chars)
- [ ] Set unique `ADMIN_TOKEN`
- [ ] Configure `PROXY_TARGET` for your backend
- [ ] Set up TLS/HTTPS (use reverse proxy like nginx)
- [ ] Configure log rotation for audit database
- [ ] Set up monitoring/alerting
