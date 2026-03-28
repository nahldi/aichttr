"""Route-level tests for per-agent autonomous task queues."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

import deps


class _DummyRequest:
    def __init__(self, body: dict):
        self._body = body

    async def json(self) -> dict:
        return self._body


@pytest.fixture
def task_env(tmp_path: Path, tmp_data_dir: Path):
    from registry import AgentRegistry
    from router import MessageRouter
    from store import MessageStore

    async def _setup():
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        store = MessageStore(tmp_path / "messages.db")
        await store.init()
        deps.store = store
        deps.registry = AgentRegistry()
        deps.router_inst = MessageRouter()
        deps.DATA_DIR = tmp_data_dir
        deps._activity_log.clear()
        deps._agent_replay_log.clear()
        deps._agent_presence.clear()
        deps._settings["username"] = "You"

        async def _broadcast(*_args, **_kwargs):
            return None

        deps.broadcast = _broadcast
        agent = deps.registry.register("codex")
        agent.workspace = str(workspace)
        return {"agent": agent.name, "store": store}

    env = asyncio.run(_setup())
    try:
        yield env
    finally:
        asyncio.run(env["store"].close())


@pytest.mark.asyncio
async def test_task_lifecycle_creates_trigger_and_deletes(task_env):
    from routes import agents

    agent = task_env["agent"]
    created = await agents.create_agent_task(agent, _DummyRequest({
        "title": "Audit reconnect path",
        "description": "Verify stale-state handling after reconnect",
    }))
    assert created["ok"] is True
    task = created["task"]
    assert task["title"] == "Audit reconnect path"
    assert task["status"] == "queued"
    assert task["description"] == "Verify stale-state handling after reconnect"

    listing = await agents.list_agent_tasks(agent)
    assert [item["id"] for item in listing["tasks"]] == [task["id"]]

    queue_file = deps.DATA_DIR / f"{agent}_queue.jsonl"
    assert queue_file.is_file()
    queued = [json.loads(line) for line in queue_file.read_text("utf-8").splitlines() if line.strip()]
    assert queued[-1]["channel"] == "general"

    recent = await task_env["store"].get_recent(5, "general")
    assert any("[Autonomous Task" in msg["text"] and f"@{agent}" in msg["text"] for msg in recent)

    deleted = await agents.delete_agent_task(agent, task["id"])
    assert deleted["ok"] is True
    after_delete = await agents.list_agent_tasks(agent)
    assert after_delete["tasks"] == []

    replay_types = [event.get("type") for event in deps._agent_replay_log]
    assert "task_create" in replay_types
    assert "task_delete" in replay_types
    assert deps._agent_presence[agent]["surface"] == "tasks"


@pytest.mark.asyncio
async def test_task_routes_validate_input(task_env):
    from routes import agents

    agent = task_env["agent"]
    missing = await agents.create_agent_task(agent, _DummyRequest({"title": "   "}))
    assert missing.status_code == 400
    assert missing.body == b'{"error":"title required"}'

    invalid = await agents.delete_agent_task(agent, "../escape")
    assert invalid.status_code == 400
    assert invalid.body == b'{"error":"invalid task id"}'

