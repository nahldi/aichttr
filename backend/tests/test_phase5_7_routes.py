"""Route-level tests for Phase 5-7 backend APIs."""

from __future__ import annotations

from pathlib import Path

import pytest

import deps


class _DummyRequest:
    def __init__(self, body: dict):
        self._body = body

    async def json(self) -> dict:
        return self._body


@pytest.fixture
def phase5_7_env(tmp_data_dir: Path):
    from auth import UserManager

    deps.DATA_DIR = tmp_data_dir
    deps._settings["username"] = "You"
    deps.user_manager = UserManager(tmp_data_dir)
    deps._workspace_collaborators.clear()
    deps._workspace_ws_users.clear()

    async def _broadcast(*_args, **_kwargs):
        return None

    deps.broadcast = _broadcast
    return {"data_dir": tmp_data_dir}


@pytest.mark.asyncio
async def test_agent_soul_route_accepts_persona_payload_key(phase5_7_env):
    from routes import agents

    response = await agents.api_set_soul("codex", _DummyRequest({"soul": "You are a reviewer."}))
    assert response == {"ok": True}

    fetched = await agents.api_get_soul("codex")
    assert fetched["soul"] == "You are a reviewer."


@pytest.mark.asyncio
async def test_custom_rules_lifecycle(phase5_7_env):
    from routes import phase4_7

    created = await phase4_7.create_custom_rule(_DummyRequest({
        "scope": "project",
        "category": "workflow",
        "text": "Run tests after code changes",
    }))
    assert created["ok"] is True
    rule = created["rule"]
    assert rule["scope"] == "project"
    assert rule["enabled"] is True

    listing = await phase4_7.list_custom_rules()
    assert [item["id"] for item in listing["rules"]] == [rule["id"]]

    updated = await phase4_7.update_custom_rule(rule["id"], _DummyRequest({"enabled": False}))
    assert updated["ok"] is True
    assert updated["rule"]["enabled"] is False

    deleted = await phase4_7.delete_custom_rule(rule["id"])
    assert deleted["ok"] is True
    assert (await phase4_7.list_custom_rules())["rules"] == []


@pytest.mark.asyncio
async def test_persona_crud_and_listing(phase5_7_env):
    from routes import phase4_7

    created = await phase4_7.create_persona(_DummyRequest({
        "name": "Docs Specialist",
        "description": "Writes and maintains docs.",
        "instructions": "Be accurate and concise.",
        "skills": ["documentation", "api_design"],
        "category": "writer",
    }))
    assert created["ok"] is True
    persona = created["persona"]
    assert persona["author"] == "You"

    listing = await phase4_7.list_personas()
    assert [item["id"] for item in listing["personas"]] == [persona["id"]]

    updated = await phase4_7.update_persona(persona["id"], _DummyRequest({"name": "Docs Lead"}))
    assert updated["ok"] is True
    assert updated["persona"]["name"] == "Docs Lead"

    deleted = await phase4_7.delete_persona(persona["id"])
    assert deleted["ok"] is True
    assert (await phase4_7.list_personas())["personas"] == []


@pytest.mark.asyncio
async def test_workspace_invites_and_collaborators(phase5_7_env):
    from routes import phase4_7

    deps.user_manager.create_user("alice", "hunter2", role="member")
    token = deps.user_manager.authenticate("alice", "hunter2")
    assert token

    collaborators = await phase4_7.list_workspace_collaborators()
    assert collaborators["collaborators"][0]["username"] == "alice"
    assert collaborators["collaborators"][0]["status"] == "active"

    created = await phase4_7.create_workspace_invite(_DummyRequest({"max_uses": 3, "expires_hours": 12}))
    assert created["ok"] is True
    invite = created["invite"]
    assert invite["max_uses"] == 3
    assert invite["uses"] == 0

    listing = await phase4_7.list_workspace_invites()
    assert [item["id"] for item in listing["invites"]] == [invite["id"]]

    redeemed = await phase4_7.redeem_workspace_invite(_DummyRequest({"code": invite["code"]}))
    assert redeemed["ok"] is True
    assert redeemed["invite"]["uses"] == 1

    deleted = await phase4_7.delete_workspace_invite(invite["id"])
    assert deleted["ok"] is True
    assert (await phase4_7.list_workspace_invites())["invites"] == []


@pytest.mark.asyncio
async def test_workspace_presence_lifecycle_updates_live_collaborators(phase5_7_env):
    from routes import phase4_7

    await phase4_7.update_workspace_presence(101, {
        "username": "alice",
        "viewing": "Channel: general",
        "status": "active",
        "cursor": {"channel": "general", "messageId": 42},
    })
    listing = await phase4_7.list_workspace_collaborators()
    assert listing["collaborators"][0]["username"] == "alice"
    assert listing["collaborators"][0]["viewing"] == "Channel: general"
    assert listing["collaborators"][0]["cursor"]["messageId"] == 42

    await phase4_7.update_workspace_presence(101, {
        "username": "alice",
        "viewing": "Cockpit: codex",
        "status": "active",
    })
    listing = await phase4_7.list_workspace_collaborators()
    assert listing["collaborators"][0]["viewing"] == "Cockpit: codex"

    await phase4_7.remove_workspace_presence(101)
    assert (await phase4_7.list_workspace_collaborators())["collaborators"] == []
