"""API routes for Phase 4-7 features.

Exposes REST endpoints for:
- Autonomous agent plans
- Memory graph (semantic search)
- RAG pipeline (document upload/search)
- Agent specialization (feedback)
- Remote agent execution
- User auth
- Workflow management
"""

from __future__ import annotations

import json
import logging

import deps
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

log = logging.getLogger(__name__)
router = APIRouter()


# ── Autonomous Agent (Phase 7.1) ──────────────────────────────────

@router.post("/api/autonomous/plan")
async def create_plan(request: Request):
    """Create an autonomous plan from a goal."""
    if not deps.autonomous_manager:
        return JSONResponse({"error": "Autonomous manager not initialized"}, 503)
    body = await request.json()
    goal = body.get("goal", "")
    agent = body.get("agent", "")
    subtasks = body.get("subtasks", [])
    if not goal or not agent or not subtasks:
        return JSONResponse({"error": "goal, agent, and subtasks required"}, 400)
    plan = deps.autonomous_manager.create_plan(
        goal, agent, subtasks,
        channel=body.get("channel", "general"),
        require_approval=body.get("require_approval", True),
    )
    return deps.autonomous_manager._plan_to_dict(plan)


@router.get("/api/autonomous/plans")
async def list_plans(agent: str = ""):
    if not deps.autonomous_manager:
        return {"plans": []}
    return {"plans": deps.autonomous_manager.list_plans(agent or None)}


@router.post("/api/autonomous/plans/{plan_id}/start")
async def start_plan(plan_id: str):
    if not deps.autonomous_manager:
        return JSONResponse({"error": "not initialized"}, 503)
    st = deps.autonomous_manager.start_execution(plan_id)
    if not st:
        return JSONResponse({"error": "Plan not found or no pending tasks"}, 404)
    return {"subtask": {"id": st.id, "label": st.label, "status": st.status}}


@router.post("/api/autonomous/plans/{plan_id}/advance")
async def advance_plan(plan_id: str, request: Request):
    if not deps.autonomous_manager:
        return JSONResponse({"error": "not initialized"}, 503)
    body = await request.json()
    st = deps.autonomous_manager.advance(
        plan_id, body.get("subtask_id", ""),
        result=body.get("result", ""), error=body.get("error", ""),
    )
    if st:
        return {"next": {"id": st.id, "label": st.label, "status": st.status}}
    plan = deps.autonomous_manager.get_plan(plan_id)
    return {"next": None, "plan_status": plan.status if plan else "unknown", "summary": plan.summary if plan else ""}


@router.post("/api/autonomous/plans/{plan_id}/cancel")
async def cancel_plan(plan_id: str):
    if not deps.autonomous_manager:
        return JSONResponse({"error": "not initialized"}, 503)
    return {"ok": deps.autonomous_manager.cancel(plan_id)}


# ── Memory Graph (Phase 7.2) ─────────────────────────────────────

@router.post("/api/memory-graph/add")
async def memory_graph_add(request: Request):
    if not deps.memory_graph:
        return JSONResponse({"error": "Memory graph not initialized"}, 503)
    body = await request.json()
    agent = body.get("agent", "")
    key = body.get("key", "")
    content = body.get("content", "")
    if not agent or not key or not content:
        return JSONResponse({"error": "agent, key, and content required"}, 400)
    node = deps.memory_graph.add(agent, key, content, tags=body.get("tags", []))
    return {"id": node.id, "connections": node.connections}


@router.get("/api/memory-graph/search")
async def memory_graph_search(q: str = "", agent: str = "", limit: int = 5):
    if not deps.memory_graph:
        return {"results": []}
    return {"results": deps.memory_graph.search(q, agent=agent or None, limit=limit)}


@router.get("/api/memory-graph/related/{node_id}")
async def memory_graph_related(node_id: str, depth: int = 1):
    if not deps.memory_graph:
        return {"related": []}
    return {"related": deps.memory_graph.get_related(node_id, depth)}


@router.get("/api/memory-graph/stats")
async def memory_graph_stats():
    if not deps.memory_graph:
        return {}
    return deps.memory_graph.stats()


@router.get("/api/memory-graph/agent/{agent}")
async def memory_graph_agent(agent: str):
    if not deps.memory_graph:
        return {}
    return deps.memory_graph.get_agent_knowledge(agent)


# ── RAG Pipeline (Phase 7.4) ─────────────────────────────────────

@router.post("/api/rag/upload")
async def rag_upload(request: Request):
    if not deps.rag_pipeline:
        return JSONResponse({"error": "RAG pipeline not initialized"}, 503)
    body = await request.json()
    filename = body.get("filename", "")
    content = body.get("content", "")
    if not filename or not content:
        return JSONResponse({"error": "filename and content required"}, 400)
    result = deps.rag_pipeline.upload(
        filename, content,
        channel=body.get("channel", "general"),
        uploaded_by=body.get("uploaded_by", "user"),
    )
    if "error" in result:
        return JSONResponse(result, 400)
    return result


@router.get("/api/rag/search")
async def rag_search(q: str = "", channel: str = "", limit: int = 5):
    if not deps.rag_pipeline:
        return {"results": []}
    return {"results": deps.rag_pipeline.search(q, channel=channel or None, limit=limit)}


@router.get("/api/rag/documents")
async def rag_documents(channel: str = ""):
    if not deps.rag_pipeline:
        return {"documents": []}
    return {"documents": deps.rag_pipeline.list_documents(channel=channel or None)}


@router.delete("/api/rag/documents/{doc_id:path}")
async def rag_delete(doc_id: str):
    if not deps.rag_pipeline:
        return JSONResponse({"error": "not initialized"}, 503)
    return {"ok": deps.rag_pipeline.delete_document(doc_id)}


# ── Specialization / Feedback (Phase 7.3) ─────────────────────────

@router.post("/api/specialization/feedback")
async def specialization_feedback(request: Request):
    if not deps.specialization:
        return JSONResponse({"error": "Specialization engine not initialized"}, 503)
    body = await request.json()
    return deps.specialization.record_feedback(
        agent=body.get("agent", ""),
        message_text=body.get("message_text", ""),
        feedback_type=body.get("feedback_type", ""),
        correction_text=body.get("correction_text", ""),
        channel=body.get("channel", "general"),
    )


@router.get("/api/specialization/stats/{agent}")
async def specialization_stats(agent: str):
    if not deps.specialization:
        return {}
    return deps.specialization.get_stats(agent)


@router.get("/api/specialization/adjustments/{agent}")
async def specialization_adjustments(agent: str):
    if not deps.specialization:
        return {"adjustments": []}
    return {"adjustments": deps.specialization.get_adjustments(agent)}


# ── Remote Execution (Phase 6.1) ─────────────────────────────────

@router.post("/api/remote/spawn-docker")
async def remote_spawn_docker(request: Request):
    if not deps.remote_runner:
        return JSONResponse({"error": "Remote runner not initialized"}, 503)
    body = await request.json()
    try:
        ra = deps.remote_runner.spawn_docker(
            body.get("base", ""), body.get("name", ""),
            body.get("workspace", "."), image=body.get("image", "ghostlink-agent:latest"),
            env=body.get("env", {}),
        )
        return {"name": ra.name, "host": ra.host, "state": ra.state, "error": ra.error}
    except RuntimeError as e:
        return JSONResponse({"error": str(e)}, 400)


@router.post("/api/remote/spawn-ssh")
async def remote_spawn_ssh(request: Request):
    if not deps.remote_runner:
        return JSONResponse({"error": "Remote runner not initialized"}, 503)
    body = await request.json()
    try:
        ra = deps.remote_runner.spawn_ssh(
            body.get("base", ""), body.get("name", ""),
            body.get("host", ""), workspace=body.get("workspace", "~"),
            user=body.get("user"), env=body.get("env", {}),
        )
        return {"name": ra.name, "host": ra.host, "state": ra.state, "error": ra.error}
    except RuntimeError as e:
        return JSONResponse({"error": str(e)}, 400)


@router.get("/api/remote/agents")
async def remote_list():
    if not deps.remote_runner:
        return {"agents": []}
    return {"agents": deps.remote_runner.list_agents()}


@router.post("/api/remote/stop/{name}")
async def remote_stop(name: str):
    if not deps.remote_runner:
        return JSONResponse({"error": "not initialized"}, 503)
    return {"ok": deps.remote_runner.stop(name)}


# ── User Auth (Phase 6.2) ────────────────────────────────────────

@router.post("/api/auth/login")
async def auth_login(request: Request):
    if not deps.user_manager or not deps.user_manager.is_enabled():
        return {"token": "anonymous", "role": "admin", "multi_user": False}
    body = await request.json()
    token = deps.user_manager.authenticate(body.get("username", ""), body.get("password", ""))
    if not token:
        return JSONResponse({"error": "Invalid credentials"}, 401)
    user = deps.user_manager.validate_token(token)
    return {"token": token, "username": user["username"], "role": user["role"], "multi_user": True}


@router.post("/api/auth/register")
async def auth_register(request: Request):
    if not deps.user_manager:
        return JSONResponse({"error": "Auth not initialized"}, 503)
    body = await request.json()
    try:
        user = deps.user_manager.create_user(
            body.get("username", ""), body.get("password", ""),
            role=body.get("role", "member"),
        )
        return user
    except ValueError as e:
        return JSONResponse({"error": str(e)}, 400)


@router.get("/api/auth/users")
async def auth_list_users():
    if not deps.user_manager:
        return {"users": []}
    return {"users": deps.user_manager.list_users()}


@router.post("/api/auth/logout")
async def auth_logout(request: Request):
    if not deps.user_manager:
        return {"ok": True}
    body = await request.json()
    deps.user_manager.logout(body.get("token", ""))
    return {"ok": True}
