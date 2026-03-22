"""GhostLink Plugin System.

Drop Python files in this directory to extend GhostLink.
Each plugin can register:
  - API endpoints (FastAPI routes)
  - MCP tools
  - WebSocket event handlers
  - Scheduled tasks

Plugin interface:
  def setup(app, store, registry, mcp_bridge):
      '''Called on server startup. Register your routes/tools here.'''
      pass
"""
