"""Remote Agent Runner — spawn agents on Docker containers or SSH hosts.

Supports two runner types:
  - docker: Spawns agent CLI inside a Docker container with workspace mounted
  - ssh: Spawns agent CLI on a remote host via SSH

The remote agent connects back to the GhostLink MCP bridge via HTTP transport.
"""

from __future__ import annotations

import logging
import subprocess
import threading
import time
from dataclasses import dataclass, field
from typing import Literal

log = logging.getLogger(__name__)

MAX_REMOTE_AGENTS = 8


@dataclass
class RemoteAgent:
    """Tracks a remotely running agent."""
    name: str
    runner_type: Literal["docker", "ssh"]
    host: str  # container ID or SSH host
    pid: int | None = None
    started_at: float = field(default_factory=time.time)
    state: str = "starting"  # starting, running, stopped, error
    error: str = ""


class RemoteRunner:
    """Manages remote agent execution."""

    def __init__(self, server_host: str = "127.0.0.1", server_port: int = 8300):
        self._agents: dict[str, RemoteAgent] = {}
        self._lock = threading.Lock()
        self.server_host = server_host
        self.server_port = server_port

    def spawn_docker(
        self,
        agent_base: str,
        agent_name: str,
        workspace: str,
        image: str = "ghostlink-agent:latest",
        env: dict[str, str] | None = None,
    ) -> RemoteAgent:
        """Spawn an agent inside a Docker container."""
        with self._lock:
            if len(self._agents) >= MAX_REMOTE_AGENTS:
                raise RuntimeError(f"Max {MAX_REMOTE_AGENTS} remote agents reached")

        cmd = [
            "docker", "run", "-d", "--rm",
            "--name", f"ghostlink-{agent_name}",
            "-v", f"{workspace}:/workspace",
            "-e", f"GHOSTLINK_SERVER=http://host.docker.internal:{self.server_port}",
            "-e", f"GHOSTLINK_AGENT_NAME={agent_name}",
            "-e", f"GHOSTLINK_AGENT_BASE={agent_base}",
        ]
        # Pass through env vars (API keys etc)
        for k, v in (env or {}).items():
            cmd.extend(["-e", f"{k}={v}"])

        cmd.extend([image, agent_base, "--headless"])

        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=30,
            )
            if result.returncode != 0:
                err = result.stderr.strip() or "Docker run failed"
                log.warning("Docker spawn failed for %s: %s", agent_name, err)
                ra = RemoteAgent(agent_name, "docker", "", state="error", error=err)
                with self._lock:
                    self._agents[agent_name] = ra
                return ra

            container_id = result.stdout.strip()[:12]
            ra = RemoteAgent(agent_name, "docker", container_id, state="running")
            with self._lock:
                self._agents[agent_name] = ra
            log.info("Docker agent %s started in container %s", agent_name, container_id)

            # Monitor in background
            threading.Thread(
                target=self._monitor_docker, args=(agent_name, container_id),
                daemon=True,
            ).start()
            return ra

        except subprocess.TimeoutExpired:
            ra = RemoteAgent(agent_name, "docker", "", state="error", error="Docker start timed out")
            with self._lock:
                self._agents[agent_name] = ra
            return ra
        except FileNotFoundError:
            ra = RemoteAgent(agent_name, "docker", "", state="error", error="Docker not installed")
            with self._lock:
                self._agents[agent_name] = ra
            return ra

    def spawn_ssh(
        self,
        agent_base: str,
        agent_name: str,
        host: str,
        workspace: str = "~",
        user: str | None = None,
        env: dict[str, str] | None = None,
    ) -> RemoteAgent:
        """Spawn an agent on a remote SSH host."""
        with self._lock:
            if len(self._agents) >= MAX_REMOTE_AGENTS:
                raise RuntimeError(f"Max {MAX_REMOTE_AGENTS} remote agents reached")

        ssh_target = f"{user}@{host}" if user else host
        env_exports = " ".join(f"{k}={v}" for k, v in (env or {}).items())
        remote_cmd = (
            f"cd {workspace} && "
            f"export GHOSTLINK_SERVER=http://{self.server_host}:{self.server_port} "
            f"GHOSTLINK_AGENT_NAME={agent_name} GHOSTLINK_AGENT_BASE={agent_base} "
            f"{env_exports} && "
            f"nohup {agent_base} --headless > /dev/null 2>&1 & echo $!"
        )

        try:
            result = subprocess.run(
                ["ssh", "-o", "StrictHostKeyChecking=accept-new",
                 "-o", "ConnectTimeout=10", ssh_target, remote_cmd],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode != 0:
                err = result.stderr.strip() or "SSH connection failed"
                log.warning("SSH spawn failed for %s: %s", agent_name, err)
                ra = RemoteAgent(agent_name, "ssh", host, state="error", error=err)
                with self._lock:
                    self._agents[agent_name] = ra
                return ra

            pid = int(result.stdout.strip()) if result.stdout.strip().isdigit() else None
            ra = RemoteAgent(agent_name, "ssh", host, pid=pid, state="running")
            with self._lock:
                self._agents[agent_name] = ra
            log.info("SSH agent %s started on %s (pid %s)", agent_name, host, pid)

            # Monitor in background
            threading.Thread(
                target=self._monitor_ssh, args=(agent_name, ssh_target, pid),
                daemon=True,
            ).start()
            return ra

        except subprocess.TimeoutExpired:
            ra = RemoteAgent(agent_name, "ssh", host, state="error", error="SSH connection timed out")
            with self._lock:
                self._agents[agent_name] = ra
            return ra

    def stop(self, agent_name: str) -> bool:
        """Stop a remote agent."""
        with self._lock:
            ra = self._agents.get(agent_name)
            if not ra:
                return False

        if ra.runner_type == "docker":
            try:
                subprocess.run(
                    ["docker", "stop", f"ghostlink-{agent_name}"],
                    capture_output=True, timeout=15,
                )
            except Exception as e:
                log.debug("Docker stop failed for %s: %s", agent_name, e)
        elif ra.runner_type == "ssh" and ra.pid:
            try:
                ssh_target = ra.host
                subprocess.run(
                    ["ssh", ssh_target, f"kill {ra.pid}"],
                    capture_output=True, timeout=10,
                )
            except Exception as e:
                log.debug("SSH kill failed for %s: %s", agent_name, e)

        with self._lock:
            ra.state = "stopped"
        log.info("Remote agent %s stopped", agent_name)
        return True

    def list_agents(self) -> list[dict]:
        """List all remote agents."""
        with self._lock:
            return [
                {
                    "name": ra.name,
                    "runner": ra.runner_type,
                    "host": ra.host,
                    "state": ra.state,
                    "uptime": int(time.time() - ra.started_at),
                    "error": ra.error,
                }
                for ra in self._agents.values()
            ]

    def cleanup(self, agent_name: str):
        """Remove a remote agent from tracking."""
        with self._lock:
            self._agents.pop(agent_name, None)

    def cleanup_all(self):
        """Stop and remove all remote agents."""
        for name in list(self._agents.keys()):
            self.stop(name)
        with self._lock:
            self._agents.clear()

    def _monitor_docker(self, name: str, container_id: str):
        """Monitor a Docker container and mark agent as stopped when it exits."""
        while True:
            time.sleep(10)
            with self._lock:
                ra = self._agents.get(name)
                if not ra or ra.state != "running":
                    return
            try:
                result = subprocess.run(
                    ["docker", "inspect", "-f", "{{.State.Running}}", container_id],
                    capture_output=True, text=True, timeout=5,
                )
                if result.stdout.strip() != "true":
                    with self._lock:
                        if name in self._agents:
                            self._agents[name].state = "stopped"
                    log.info("Docker agent %s container exited", name)
                    return
            except Exception:
                pass

    def _monitor_ssh(self, name: str, ssh_target: str, pid: int | None):
        """Monitor an SSH agent process and mark as stopped when it exits."""
        if not pid:
            return
        while True:
            time.sleep(15)
            with self._lock:
                ra = self._agents.get(name)
                if not ra or ra.state != "running":
                    return
            try:
                result = subprocess.run(
                    ["ssh", "-o", "ConnectTimeout=5", ssh_target, f"kill -0 {pid} 2>/dev/null; echo $?"],
                    capture_output=True, text=True, timeout=10,
                )
                if result.stdout.strip() != "0":
                    with self._lock:
                        if name in self._agents:
                            self._agents[name].state = "stopped"
                    log.info("SSH agent %s process exited", name)
                    return
            except Exception:
                pass
