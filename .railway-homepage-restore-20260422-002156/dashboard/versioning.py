"""Runtime version helpers for dashboard and API surfaces.

Provides a stable semantic base version plus optional build metadata
derived from deployment commit SHA so versioning updates automatically
on each deploy.

Mirrors bot/runtime_version.py pattern for consistency.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path


_ROOT = Path(__file__).resolve().parents[1]
_VERSION_JSON = _ROOT / "VERSION.json"
_VERSION_TEXT = _ROOT / "VERSION"
_SHA_RE = re.compile(r"^[0-9a-fA-F]{7,40}$")


def _normalize_commit(value: str) -> str:
    commit = (value or "").strip()
    if not commit:
        return ""
    commit = commit.split()[0].strip()
    if _SHA_RE.fullmatch(commit):
        return commit[:7].lower()
    return ""


def _base_version() -> str:
    """Read base version from VERSION.json or VERSION file."""
    if _VERSION_JSON.exists():
        try:
            data = json.loads(_VERSION_JSON.read_text(encoding="utf-8"))
            version = str(data.get("version", "")).strip()
            if version:
                return version
        except Exception:
            pass

    if _VERSION_TEXT.exists():
        try:
            version = _VERSION_TEXT.read_text(encoding="utf-8").strip()
            if version:
                return version
        except Exception:
            pass

    return "0.0.0"


def get_dashboard_commit() -> str:
    """Get commit SHA from env, file, or git (in order of preference)."""
    # Try environment variables first
    for env_key in ("RAILWAY_GIT_COMMIT_SHA", "GIT_COMMIT", "SOURCE_COMMIT"):
        commit = _normalize_commit(os.environ.get(env_key) or "")
        if commit:
            return commit

    # Try reading from commit files (created by Dockerfile at build time)
    try:
        for commit_path in ("/tmp/commit.txt", "/app/commit.txt", "commit.txt"):
            commit_file = Path(commit_path)
            if commit_file.exists():
                commit = _normalize_commit(commit_file.read_text(encoding="utf-8"))
                if commit:
                    return commit
    except Exception:
        pass

    # Try git subprocess as fallback
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=_ROOT,
            capture_output=True,
            text=True,
            timeout=2,
        )
        if result.returncode == 0:
            commit = _normalize_commit(result.stdout or "")
            if commit:
                return commit
    except Exception:
        pass

    return "unknown"


def get_dashboard_version() -> str:
    """Return version in format '{base_version}+{commit_sha}'.
    
    Returns:
        str: Semantic version with optional build metadata.
             Examples: "1.0.0+a1b2c3d", "1.0.0" (if already has +)
    """
    base = (
        os.environ.get("HUB_VERSION")
        or os.environ.get("APP_VERSION")
        or ""
    ).strip() or _base_version()
    commit = get_dashboard_commit()

    # If already has metadata or no commit, return as-is
    if commit == "unknown" or "+" in base:
        return base

    return f"{base}+{commit}"
