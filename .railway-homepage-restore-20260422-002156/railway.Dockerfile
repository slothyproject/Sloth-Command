# Multi-stage build for Dissident Web Dashboard
# Builds: Astro Homepage + Flask App
# NOTE: Railway builds from repo root, paths use dissident/ prefix

# Stage 1: Build Astro Homepage
FROM node:22-alpine AS homepage-builder
WORKDIR /app/homepage
COPY dissident/homepage/package*.json ./
RUN npm install
COPY dissident/homepage/ ./
RUN npm run build

# Stage 2: Production Flask App
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY dissident/requirements.railway.txt requirements.txt
COPY dissident/web_panel/requirements.txt web_panel/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt -r web_panel/requirements.txt

COPY dissident/ .

COPY --from=homepage-builder /app/homepage/dist ./web_panel/static/homepage

RUN mkdir -p /app/logs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--worker-class", "gevent", "--timeout", "120", "web_panel.app:app"]
