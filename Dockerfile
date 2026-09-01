# ==========================================
# Fast & Robust Python FastAPI + Static Build
# ==========================================
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/app/data \
    UPLOAD_DIR=/app/data/uploads

WORKDIR /app

# Install system dependencies (curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend app & Pre-compiled production frontend
COPY backend/app ./app
COPY backend/static ./static
COPY backend/entrypoint.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh && mkdir -p /app/data/uploads

EXPOSE 8000

# Docker Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

VOLUME ["/app/data"]

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
