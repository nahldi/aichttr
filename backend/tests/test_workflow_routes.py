"""Route-level tests for workflow automation CRUD and execution."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

import deps


class _DummyRequest:
    def __init__(self, body: dict, host: str = "127.0.0.1"):
        self._body = body
        self.client = SimpleNamespace(host=host)
        self.headers: dict[str, str] = {}

    async def json(self) -> dict:
        return self._body


@pytest.fixture
def workflow_env(tmp_path: Path, tmp_data_dir: Path):
    from automations import AutomationManager
    from registry import AgentRegistry
    from router import MessageRouter
    from store import MessageStore

    async def _setup():
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        (workspace / "src").mkdir()
        (workspace / "src" / "main.ts").write_text("export const ok = true;\n", encoding="utf-8")

        store = MessageStore(tmp_path / "messages.db")
        await store.init()
        deps.store = store
        deps.registry = AgentRegistry()
        deps.router_inst = MessageRouter()
        deps.DATA_DIR = tmp_data_dir
        deps.automation_manager = AutomationManager(tmp_data_dir)
        deps._activity_log.clear()
        deps._agent_replay_log.clear()
        deps._agent_presence.clear()
        deps._settings["username"] = "You"

        async def _broadcast(*_args, **_kwargs):
            return None

        deps.broadcast = _broadcast
        agent = deps.registry.register("codex")
        agent.workspace = str(workspace)
        return {"agent": agent.name, "workspace": workspace, "store": store}

    env = asyncio.run(_setup())
    try:
        yield env
    finally:
        asyncio.run(env["store"].close())


@pytest.mark.asyncio
async def test_workflow_crud_and_event_trigger_queue_task(workflow_env):
    from routes import messages, misc

    agent = workflow_env["agent"]
    create = await misc.create_workflow(_DummyRequest({
        "name": "Message to task",
        "trigger": {"type": "event", "config": {"event": "message_received"}},
        "action": {"type": "task", "agent": agent, "config": {"content": "Investigate: {text}"}},
    }))
    assert create["ok"] is True
    workflow = create["workflow"]
    assert workflow["run_count"] == 0
    assert workflow["enabled"] is True

    listed = await misc.list_workflows()
    assert [item["id"] for item in listed["workflows"]] == [workflow["id"]]

    sent = await messages.send_message(_DummyRequest({
        "sender": "alice",
        "text": "CI is flaky",
        "channel": "general",
    }))
    assert sent["text"] == "CI is flaky"

    tasks_path = deps.DATA_DIR / "tasks" / f"{agent}.json"
    tasks = json.loads(tasks_path.read_text("utf-8"))
    assert len(tasks) == 1
    assert tasks[0]["title"].startswith("Investigate:")
    assert tasks[0]["status"] == "queued"

    queue_file = deps.DATA_DIR / f"{agent}_queue.jsonl"
    queued = [json.loads(line) for line in queue_file.read_text("utf-8").splitlines() if line.strip()]
    assert queued[-1]["workflow_id"] == workflow["id"]

    after_run = await misc.list_workflows()
    assert after_run["workflows"][0]["run_count"] == 1
    assert after_run["workflows"][0]["last_run"] > 0

    patched = await misc.update_workflow(workflow["id"], _DummyRequest({"enabled": False}))
    assert patched["ok"] is True
    assert patched["workflow"]["enabled"] is False

    deleted = await misc.delete_workflow(workflow["id"])
    assert deleted["ok"] is True
    assert (await misc.list_workflows())["workflows"] == []


@pytest.mark.asyncio
async def test_file_change_workflow_creates_checkpoint(workflow_env):
    from routes import agents, misc

    agent = workflow_env["agent"]
    workspace = workflow_env["workspace"]
    create = await misc.create_workflow(_DummyRequest({
        "name": "Checkpoint on src change",
        "trigger": {"type": "file_change", "config": {"pattern": "src/*.ts"}},
        "action": {"type": "checkpoint", "agent": agent, "config": {}},
    }))
    assert create["ok"] is True

    await agents.add_workspace_change(agent, "modified", "src/main.ts")
    checkpoints = await agents.list_agent_checkpoints(agent)
    assert len(checkpoints["checkpoints"]) == 1
    assert checkpoints["checkpoints"][0]["label"].startswith("Workflow:")
    assert checkpoints["checkpoints"][0]["workspace"] == str(workspace)


@pytest.mark.asyncio
async def test_workflow_validation_rejects_missing_command_agent(workflow_env):
    from routes import misc

    response = await misc.create_workflow(_DummyRequest({
        "name": "Bad workflow",
        "trigger": {"type": "event", "config": {"event": "message_received"}},
        "action": {"type": "command", "agent": "", "config": {"command": "pwd"}},
    }))
    assert response.status_code == 400
    assert response.body == b'{"error":"action agent required"}'


@pytest.mark.asyncio
async def test_schedule_workflow_runs_via_manager_tick(workflow_env):
    from routes import misc

    agent = workflow_env["agent"]
    create = await misc.create_workflow(_DummyRequest({
        "name": "Nightly checkpoint",
        "trigger": {"type": "schedule", "config": {"cron": "* * * * *"}},
        "action": {"type": "checkpoint", "agent": agent, "config": {}},
    }))
    assert create["ok"] is True

    ran = await deps.automation_manager.process_due_schedules()
    assert len(ran) == 1
    checkpoints_dir = deps.DATA_DIR / "checkpoints" / agent
    assert checkpoints_dir.is_dir()
