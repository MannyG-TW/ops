#!/bin/bash
cd "$(dirname "$0")/.." || exit 1
echo "Starting TravelWifi Ops on port 5000..."

# Kill anything on port 5000
lsof -ti:5000 2>/dev/null | xargs kill -9 2>/dev/null

# Clear all caches
rm -rf .next
rm -rf node_modules/.cache

# Start dev server on port 5000
PORT=5000 npx next dev --port 5000 &
disown

echo "Dev server starting at http://localhost:5000 (PID $!)"
