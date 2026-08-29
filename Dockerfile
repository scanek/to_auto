# ==========================================
# Stage 1: Build Frontend (React + Vite + TS)
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /build

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Python FastAPI Backend + Static
# ==========================================
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/app/data \
    UPLOAD_DIR=/app/data/uploads

WORKDIR /app

# Install system dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend app
COPY backend/app ./app

# Copy Built Frontend to static directory served by FastAPI
COPY --from=frontend-builder /build/dist ./static

# Create data & uploads volumes directory
RUN mkdir -p /app/data/uploads

EXPOSE 8000

VOLUME ["/app/data"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
