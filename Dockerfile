# ==========================================
# Step 1: Build Production Frontend (Vite)
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Cache npm dependencies
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --prefer-offline --no-audit || npm install

# Copy frontend source and compile static bundle
COPY frontend/ ./
RUN npm run build

# ==========================================
# Step 2: Production Python FastAPI Image
# ==========================================
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/app/data \
    UPLOAD_DIR=/app/data/uploads

WORKDIR /app

# Install system dependencies (curl for container healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python backend dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend app
COPY backend/app ./app

# Copy compiled frontend from Step 1 into /app/static
COPY --from=frontend-builder /frontend/dist ./static

# Ensure upload directory exists
RUN mkdir -p /app/data/uploads

EXPOSE 8000

# Container Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

VOLUME ["/app/data"]

CMD ["/bin/sh", "-c", "mkdir -p /app/data/uploads && chmod -R 777 /app/data 2>/dev/null || true; exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
