#!/bin/sh
set -e

# Ensure permissions on persistent volume data directory
mkdir -p /app/data/uploads
chmod -R 777 /app/data 2>/dev/null || true

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
