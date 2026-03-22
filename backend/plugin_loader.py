"""Plugin loader — discovers and loads plugins from the plugins/ directory.

Each plugin is a Python file in plugins/ with a setup() function.
Plugins can register FastAPI routes, MCP tools, and event handlers.
"""

import importlib
import logging
import os
import sys
from pathlib import Path

log = logging.getLogger(__name__)

PLUGINS_DIR = Path(__file__).parent / "plugins"


def discover_plugins() -> list[str]:
    """Find all .py plugin files (excluding __init__.py)."""
    if not PLUGINS_DIR.exists():
        return []
    return [
        f.stem
        for f in sorted(PLUGINS_DIR.glob("*.py"))
        if f.stem != "__init__" and not f.stem.startswith("_")
    ]


def load_plugins(app, store=None, registry=None, mcp_bridge_module=None):
    """Load and initialize all discovered plugins.

    Args:
        app: FastAPI application instance
        store: MessageStore instance
        registry: AgentRegistry instance
        mcp_bridge_module: The mcp_bridge module (for registering MCP tools)

    Returns:
        List of successfully loaded plugin names.
    """
    # Ensure plugins dir is on the path
    plugins_str = str(PLUGINS_DIR)
    if plugins_str not in sys.path:
        sys.path.insert(0, str(PLUGINS_DIR.parent))

    loaded = []
    for name in discover_plugins():
        try:
            module = importlib.import_module(f"plugins.{name}")
            setup_fn = getattr(module, "setup", None)
            if setup_fn is None:
                log.warning("Plugin '%s' has no setup() function — skipping", name)
                continue
            setup_fn(
                app=app,
                store=store,
                registry=registry,
                mcp_bridge=mcp_bridge_module,
            )
            loaded.append(name)
            log.info("Plugin loaded: %s", name)
        except Exception as e:
            log.error("Failed to load plugin '%s': %s", name, e)

    if loaded:
        print(f"  Plugins loaded: {', '.join(loaded)}")
    return loaded


def list_plugins() -> list[dict]:
    """List all discovered plugins with metadata."""
    plugins = []
    for name in discover_plugins():
        plugin_file = PLUGINS_DIR / f"{name}.py"
        try:
            module = importlib.import_module(f"plugins.{name}")
            doc = getattr(module, "__doc__", "") or ""
            has_setup = hasattr(module, "setup")
            plugins.append({
                "name": name,
                "description": doc.strip().split("\n")[0] if doc.strip() else "",
                "has_setup": has_setup,
                "file": str(plugin_file),
                "size": plugin_file.stat().st_size,
            })
        except Exception as e:
            plugins.append({
                "name": name,
                "description": f"Error: {e}",
                "has_setup": False,
                "file": str(plugin_file),
                "size": plugin_file.stat().st_size if plugin_file.exists() else 0,
            })
    return plugins
