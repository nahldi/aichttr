"""Agent registry — tracks connected agent instances."""

from __future__ import annotations

import time
import secrets
from dataclasses import dataclass, field, asdict


@dataclass
class AgentInstance:
    name: str
    base: str
    label: str
    color: str
    slot: int = 1
    state: str = "pending"
    token: str = field(default_factory=lambda: secrets.token_hex(16))
    registered_at: float = field(default_factory=time.time)
    role: str = ""
    # Hierarchy fields
    hierarchy_role: str = "peer"  # "manager" | "worker" | "peer"
    parent: str = ""
    # Activity tracking
    messages_sent: int = 0
    last_active: float = 0.0
    last_heartbeat: float = 0.0

    @property
    def uptime(self) -> float:
        """Seconds since registration."""
        return time.time() - self.registered_at

    def record_message(self):
        """Track that this agent sent a message."""
        self.messages_sent += 1
        self.last_active = time.time()

    def record_heartbeat(self):
        """Track a heartbeat from this agent."""
        self.last_heartbeat = time.time()
        if not self.last_active:
            self.last_active = self.last_heartbeat

    def health_dict(self) -> dict:
        """Return health/status summary for this agent."""
        now = time.time()
        hb_ago = now - self.last_heartbeat if self.last_heartbeat else None
        active_ago = now - self.last_active if self.last_active else None
        return {
            "name": self.name,
            "state": self.state,
            "uptime_seconds": round(self.uptime, 1),
            "messages_sent": self.messages_sent,
            "last_heartbeat_ago": round(hb_ago, 1) if hb_ago is not None else None,
            "last_active_ago": round(active_ago, 1) if active_ago is not None else None,
            "healthy": self.state in ("active", "thinking") and (hb_ago is not None and hb_ago < 30),
        }

    def to_dict(self) -> dict:
        d = asdict(self)
        d["uptime_seconds"] = round(self.uptime, 1)
        return d

    def public_dict(self) -> dict:
        d = self.to_dict()
        d.pop("token", None)
        return d


# Default color palette per agent base name
_COLORS = {
    "claude": "#e8734a",
    "codex": "#10a37f",
    "gemini": "#4285f4",
    "qwen": "#ffb784",
    "grok": "#ff84a2",
    "copilot": "#84ffa2",
}


class AgentRegistry:
    def __init__(self):
        self._instances: dict[str, AgentInstance] = {}
        self._slot_counters: dict[str, int] = {}

    def register(self, base: str, label: str = "", color: str = "") -> AgentInstance:
        if not label:
            label = base.capitalize()
        if not color:
            color = _COLORS.get(base, "#d2bbff")

        slot = self._slot_counters.get(base, 0) + 1
        self._slot_counters[base] = slot

        name = base if slot == 1 else f"{base}-{slot}"
        if slot == 2 and base in self._instances:
            old = self._instances.pop(base)
            old.name = f"{base}-1"
            old.slot = 1
            self._instances[old.name] = old

        inst = AgentInstance(
            name=name, base=base, label=label, color=color, slot=slot, state="active"
        )
        self._instances[name] = inst
        return inst

    def deregister(self, name: str) -> bool:
        return self._instances.pop(name, None) is not None

    def get(self, name: str) -> AgentInstance | None:
        return self._instances.get(name)

    def get_all(self) -> list[AgentInstance]:
        return list(self._instances.values())

    def get_public_list(self) -> list[dict]:
        return [inst.public_dict() for inst in self._instances.values()]

    def set_state(self, name: str, state: str):
        inst = self._instances.get(name)
        if inst:
            inst.state = state

    def get_children(self, parent_name: str) -> list[AgentInstance]:
        """Get all agents whose parent is *parent_name*."""
        return [inst for inst in self._instances.values() if inst.parent == parent_name]

    def resolve_token(self, token: str) -> AgentInstance | None:
        for inst in self._instances.values():
            if inst.token == token:
                return inst
        return None
