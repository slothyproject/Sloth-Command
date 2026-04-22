web: gunicorn --bind 0.0.0.0:8080 --workers 2 --worker-class gevent --timeout 120 dashboard.app:app
worker: python -m worker.scheduler
