# MeshGuard Quickstart

Get running in 2 minutes.

## 1. Install & Run

```bash
# Clone
git clone https://github.com/dbhurley/meshguard.git
cd meshguard

# Install Bun (if needed)
curl -fsSL https://bun.sh/install | bash

# Install deps
bun install

# Create data dir
mkdir -p data

# Start gateway
bun run src/index.ts
```

## 2. Create an Agent

In a new terminal:

```bash
cd meshguard

# Create agent and save the token
bun run src/cli/index.ts agent create demo --trust verified
```

Copy the token that's printed.

## 3. Make Requests

```bash
# Set your token
export TOKEN="eyJhbG..."

# This should succeed (read allowed)
curl http://localhost:3100/proxy/get -H "Authorization: Bearer $TOKEN"

# This should fail 403 (delete denied)
curl -X DELETE http://localhost:3100/proxy/anything -H "Authorization: Bearer $TOKEN"
```

## 4. Check Audit

```bash
bun run src/cli/index.ts audit tail
```

## Done!

See [GETTING_STARTED.md](./GETTING_STARTED.md) for full documentation.
