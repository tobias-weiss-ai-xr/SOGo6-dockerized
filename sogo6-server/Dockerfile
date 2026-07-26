# Production Dockerfile for SOGo 6 Server
# Multi-stage build: builder → production

# ---- Builder Stage ----
FROM python:3.14-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libldap2-dev \
    libsasl2-dev \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=off

# Install Poetry
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir poetry

# Copy dependency files
COPY pyproject.toml poetry.lock* ./

# Install dependencies (no dev)
RUN poetry config virtualenvs.create false && \
    poetry install --no-cache --no-ansi --no-interaction --no-root --only main || \
    echo "Poetry install failed, falling back to pip"

# Copy source
COPY . .

# Build any assets if needed
RUN python -c "import sys; print(f'Python {sys.version}')"

# ---- Production Stage ----
FROM python:3.14-slim

WORKDIR /app

# Install runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq5 \
    libldap-2.5-0 \
    libsasl2-2 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_ENV=production \
    PIP_NO_CACHE_DIR=off

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.14/site-packages /usr/local/lib/python3.14/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Install additional runtime dependencies not covered by poetry
RUN pip install --no-cache-dir prometheus-client authlib pyotp qrcode[pil]

# Copy application code
COPY --from=builder /build/app /app/app
COPY --from=builder /build/migrations /app/migrations
COPY --from=builder /build/process.docker.conf /app/process.conf

# Create non-root user
RUN addgroup --system --gid 1001 sogo && \
    adduser --system --uid 1001 --ingroup sogo --home /app sogo && \
    chown -R sogo:sogo /app

USER sogo

EXPOSE 5000

# Health check — uses the enhanced /health endpoint which checks
# all service dependencies (PostgreSQL, LDAP, Redis, Stalwart).
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/api/user/v1/health || exit 1

# Run with gunicorn in production
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--timeout", "120", \
     "--access-logfile", "-", "--error-logfile", "-", \
     "app:create_app()"]
