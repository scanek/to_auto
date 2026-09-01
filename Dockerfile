# ==========================================
# Fast & Hardened Python FastAPI + Static Build
# Frontend is pre-compiled in backend/static (instant ~3s build)
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

# Create non-root system user for security
RUN groupadd -r appuser && useradd -r -u 1001 -g appuser -d /app appuser

# Install Python dependencies (cached layer)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend app & Pre-compiled production frontend
COPY backend/app ./app
COPY backend/static ./static

# Create data & uploads volumes directory and assign permissions to appuser
RUN mkdir -p /app/data/uploads && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

EXPOSE 8000

# Docker Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

VOLUME ["/app/data"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
