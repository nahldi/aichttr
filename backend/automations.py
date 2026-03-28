"""Webhook-driven automations — trigger agent actions from external events.

Supports:
- GitHub webhooks (PR opened, CI failed, push, issue)
- Slack webhooks (message, reaction)
- Generic webhooks (custom payloads)

Automations are rules that match incoming webhook events to agent actions.
"""

from __future__ import annotations

import fnmatch
import hashlib
import hmac
import json
import logging
import secrets
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
        self._workflows: list[dict[str, Any]] = []
        self._secrets: dict[str, str] = {}  # source → webhook secret for signature verification
        self._load()

    def _load(self):
        if self._config_path.exists():
            try:
                data = json.loads(self._config_path.read_text())
                self._rules = [AutomationRule(r) for r in data.get("rules", [])]
                self._workflows = [
                    w for w in data.get("workflows", [])
                    if isinstance(w, dict)
                ]
                self._secrets = data.get("secrets", {})
            except Exception as e:
                log.warning("Failed to load automations: %s", e)

    def _save(self):
        data = {
            "rules": [r.to_dict() for r in self._rules],
            "workflows": self._workflows,
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

    # ── Workflow Automations (Phase 3) ────────────────────────────

    def list_workflows(self) -> list[dict]:
        return sorted(
            [dict(workflow) for workflow in self._workflows],
            key=lambda workflow: float(workflow.get("created_at", 0) or 0),
            reverse=True,
        )

    def add_workflow(self, workflow_data: dict) -> dict:
        workflow = {
            "id": workflow_data.get("id", f"wf_{int(time.time() * 1000)}_{secrets.token_hex(4)}"),
            "name": workflow_data.get("name", "Untitled Workflow"),
            "trigger": workflow_data.get("trigger", {}),
            "action": workflow_data.get("action", {}),
            "enabled": bool(workflow_data.get("enabled", True)),
            "created_at": float(workflow_data.get("created_at", time.time()) or time.time()),
            "updated_at": time.time(),
            "last_run": float(workflow_data.get("last_run", 0) or 0),
            "run_count": int(workflow_data.get("run_count", 0) or 0),
        }
        self._workflows.append(workflow)
        self._save()
        return dict(workflow)

    def update_workflow(self, workflow_id: str, updates: dict) -> dict | None:
        for workflow in self._workflows:
            if workflow.get("id") != workflow_id:
                continue
            for key in ("name", "trigger", "action", "enabled"):
                if key in updates:
                    workflow[key] = updates[key]
            workflow["updated_at"] = time.time()
            self._save()
            return dict(workflow)
        return None

    def delete_workflow(self, workflow_id: str) -> bool:
        before = len(self._workflows)
        self._workflows = [workflow for workflow in self._workflows if workflow.get("id") != workflow_id]
        if len(self._workflows) < before:
            self._save()
            return True
        return False

    async def process_trigger(
        self,
        trigger_type: str,
        payload: dict | None = None,
        *,
        source: str = "",
        event_type: str = "",
    ) -> list[dict]:
        payload = payload or {}
        executed: list[dict] = []
        dirty = False
        for workflow in self._workflows:
            if not workflow.get("enabled", True):
                continue
            if not self._workflow_matches(workflow, trigger_type, payload, source=source, event_type=event_type):
                continue
            await self._execute_workflow(workflow, payload, trigger_type=trigger_type, source=source, event_type=event_type)
            workflow["run_count"] = int(workflow.get("run_count", 0) or 0) + 1
            workflow["last_run"] = time.time()
            workflow["updated_at"] = workflow["last_run"]
            executed.append(dict(workflow))
            dirty = True
        if dirty:
            self._save()
        return executed

    async def process_due_schedules(self, now: float | None = None) -> list[dict]:
        from schedules import cron_matches

        now = now or time.time()
        executed: list[dict] = []
        dirty = False
        for workflow in self._workflows:
            if not workflow.get("enabled", True):
                continue
            trigger = workflow.get("trigger", {}) if isinstance(workflow.get("trigger"), dict) else {}
            if trigger.get("type") != "schedule":
                continue
            config = trigger.get("config", {}) if isinstance(trigger.get("config"), dict) else {}
            cron_expr = str(config.get("cron", "") or "").strip()
            if not cron_expr or not cron_matches(cron_expr, now):
                continue
            last_run = float(workflow.get("last_run", 0) or 0)
            if int(last_run // 60) == int(now // 60):
                continue
            await self._execute_workflow(workflow, {"cron": cron_expr, "timestamp": now}, trigger_type="schedule")
            workflow["run_count"] = int(workflow.get("run_count", 0) or 0) + 1
            workflow["last_run"] = now
            workflow["updated_at"] = now
            executed.append(dict(workflow))
            dirty = True
        if dirty:
            self._save()
        return executed

    def _workflow_matches(
        self,
        workflow: dict[str, Any],
        trigger_type: str,
        payload: dict,
        *,
        source: str = "",
        event_type: str = "",
    ) -> bool:
        trigger = workflow.get("trigger", {}) if isinstance(workflow.get("trigger"), dict) else {}
        if trigger.get("type") != trigger_type:
            return False
        config = trigger.get("config", {}) if isinstance(trigger.get("config"), dict) else {}

        if trigger_type == "event":
            expected = str(config.get("event", "") or "").strip()
            actual = str(payload.get("event", "") or event_type or "").strip()
            if expected and actual and expected != actual:
                return False
            if payload.get("sender") == "workflow" or payload.get("workflow_generated"):
                return False
            return True

        if trigger_type == "file_change":
            pattern = str(config.get("pattern", "") or "").strip()
            path = str(payload.get("path", "") or "").strip()
            if not pattern:
                return bool(path)
            return bool(path) and fnmatch.fnmatch(path, pattern)

        if trigger_type == "agent_status":
            expected_status = str(config.get("status", "") or "").strip().lower()
            expected_agent = str(config.get("agent", "") or "").strip()
            actual_status = str(payload.get("status", "") or "").strip().lower()
            actual_agent = str(payload.get("agent", "") or "").strip()
            if expected_status and expected_status != actual_status:
                return False
            if expected_agent and expected_agent != actual_agent:
                return False
            return bool(actual_status or actual_agent)

        if trigger_type == "webhook":
            expected_source = str(config.get("source", "") or "").strip()
            expected_event = str(config.get("event", "") or "").strip()
            if expected_source and expected_source != source:
                return False
            if expected_event and expected_event != event_type:
                return False
            return True

        if trigger_type == "schedule":
            expected_cron = str(config.get("cron", "") or "").strip()
            actual_cron = str(payload.get("cron", "") or "").strip()
            return bool(expected_cron and actual_cron and expected_cron == actual_cron)

        return False

    async def _execute_workflow(
        self,
        workflow: dict[str, Any],
        payload: dict,
        *,
        trigger_type: str,
        source: str = "",
        event_type: str = "",
    ) -> None:
        action = workflow.get("action", {}) if isinstance(workflow.get("action"), dict) else {}
        action_type = str(action.get("type", "") or "").strip()
        agent = str(action.get("agent", "") or "").strip()
        config = action.get("config", {}) if isinstance(action.get("config"), dict) else {}

        if action_type == "message":
            await self._run_message_action(workflow, agent, config, payload)
        elif action_type == "task":
            await self._run_task_action(workflow, agent, config, payload)
        elif action_type == "command":
            await self._run_command_action(workflow, agent, config, payload)
        elif action_type == "checkpoint":
            await self._run_checkpoint_action(workflow, agent)
        else:
            log.warning("Unsupported workflow action: %s", action_type)
            return

        from routes import agents as agent_routes

        name = str(workflow.get("name", "Workflow")).strip() or "Workflow"
        detail = f"{name} via {trigger_type}"
        if source or event_type:
            detail = f"{detail} ({source or event_type})"
        await agent_routes._record_activity("message", f"Workflow ran: {detail}")
        await agent_routes.add_replay_event(
            agent or str(payload.get("agent", "") or "system"),
            "workflow_run",
            title="Workflow ran",
            detail=name,
            surface="workflow",
            metadata={
                "workflow_id": workflow.get("id", ""),
                "trigger_type": trigger_type,
                "source": source,
                "event_type": event_type or payload.get("event", ""),
                "action_type": action_type,
            },
        )

    async def _run_message_action(self, workflow: dict[str, Any], agent: str, config: dict, payload: dict) -> None:
        import deps
        from app_helpers import route_mentions

        channel = str(config.get("channel", "") or payload.get("channel", "general") or "general").strip()[:80] or "general"
        content = self._render_text(str(config.get("content", "") or workflow.get("name", "")), payload)
        if agent:
            content = f"@{agent} {content}"
        if not deps.store or not content.strip():
            return
        msg = await deps.store.add(
            "workflow",
            content,
            "system",
            channel,
            metadata=json.dumps({"workflow_id": workflow.get("id", ""), "workflow_generated": True}),
        )
        route_mentions("workflow", content, channel)
        await deps.broadcast("message", msg)

    async def _run_task_action(self, workflow: dict[str, Any], agent: str, config: dict, payload: dict) -> None:
        import deps
        from app_helpers import _append_jsonl_locked

        if not agent:
            return

        description = self._render_text(str(config.get("content", "") or workflow.get("name", "")), payload)
        description = description.strip()
        if not description:
            return
        title = description.splitlines()[0][:120]
        now = time.time()
        task = {
            "id": f"task_{int(now * 1000)}_{secrets.token_hex(4)}",
            "agent": agent,
            "title": title,
            "description": description,
            "status": "queued",
            "progress": 0,
            "created_at": now,
            "started_at": 0,
            "completed_at": 0,
            "error": "",
            "channel": str(config.get("channel", "") or payload.get("channel", "general") or "general").strip()[:80] or "general",
        }
        from routes import agents as agent_routes

        tasks = agent_routes._trim_task_history([task, *agent_routes._load_agent_tasks(agent)])
        agent_routes._save_agent_tasks(agent, tasks)

        queue_file = deps.DATA_DIR / f"{agent}_queue.jsonl"
        _append_jsonl_locked(queue_file, {
            "channel": task["channel"],
            "task_id": task["id"],
            "workflow_id": workflow.get("id", ""),
        })

        if deps.store:
            text = f"@{agent} [Automated Task {task['id']}] {title}"
            if description and description != title:
                text = f"{text}\n\n{description}"
            msg = await deps.store.add(
                "workflow",
                text,
                "system",
                task["channel"],
                metadata=json.dumps({"workflow_id": workflow.get("id", ""), "workflow_generated": True, "task_id": task["id"]}),
            )
            await deps.broadcast("message", msg)

        await agent_routes._emit_task_event(
            agent,
            "task_create",
            title="Queued task",
            detail=title,
            metadata={"task_id": task["id"], "workflow_id": workflow.get("id", "")},
        )

    async def _run_command_action(self, workflow: dict[str, Any], agent: str, config: dict, payload: dict) -> None:
        command = self._render_text(str(config.get("command", "") or ""), payload).strip()
        if not command:
            return
        command_config = {
            "content": f"Run this command in the workspace and report the result:\n{command}",
            "channel": str(config.get("channel", "") or payload.get("channel", "general") or "general"),
        }
        await self._run_task_action(workflow, agent, command_config, payload)

    async def _run_checkpoint_action(self, workflow: dict[str, Any], agent: str) -> None:
        if not agent:
            return
        from routes import agents as agent_routes

        workspace = agent_routes._get_agent_workspace_path(agent)
        if not workspace.is_dir():
            return
        label = f"Workflow: {str(workflow.get('name', 'Checkpoint')).strip()[:80]}"
        metadata = await agent_routes._create_checkpoint_snapshot(agent, workspace, label)
        await agent_routes._emit_checkpoint_event(
            agent,
            "checkpoint_create",
            title="Saved checkpoint",
            detail=str(metadata.get("label", label)),
            metadata={
                "checkpoint_id": metadata.get("id", ""),
                "workflow_id": workflow.get("id", ""),
                "file_count": metadata.get("file_count", 0),
                "size_bytes": metadata.get("size_bytes", 0),
            },
        )

    @staticmethod
    def _render_text(template: str, payload: dict) -> str:
        if not template:
            return ""
        flattened = {
            k: v
            for k, v in _flatten(payload).items()
            if isinstance(v, (str, int, float, bool))
        }
        try:
            return template.format(**flattened)
        except (KeyError, IndexError, ValueError):
            return template


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
