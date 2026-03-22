"""Example plugin — demonstrates the GhostLink plugin interface.

Drop this file in the plugins/ directory and restart the server.
It adds a /api/plugins/example/hello endpoint.
"""


def setup(app, store=None, registry=None, mcp_bridge=None):
    """Register plugin routes and tools."""

    @app.get("/api/plugins/example/hello")
    async def hello():
        return {"message": "Hello from the example plugin!", "plugin": "example"}
