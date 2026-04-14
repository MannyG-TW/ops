#!/bin/bash
echo "Stopping TravelWifi Ops..."
lsof -ti:5000 2>/dev/null | xargs kill -9 2>/dev/null
rm -rf .next
echo "Stopped and cache cleared."
