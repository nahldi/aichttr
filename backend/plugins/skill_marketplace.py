"""Skills Marketplace — browse, install, and share community skills.

Skills are stored as JSON definitions. The marketplace uses the GitHub repo
as the registry — no external hosting needed. Users can:
- Browse available skills from the built-in catalog + community
- Install/enable skills per agent
- Create custom skills via the UI
- Export skills as shareable JSON files
"""

import json
import logging
import time
from pathlib import Path

log = logging.getLogger(__name__)

# Community skills catalog — stored locally, can be refreshed from GitHub
_COMMUNITY_SKILLS: list[dict] = []
_CUSTOM_SKILLS_DIR: Path | None = None


def _load_community_skills(data_dir: Path) -> list[dict]:
    """Load community skills from local cache."""
    cache_file = data_dir / "community_skills.json"
    if cache_file.exists():
        try:
            return json.loads(cache_file.read_text("utf-8"))
        except Exception:
            pass
    return []


def _save_community_skills(data_dir: Path, skills: list[dict]):
    cache_file = data_dir / "community_skills.json"
    cache_file.write_text(json.dumps(skills, indent=2), "utf-8")


def setup(app, store=None, registry=None, mcp_bridge=None):
    """Register marketplace endpoints."""
    from fastapi import Request
    from fastapi.responses import JSONResponse

    # Determine data dir from app state
    data_dir = Path(__file__).parent.parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    custom_dir = data_dir / "custom_skills"
    custom_dir.mkdir(parents=True, exist_ok=True)

    global _CUSTOM_SKILLS_DIR
    _CUSTOM_SKILLS_DIR = custom_dir

    @app.get("/api/marketplace")
    async def browse_marketplace(category: str = "", search: str = ""):
        """Browse available community skills."""
        skills = _load_community_skills(data_dir)

        # Also include locally created custom skills
        for f in sorted(custom_dir.glob("*.json")):
            try:
                skill = json.loads(f.read_text("utf-8"))
                skill["source"] = "custom"
                skills.append(skill)
            except Exception:
                continue

        if category:
            skills = [s for s in skills if s.get("category", "").lower() == category.lower()]
        if search:
            q = search.lower()
            skills = [s for s in skills if q in s.get("name", "").lower() or q in s.get("description", "").lower()]

        return {"skills": skills, "total": len(skills)}

    @app.post("/api/marketplace/create")
    async def create_custom_skill(request: Request):
        """Create a new custom skill definition."""
        body = await request.json()
        name = (body.get("name", "") or "").strip()
        if not name:
            return JSONResponse({"error": "name required"}, 400)

        skill = {
            "id": f"custom-{name.lower().replace(' ', '-')}",
            "name": name,
            "description": (body.get("description", "") or "").strip(),
            "category": (body.get("category", "Custom") or "Custom").strip(),
            "icon": body.get("icon", "extension"),
            "builtin": False,
            "source": "custom",
            "author": (body.get("author", "") or "").strip(),
            "created_at": time.time(),
            "implementation": {
                "type": body.get("impl_type", "prompt"),  # prompt, script, mcp
                "content": (body.get("impl_content", "") or "").strip(),
            },
        }

        # Save to file
        skill_file = custom_dir / f"{skill['id']}.json"
        skill_file.write_text(json.dumps(skill, indent=2), "utf-8")

        return skill

    @app.delete("/api/marketplace/{skill_id}")
    async def delete_custom_skill(skill_id: str):
        """Delete a custom skill."""
        skill_file = custom_dir / f"{skill_id}.json"
        if skill_file.exists():
            skill_file.unlink()
            return {"ok": True}
        return JSONResponse({"error": "not found"}, 404)

    @app.get("/api/marketplace/export/{skill_id}")
    async def export_skill(skill_id: str):
        """Export a custom skill as shareable JSON."""
        skill_file = custom_dir / f"{skill_id}.json"
        if skill_file.exists():
            return json.loads(skill_file.read_text("utf-8"))
        return JSONResponse({"error": "not found"}, 404)

    @app.post("/api/marketplace/import")
    async def import_skill(request: Request):
        """Import a skill from JSON."""
        body = await request.json()
        skill_id = body.get("id", "")
        if not skill_id:
            return JSONResponse({"error": "skill must have an id"}, 400)
        skill_file = custom_dir / f"{skill_id}.json"
        skill_file.write_text(json.dumps(body, indent=2), "utf-8")
        return {"ok": True, "id": skill_id}

    log.info("Skills marketplace plugin loaded")
