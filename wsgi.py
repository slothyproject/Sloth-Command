"""
WSGI entry point — composes the Sloth Command Dashboard and the
Dissident bot panel into a single deployable application.

Routes:
  /          → Sloth Lee homepage + Sloth Command dashboard (/app/*)
  /bot/*     → Dissident bot web panel (login, API, Discord OAuth)
"""
from __future__ import annotations

import os
import sys

# Add dissident_panel to sys.path so its bare `from user_auth import ...`
# style imports resolve correctly.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "dissident_panel"))

from werkzeug.middleware.dispatcher import DispatcherMiddleware

from dashboard.app import create_app

# Import the dissident panel app (module-level Flask instance)
from dissident_panel.app import app as dissident_app  # noqa: E402

hub_app = create_app()

# Compose: everything under /bot goes to the dissident panel;
# everything else goes to the main hub app.
application = DispatcherMiddleware(hub_app, {"/bot": dissident_app})

# Allow `gunicorn wsgi:application` to work, and also
# `python wsgi.py` for local debugging with the hub app only.
if __name__ == "__main__":
    hub_app.run(debug=True, port=int(os.environ.get("PORT", 8080)))
