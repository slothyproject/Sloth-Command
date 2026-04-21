FROM python:3.12-slim

# Install git temporarily to extract commit SHA
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

# Create app directory and extract commit SHA from git before COPY excludes .git
WORKDIR /app
COPY .git .git 2>/dev/null || true
RUN git rev-parse --short HEAD > /tmp/commit.txt 2>/dev/null || echo "unknown" > /tmp/commit.txt
RUN rm -rf .git && apt-get purge -y git && apt-get autoremove -y

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_ENV=production \
    PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/logs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["gunicorn", \
     "--bind", "0.0.0.0:8080", \
     "--workers", "2", \
     "--worker-class", "gevent", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info", \
     "dashboard.app:app"]
