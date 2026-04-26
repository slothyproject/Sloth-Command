"""
Docs API — serves wiki content as JSON for the docs.slothlee.xyz frontend.

Content sources (in precedence order):
  1. docs/wiki/         — hand-written documentation
  2. docs/generated/    — auto-generated command reference
  3. docs/deployment.md — deployment guide
  4. docs/architecture.md — architecture overview
  5. docs/dashboard-roadmap.md — product roadmap

All Markdown files are loaded at startup and refreshed on every 30s.
"""
from __future__ import annotations

import fnmatch
import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path

from flask import Blueprint, jsonify, request
from flask_login import login_required
from markupsafe import Markup

# Try to import frontmatter for YAML metadata extraction
try:
    import yaml
except ImportError:
    yaml = None


docs_bp = Blueprint("docs", __name__)

_REPO_ROOT = Path(__file__).resolve().parents[3]
_CONTENT_DIRS = [_REPO_ROOT / d for d in ("docs/wiki", "docs/generated")]
_STATIC_DOCS = [
    _REPO_ROOT / "docs" / f
    for f in ("deployment.md", "architecture.md", "dashboard-roadmap.md")
]

# ── In-memory index ──────────────────────────────────────────────────


@dataclass
class DocPage:
    slug: str
    category: str
    title: str
    description: str
    content: str
    order: int = 999
    tags: list[str] = field(default_factory=list)
    generated: bool = False
    last_modified: float = 0.0


class DocIndex:
    """In-memory search index for documentation pages."""

    def __init__(self) -> None:
        self._pages: dict[str, DocPage] = {}
        self._last_refresh: float = 0.0
        self._refresh_interval: float = 30.0
        self._load_all()

    def _load_all(self) -> None:
        self._pages.clear()
        # Static docs first
        for path in _STATIC_DOCS:
            if path.exists():
                self._ingest(path, category="reference")
        # Wiki dirs
        for dir_path in _CONTENT_DIRS:
            if not dir_path.exists():
                continue
            for path in sorted(dir_path.rglob("*.md")):
                category = str(path.relative_to(dir_path).parent).replace("\\", "/") or "general"
                self._ingest(path, category=category)
        self._last_refresh = time.time()

    def _ingest(self, path: Path, category: str) -> None:
        text = path.read_text(encoding="utf-8")
        slug = path.stem
        # Try to parse frontmatter
        front = {}
        content = text
        if text.startswith("---"):
            parts = text.split("---", 2)
            if len(parts) >= 3 and yaml:
                try:
                    front = yaml.safe_load(parts[1]) or {}
                    content = parts[2].strip()
                except Exception:
                    pass
        title = front.get("title") or self._extract_title(content) or slug.replace("-", " ").title()
        description = front.get("description") or self._extract_description(content)
        order = front.get("order", 999)
        tags = front.get("tags", [])
        page = DocPage(
            slug=slug,
            category=category,
            title=title,
            description=description,
            content=content,
            order=order,
            tags=tags,
            generated="generated" in str(path),
            last_modified=path.stat().st_mtime,
        )
        key = f"{category}/{slug}"
        self._pages[key] = page

    @staticmethod
    def _extract_title(text: str) -> str | None:
        m = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
        return m.group(1).strip() if m else None

    @staticmethod
    def _extract_description(text: str) -> str:
        # First non-empty non-heading line
        for line in text.splitlines():
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and not stripped.startswith("---"):
                return stripped[:200]
        return ""

    def _maybe_refresh(self) -> None:
        if time.time() - self._last_refresh > self._refresh_interval:
            self._load_all()

    def all(self) -> list[dict]:
        self._maybe_refresh()
        return [
            {
                "slug": p.slug,
                "category": p.category,
                "title": p.title,
                "description": p.description,
                "order": p.order,
                "tags": p.tags,
                "generated": p.generated,
            }
            for p in sorted(self._pages.values(), key=lambda x: (x.category, x.order, x.title))
        ]

    def get(self, category: str, slug: str) -> DocPage | None:
        self._maybe_refresh()
        return self._pages.get(f"{category}/{slug}")

    def search(self, query: str) -> list[dict]:
        self._maybe_refresh()
        query = query.lower().strip()
        if not query:
            return []
        results = []
        q_words = query.split()
        for key, page in self._pages.items():
            haystack = f"{page.title} {page.description} {page.content} { ' '.join(page.tags)}".lower()
            score = haystack.count(query)
            # Word-level bonus
            for w in q_words:
                score += haystack.count(w)
            if page.title.lower().startswith(query):
                score += 10
            if score > 0:
                results.append((score, {
                    "slug": page.slug,
                    "category": page.category,
                    "title": page.title,
                    "description": page.description[:200],
                }))
        results.sort(key=lambda x: x[0], reverse=True)
        return [r[1] for r in results[:20]]

    def sitemap(self) -> list[dict]:
        self._maybe_refresh()
        tree: dict[str, list[dict]] = {}
        for page in self._pages.values():
            tree.setdefault(page.category, []).append({
                "slug": page.slug,
                "title": page.title,
                "order": page.order,
            })
        return [
            {
                "category": cat,
                "pages": sorted(pages, key=lambda x: (x["order"], x["title"])),
            }
            for cat, pages in sorted(tree.items())
        ]


_index = DocIndex()

# ── Routes ───────────────────────────────────────────────────────────


@docs_bp.get("/docs/pages")
def list_pages():
    return jsonify({"pages": _index.all()})


@docs_bp.get("/docs/search")
def search_docs():
    q = request.args.get("q", "").strip()
    return jsonify({"results": _index.search(q)})


@docs_bp.get("/docs/sitemap")
def get_sitemap():
    return jsonify({"categories": _index.sitemap()})


# ── NEW: Structured commands endpoint ──────────────────────────────

_COG_EMOJIS: dict[str, str] = {
    "moderation": "🛡️",
    "tickets": "🎫",
    "welcome": "👋",
    "fun": "🎉",
    "economy": "💰",
    "music": "🎵",
    "logging": "📋",
    "automod": "🤖",
    "leveling": "⭐",
    "utility": "🔧",
    "skill_factory_bridge": "🔨",
}


def _parse_command_markdown(path: Path) -> list[dict]:
    """Parse a generated command markdown file into structured data."""
    text = path.read_text(encoding="utf-8")
    commands: list[dict] = []
    in_table = False
    for line in text.splitlines():
        stripped = line.strip()
        # Table data row
        if in_table and stripped.startswith("|`"):
            parts = stripped.split("|")
            if len(parts) >= 4:
                raw_cmd = parts[1].strip().strip("` !")
                args_raw = parts[2].strip()
                perms_raw = parts[3].strip()
                desc = parts[4].strip() if len(parts) > 4 else ""
                commands.append({
                    "name": raw_cmd,
                    "args": args_raw,
                    "permissions": perms_raw,
                    "description": desc,
                    "example": "",
                })
            continue
        if in_table and not stripped.startswith("|"):
            in_table = False
        if stripped.startswith("|`!"):
            in_table = True
            continue
        if stripped.startswith("|---"):
            continue
    return commands


@docs_bp.get("/docs/commands")
def list_commands():
    cogs: list[dict] = []
    gen_dir = _REPO_ROOT / "docs" / "generated"
    for path in sorted(gen_dir.glob("commands-*.md")):
        cog_name = path.stem.replace("commands-", "")
        cmds = _parse_command_markdown(path)
        cogs.append({
            "name": cog_name,
            "emoji": _COG_EMOJIS.get(cog_name, "🤖"),
            "command_count": len(cmds),
            "commands": cmds,
        })
    return jsonify({"cogs": cogs})


@docs_bp.get("/docs/<category>/<slug>")
def get_page(category: str, slug: str):
    page = _index.get(category, slug)
    if not page:
        return jsonify({"error": "Page not found", "slug": slug, "category": category}), 404
    return jsonify({
        "slug": page.slug,
        "category": page.category,
        "title": page.title,
        "description": page.description,
        "content": page.content,
        "tags": page.tags,
        "generated": page.generated,
        "last_modified": page.last_modified,
    })
