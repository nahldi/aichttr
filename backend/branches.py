"""Conversation branch metadata and message cloning helpers."""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any

_CHANNEL_NAME_RE = re.compile(r"^[a-z0-9](?:[a-z0-9_-]{0,19})$")


class BranchManager:
    """Stores branch metadata and supports per-channel branch queries."""

    def __init__(self, data_dir: Path):
        self._data_dir = data_dir
        self._path = data_dir / "branches.json"
        self._branches: list[dict[str, Any]] = []
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            payload = json.loads(self._path.read_text("utf-8"))
        except (json.JSONDecodeError, OSError):
            return
        if isinstance(payload, dict) and isinstance(payload.get("branches"), list):
            self._branches = [item for item in payload["branches"] if isinstance(item, dict)]

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps({"branches": self._branches}, indent=2), encoding="utf-8")

    def list_branches(self, parent_channel: str) -> list[dict[str, Any]]:
        branches = [dict(branch) for branch in self._branches if branch.get("parent_channel") == parent_channel]
        branches.sort(key=lambda branch: float(branch.get("created_at", 0) or 0), reverse=True)
        return branches

    def get_branch(self, branch_id: str) -> dict[str, Any] | None:
        for branch in self._branches:
            if branch.get("id") == branch_id:
                return dict(branch)
        return None

    def channel_exists(self, channel: str) -> bool:
        return any(branch.get("id") == channel for branch in self._branches)

    def create_branch(self, *, branch_id: str, name: str, parent_channel: str, fork_message_id: int, fork_message_text: str) -> dict[str, Any]:
        branch = {
            "id": branch_id,
            "name": name,
            "parent_channel": parent_channel,
            "fork_message_id": fork_message_id,
            "fork_message_text": fork_message_text[:200],
            "message_count": 0,
            "created_at": time.time(),
            "last_activity": 0.0,
        }
        self._branches.append(branch)
        self._save()
        return dict(branch)

    def update_branch_stats(self, branch_id: str, *, message_count: int, last_activity: float) -> dict[str, Any] | None:
        for branch in self._branches:
            if branch.get("id") != branch_id:
                continue
            branch["message_count"] = message_count
            branch["last_activity"] = last_activity
            self._save()
            return dict(branch)
        return None

    def delete_branch(self, branch_id: str) -> dict[str, Any] | None:
        for idx, branch in enumerate(self._branches):
            if branch.get("id") == branch_id:
                removed = dict(self._branches.pop(idx))
                self._save()
                return removed
        return None

    @staticmethod
    def normalize_name(name: object) -> str:
        return " ".join(str(name or "").strip().split())[:80]

    @staticmethod
    def make_channel_id(name: str) -> str:
        cleaned = re.sub(r"[^a-z0-9_-]+", "-", name.strip().lower())
        cleaned = re.sub(r"-{2,}", "-", cleaned).strip("-")
        if not cleaned:
            cleaned = "branch"
        return cleaned[:20]

    @staticmethod
    def is_valid_channel(channel: str) -> bool:
        return bool(_CHANNEL_NAME_RE.fullmatch(channel))
