#!/bin/bash
cd "$(dirname "$0")/.." || exit 1
echo "Stopping TravelWifi Ops..."

# Kill anything on port 5000
lsof -ti:5000 2>/dev/null | xargs kill -9 2>/dev/null

# Clear all caches
rm -rf .next
rm -rf node_modules/.cache

echo "Stopped and cache cleared."
