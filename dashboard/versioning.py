"""Runtime version helpers for Central Hub dashboard."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path


_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_BASE = "1.0.0"


def get_dashboard_commit() -> str:
    for env_key in ("RAILWAY_GIT_COMMIT_SHA", "GIT_COMMIT", "SOURCE_COMMIT"):
        value = (os.environ.get(env_key) or "").strip()
        if value:
            return value[:7]

    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            cwd=_ROOT,
            check=False,
        )
        commit = (result.stdout or "").strip()
        if commit:
            return commit
    except Exception:
        pass

    return "unknown"


def get_dashboard_version() -> str:
    base = (os.environ.get("HUB_VERSION") or os.environ.get("APP_VERSION") or "").strip()
    if not base:
        base = _DEFAULT_BASE

    commit = get_dashboard_commit()
    if commit == "unknown" or "+" in base:
        return base
    return f"{base}+{commit}"
