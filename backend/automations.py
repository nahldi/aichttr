"""Webhook-driven automations — trigger agent actions from external events.

Supports:
- GitHub webhooks (PR opened, CI failed, push, issue)
- Slack webhooks (message, reaction)
- Generic webhooks (custom payloads)

Automations are rules that match incoming webhook events to agent actions.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)


class AutomationRule:
    """A rule that maps a webhook event to an agent action."""

    def __init__(self, data: dict):
        self.id: str = data.get("id", "")
        self.name: str = data.get("name", "Unnamed")
        self.enabled: bool = data.get("enabled", True)
        self.source: str = data.get("source", "generic")  # github, slack, generic
        self.event_type: str = data.get("event_type", "*")  # e.g., pull_request, push, *
        self.filter: dict = data.get("filter", {})  # optional field matching
        self.action: str = data.get("action", "message")  # message, spawn, delegate
        self.agent: str = data.get("agent", "")  # target agent for delegate/spawn
        self.channel: str = data.get("channel", "general")
        self.template: str = data.get("template", "")  # message template with {event} placeholders
        self.created_at: float = data.get("created_at", time.time())

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "enabled": self.enabled,
            "source": self.source,
            "event_type": self.event_type,
            "filter": self.filter,
            "action": self.action,
            "agent": self.agent,
            "channel": self.channel,
            "template": self.template,
            "created_at": self.created_at,
        }

    def matches(self, source: str, event_type: str, payload: dict) -> bool:
        """Check if this rule matches an incoming webhook event."""
        if not self.enabled:
            return False
        if self.source != "*" and self.source != source:
            return False
        if self.event_type != "*" and self.event_type != event_type:
            return False
        # Check optional field filters
        for key, value in self.filter.items():
            actual = _get_nested(payload, key)
            if actual is None or str(actual) != str(value):
                return False
        return True

    def format_message(self, payload: dict, event_type: str) -> str:
        """Format the action message using the template and payload data."""
        if self.template:
            try:
                return self.template.format(
                    event=event_type,
                    **{k: v for k, v in _flatten(payload).items() if isinstance(v, (str, int, float, bool))},
                )
            except (KeyError, IndexError):
                pass
        # Default message based on source
        return _default_message(self.source, event_type, payload)


class AutomationManager:
    """Manages automation rules and processes incoming webhooks."""

    def __init__(self, data_dir: Path):
        self._data_dir = data_dir
        self._config_path = data_dir / "automations.json"
        self._rules: list[AutomationRule] = []
        self._secrets: dict[str, str] = {}  # source → webhook secret for signature verification
        self._load()

    def _load(self):
        if self._config_path.exists():
            try:
                data = json.loads(self._config_path.read_text())
                self._rules = [AutomationRule(r) for r in data.get("rules", [])]
                self._secrets = data.get("secrets", {})
            except Exception as e:
                log.warning("Failed to load automations: %s", e)

    def _save(self):
        data = {
            "rules": [r.to_dict() for r in self._rules],
            "secrets": self._secrets,
        }
        self._config_path.write_text(json.dumps(data, indent=2))

    def list_rules(self) -> list[dict]:
        return [r.to_dict() for r in self._rules]

    def add_rule(self, rule_data: dict) -> dict:
        import uuid
        rule_data["id"] = rule_data.get("id", f"auto-{uuid.uuid4().hex[:8]}")
        rule_data["created_at"] = time.time()
        rule = AutomationRule(rule_data)
        self._rules.append(rule)
        self._save()
        return rule.to_dict()

    def update_rule(self, rule_id: str, updates: dict) -> dict | None:
        for rule in self._rules:
            if rule.id == rule_id:
                for key, value in updates.items():
                    if hasattr(rule, key) and key != "id":
                        setattr(rule, key, value)
                self._save()
                return rule.to_dict()
        return None

    def delete_rule(self, rule_id: str) -> bool:
        before = len(self._rules)
        self._rules = [r for r in self._rules if r.id != rule_id]
        if len(self._rules) < before:
            self._save()
            return True
        return False

    def set_secret(self, source: str, secret: str):
        """Set the webhook signing secret for a source (for signature verification)."""
        self._secrets[source] = secret
        self._save()

    def verify_signature(self, source: str, payload_body: bytes, signature: str) -> bool:
        """Verify a webhook signature using HMAC-SHA256."""
        secret = self._secrets.get(source)
        if not secret:
            return True  # No secret configured — allow
        expected = "sha256=" + hmac.new(
            secret.encode(), payload_body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    def process_webhook(self, source: str, event_type: str, payload: dict) -> list[dict]:
        """Process an incoming webhook and return matched actions."""
        actions = []
        for rule in self._rules:
            if rule.matches(source, event_type, payload):
                message = rule.format_message(payload, event_type)
                actions.append({
                    "rule_id": rule.id,
                    "rule_name": rule.name,
                    "action": rule.action,
                    "agent": rule.agent,
                    "channel": rule.channel,
                    "message": message,
                })
        return actions


# ── Helpers ────────────────────────────────────────────────────────

def _get_nested(d: dict, key: str) -> Any:
    """Get a nested value from a dict using dot notation (e.g., 'pull_request.title')."""
    parts = key.split(".")
    current = d
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def _flatten(d: dict, prefix: str = "") -> dict:
    """Flatten a nested dict for template formatting."""
    items = {}
    for k, v in d.items():
        key = f"{prefix}{k}" if not prefix else f"{prefix}_{k}"
        if isinstance(v, dict):
            items.update(_flatten(v, key))
        elif isinstance(v, (str, int, float, bool)):
            items[key] = v
    return items


def _default_message(source: str, event_type: str, payload: dict) -> str:
    """Generate a default message for common webhook events."""
    if source == "github":
        if event_type == "pull_request":
            pr = payload.get("pull_request", {})
            action = payload.get("action", "")
            return (
                f"GitHub PR #{pr.get('number', '?')} {action}: "
                f"**{pr.get('title', 'Untitled')}** by {pr.get('user', {}).get('login', '?')}"
            )
        elif event_type == "push":
            commits = payload.get("commits", [])
            ref = payload.get("ref", "").replace("refs/heads/", "")
            return f"GitHub push to `{ref}`: {len(commits)} commit(s)"
        elif event_type in ("check_run", "check_suite"):
            conclusion = payload.get(event_type.replace("_", ""), {}).get("conclusion", "")
            if conclusion == "failure":
                return f"GitHub CI **failed** — {payload.get(event_type.replace('_', ''), {}).get('name', 'check')}"
            return f"GitHub CI {conclusion}"
        elif event_type == "issues":
            issue = payload.get("issue", {})
            return f"GitHub issue #{issue.get('number', '?')}: **{issue.get('title', '')}**"
    elif source == "slack":
        text = payload.get("event", {}).get("text", payload.get("text", ""))
        user = payload.get("event", {}).get("user", "someone")
        return f"Slack message from {user}: {text[:200]}"

    # Generic fallback
    return f"[{source}] {event_type}: {json.dumps(payload)[:300]}"
