#!/bin/bash
# Kill anything on our ports from previous runs
fuser -k 5000/tcp 2>/dev/null || true
fuser -k 3001/tcp 2>/dev/null || true
sleep 1

# Start server in background
pnpm --filter server dev &
SERVER_PID=$!

# Start client dev server
pnpm --filter client dev

wait $SERVER_PID
