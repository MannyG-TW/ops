#!/bin/bash
echo "Starting TravelWifi Ops on port 5000..."
lsof -ti:5000 2>/dev/null | xargs kill -9 2>/dev/null
rm -rf .next
PORT=5000 npm run dev &
echo "Dev server starting at http://localhost:5000"
