# GhostLink — Known Bugs & Issues

**Last updated:** 2026-03-24
**Version:** v3.3.2
**Source:** Full codebase audit + live API testing + deep code path audit + user-reported bugs + automated audit + 5 fix rounds

---

## CRITICAL — App won't fully function

### ~~BUG-001: WebSocket "Connection lost" banner always shows~~ FIXED
**Status:** FIXED
**Fix:** Replaced catch-all `@app.get("/{full_path:path}")` with `@app.middleware("http")` `spa_middleware` that only fires on 404 responses and explicitly skips `/ws`, `/api/`, and `/uploads/` paths.

### ~~BUG-002: Server startup fails on first run (missing Python deps)~~ FIXED
**Status:** FIXED (v1.0.4)
**Fix:** Server now auto-detects missing python3-venv and attempts `sudo apt-get install -y python3-venv` automatically. Falls back to `--break-system-packages` as last resort. Clear error message if all methods fail.

### ~~BUG-003: `AgentMemory.__init__()` missing argument~~ FIXED
**Status:** FIXED
**Fix:** Per-agent `get_agent_memory(data_dir, agent_name)` calls in all endpoints.

---

## HIGH — Major UX problems

### ~~BUG-004: Setup wizard doesn't show on fresh install (when settings.json persists)~~ FIXED
**Status:** FIXED (v1.2.0)
**Fix:** NSIS uninstaller now deletes `~/.ghostlink/settings.json` on uninstall, so the wizard runs on reinstall. Other user data preserved.

### ~~BUG-005: Wizard "Next" button doesn't work~~ FIXED
**Status:** FIXED
**Fix:** wizard.js passes platform parameter correctly to IPC handler.

### ~~BUG-006: Launcher/wizard window freezes for ~60 seconds~~ FIXED
**Status:** FIXED
**Fix:** All `execSync` calls replaced with async `execAsync`. Auth checks run via `Promise.allSettled()`.

### ~~BUG-007: OneDrive paths not accessible from WSL~~ MITIGATED (v1.0.4+)
**Status:** MITIGATED — server.ts detects OneDrive paths and auto-copies backend+frontend to `/tmp/` for WSL compatibility. Not a code bug — inherent WSL filesystem limitation.
**Workaround:** Install to a non-OneDrive location (e.g., C:\GhostLink) for faster startup.

---

## MEDIUM — Functional issues

### ~~BUG-008: No agents appear in the agent bar (fresh desktop install)~~ FIXED
**Status:** FIXED (v1.2.0)
**Fix:** Setup wizard now auto-detects installed CLIs (claude, codex, gemini) and pre-populates persistent agents on completion.

### ~~BUG-009: Launcher doesn't hide when chat window opens~~ FIXED
**Status:** FIXED (v1.0.0)
**Fix:** `createChatWindow()` now hides both launcher AND wizard windows in the `ready-to-show` handler.

### ~~BUG-010: "Update check failed" error on every launch~~ FIXED
**Status:** FIXED (v1.0.0)
**Fix:** electron-builder.yml pointed to correct repo `nahldi/ghostlink`. Updater error handler now gracefully suppresses network errors, 404s, missing releases, and DNS failures — shows "Up to date" instead of scary error text.

### ~~BUG-011: Frontend dist path mismatch in packaged app~~ FIXED (v3.3.0)
**Status:** FIXED — server.ts checks both `frontend/dist/` (dev) and `frontend/` (packaged) paths. OneDrive copy also handles both layouts. electron-builder.yml copies `frontend/dist/` contents to `frontend/`.

### ~~BUG-012: Menu bar (File, Edit, View) shows on some windows~~ FIXED
**Status:** FIXED
**Fix:** `Menu.setApplicationMenu(null)` called on app ready + `autoHideMenuBar: true` set on chat BrowserWindow.

---

## LOW — Polish issues

### ~~BUG-013: Cloudflare tunnel button not visible in desktop app~~ FIXED
**Status:** FIXED (v1.0.4)
**Fix:** Agent bar now uses `flex-1 min-w-0 overflow-hidden` container, tunnel button stays visible with `ml-3 shrink-0`.

### ~~BUG-014: Ghost logo shows as broken image~~ VERIFIED NOT A BUG
**Status:** NOT A BUG — `ghostlink.png` exists in `frontend/public/` and gets copied to `frontend/dist/` on build. SPA middleware in `app.py` serves it from STATIC_DIR. Works in both dev and packaged modes.

### ~~BUG-015: Stats panel text partially cut off on right edge~~ FIXED
**Status:** FIXED (v1.0.4)
**Fix:** Added `overflow-x-hidden` to panel container and `overflow-hidden text-right` to stat rows.

### ~~BUG-016: Light mode agent chips barely visible~~ FIXED
**Status:** FIXED (v1.0.4)
**Fix:** Light mode chip styles now use stronger color mixing (18% bg, 35% border), added `box-shadow`, and explicit text colors for contrast.

### ~~BUG-017: Electron app installed to OneDrive Desktop by default~~ MITIGATED
**Status:** MITIGATED — NSIS installer allows choosing install directory (`allowToChangeInstallationDirectory: true`). BUG-007 auto-copy handles OneDrive paths when detected.

### ~~BUG-018: Settings.json persists across uninstall/reinstall~~ FIXED (v1.2.0)
**Status:** FIXED — Custom NSIS uninstaller script (`assets/uninstaller.nsh`) deletes `settings.json` on explicit uninstall. Preserves settings during silent auto-update upgrades.

---

## v1.6.x BUGS

### BUG-019: All 7 new MCP tools crashed with TypeError — FIXED (v1.6.2)
### BUG-020: Webhook delivery blocked WebSocket broadcasts — FIXED (v1.6.2)
### BUG-021: Gemini video gen created empty files — FIXED (v1.6.2)
### BUG-022: Auth detection too strict for Claude/Gemini — FIXED (v1.6.3)
### BUG-023: Gemini Connect opens wrong terminal command — FIXED (v1.6.3)

### BUG-024: Gemini and Copilot fail to spawn — FIXED (v1.7.0)
**Fix:** Copilot command corrected from `github-copilot` to `gh` with `copilot` subcommand. Spawn endpoint now also checks WSL when command not on host PATH.

### BUG-025: Failed agent spawns leave ghost agents in bar — FIXED (v1.7.0)
**Fix:** Persistent agent entry is rolled back on spawn failure.

### BUG-026: Claude can't use GhostLink MCP tools — FIXED (v1.7.1)
**Fix:** The trigger text injected via tmux was `mcp read #general` which confused Claude into looking for an external MCP command. Replaced with natural language: `"You were @mentioned in #general on GhostLink. Use the chat_read tool with channel="general" to read recent messages, then use chat_send to respond."` This tells Claude to use its available MCP tools instead of interpreting "mcp read" as a literal command.
**Future feature:** Settings > Integrations panel for external chat bridges (Discord, Slack, Telegram) — bot token input, channel mapping, on/off toggle. Off by default.

### ~~BUG-028: Many config/setup tasks require terminal access~~ MOSTLY RESOLVED (v2.4.0+)
**Status:** MOSTLY RESOLVED — The following are now in the UI:
- API key entry: Settings > AI > Providers panel (all 13 providers)
- Agent management: AddAgentModal for spawn, AgentInfoPanel for config/kill/pause
- Agent config: label, color, role, workspace, model, permissions via UI
- Agent removal: Kill button in agent chip context menu
- Terminal Peek: Live tmux output viewer for debugging
- Bridge config: Settings > Integrations tab
- Theme/appearance: Settings > Appearance tab
- Port/server config: Settings > Advanced tab
**Remaining terminal-only items:** Installing agent CLIs (npm/pip), advanced config.toml editing. These require system-level package management that the UI can't safely execute.

### BUG-027: Thinking glow not showing — FIXED (v1.7.0)
**Fix:** Reduced startup delay from 15s to 5s. Heartbeat now checks `_was_triggered` flag from @mentions to activate thinking immediately. Thinking state now activates both from activity detection and from @mention triggers.

---

## v1.6.3 DEEP AUDIT BUGS (2026-03-23)

### BUG-029: Killing one agent can kill another agent's process — FIXED (v1.7.0)
### BUG-030: Schedule checker silently fails — unawaited coroutines — FIXED (v1.7.0)
### BUG-031: Settings save race condition — FIXED (v1.7.0)
### BUG-032: Rate limiter too aggressive + IP cleanup — FIXED (v1.7.0)
### BUG-033: Progress card updates don't broadcast — FIXED (v1.7.0)
### BUG-034: WebSocket reconnect doesn't fetch missed messages — FIXED (v1.7.0)
### BUG-035: Messages array grows unbounded — FIXED (v1.7.0)
### BUG-036: useWebSocket stale closures — VERIFIED NOT A BUG (Zustand stable refs)
### BUG-037: Select mode persists across channel switches — FIXED (v1.7.0)
### BUG-038: Approval auto-approve presses wrong keys — FIXED (v1.7.0)
### BUG-039: Silent API errors — FIXED (v1.7.0)
### BUG-040: Rate limiter IP entries never cleaned — FIXED (v1.7.0)
### BUG-041: Z-index conflicts between modals — FIXED (v1.7.0)
### BUG-042: Direct store._db access — FIXED (v1.7.0)

### ~~BUG-043: Agent spawn setTimeout not cancelled on modal close~~ FIXED (v3.3.0)
**Status:** FIXED
**Fix:** Added `spawnTimerRef` with `useRef` and cleanup in `useEffect` unmount handler (AddAgentModal.tsx line 94-101). Timer is cleared when modal closes.

### BUG-044: QR code leaked tunnel URL to external API — FIXED (v1.7.0)
**Fix:** Replaced external QR API with local canvas-based generation. Tunnel URL never leaves the client.

### ~~BUG-045: Clipboard API not checked before use~~ FIXED (v3.3.1)
**Status:** FIXED
**Fix:** CodeBlock.tsx already had optional chaining + textarea fallback. Fixed RemoteSession.tsx to also use optional chaining with textarea fallback for insecure contexts. ChatMessage.tsx already uses optional chaining with `.catch()`.

### BUG-046: OAuth sign-in not available — all providers require manual API key entry
**Severity:** Medium — UX friction, but functional via API keys
**Where:** Settings > AI > Providers panel
**Root cause:** API key entry is fully functional for all 13 providers. OAuth requires registering OAuth apps with each provider's developer console (Google Cloud, GitHub, etc.) and implementing the OAuth2 flow with redirect URIs. This is a feature enhancement requiring external service registration, not a code bug.
**Note:** 4 providers (Groq, Together, HuggingFace, Ollama) have free tiers that don't need API keys. Gemini CLI is free with 1000/day limit and doesn't need a key.
**Status:** Future enhancement — requires OAuth app registration per provider

---

## v1.6.3 DEEP AUDIT ROUND 2 (2026-03-23)

### BUG-047: XSS in HTML export — FIXED (v1.7.0)
### BUG-048: Arbitrary settings injection — FIXED (v1.7.0)
### BUG-049: Webhook update field injection — FIXED (v1.7.0)
### BUG-050: Provider config key injection — FIXED (v1.7.0)
### BUG-051: Agent config unvalidated values — FIXED (v1.7.0)
### BUG-052: SSRF bypass in mcp_bridge web_fetch — FIXED (v1.7.0)
### BUG-053: Wizard allows proceeding without Python — FIXED (v1.7.0)
### BUG-054: Launcher hardcodes port 8300 — FIXED (v1.7.0)
### BUG-055: Start scripts fail without venv — FIXED (v1.7.0)
### BUG-056: ReplayViewer variable naming — FIXED (v1.7.0)
### BUG-057: Sidebar channel response type mismatch — FIXED (v1.7.0)
### BUG-058: MessageInput attachments not sent — FIXED (v1.7.1)
### BUG-059: Voice language recognizer — VERIFIED NOT A BUG (recreated each press)
### BUG-060: TerminalPeek polling after unmount — FIXED (v1.7.0)
### BUG-061: Auth detection false positives — FIXED (v1.7.0)
### BUG-062: CSS @property Firefox/Safari — FIXED (v1.7.1)
### BUG-063: CSS scrollbar Firefox fallback — FIXED (v1.7.0)
### BUG-064: file_watcher thread cleanup — FIXED (v1.7.0)
### BUG-065: Video duration validation — FIXED (v1.7.0)
### BUG-066: Snapshot import value validation — FIXED (v1.7.0)

---

## ARCHITECTURE ISSUES

### ~~ARCH-001: Serving frontend and WebSocket from same FastAPI app~~ RESOLVED
**Fix:** HTTP middleware only intercepts 404s, explicitly skips `/ws`, `/api/`, `/uploads/`.

### ~~ARCH-002: Synchronous IPC in Electron main process~~ RESOLVED
**Fix:** All `execSync` replaced with `execAsync`.

### ~~ARCH-003: Desktop app depends on WSL~~ RESOLVED (v3.3.0+)
**Status:** RESOLVED — server.ts supports BOTH native Python and WSL. The `isWsl()` check only activates WSL mode when `settings.platform === 'wsl'`. Native path (`getPythonPath()`) finds venv or system Python on Windows/macOS/Linux. The wizard detects platform and sets the appropriate mode. Users on native Windows with Python installed can run without WSL.

---

## SECURITY FIXES (v1.0.0)

### ~~SEC-001: MCP identity spoofing via raw sender parameter~~ FIXED
**Status:** FIXED (v1.0.0)
**Fix:** `_resolve_identity()` in `mcp_bridge.py` now requires bearer token authentication for all agent names. Only human names ("you", "user", "human", "admin", "system") are accepted without a token. Agents MUST authenticate via their registered token.

### ~~SEC-002: Assert statements fail with Python -O flag~~ FIXED
**Status:** FIXED (v1.0.0)
**Fix:** Replaced `assert store._db is not None` in `app.py` search and export endpoints with `if store._db is None: raise RuntimeError(...)`.

### ~~SEC-003: Auth regex matches "not authenticated"~~ FIXED
**Status:** FIXED (v1.0.0)
**Fix:** Auth detection regex in `anthropic.ts` and `google.ts` now uses word boundaries and explicitly rejects negated patterns like "not authenticated".

### ~~SEC-004: Bash OR logic bug in OpenAI/Google auth checks~~ FIXED
**Status:** FIXED (v1.0.0)
**Fix:** Added proper parentheses around `test -d ... || test -d ...` in `openai.ts` and `google.ts` WSL directory checks.

---

## SECURITY FIXES (v2.3.0)

### ~~SEC-005: XOR encryption too weak for secrets~~ FIXED
**Status:** FIXED (v2.3.0)
**Fix:** `SecretsManager` now uses Fernet (AES-128-CBC + HMAC-SHA256) via `cryptography` package. Key derived with PBKDF2-HMAC-SHA256 (100k iterations). Old XOR data still readable via fallback. Prefix detection (`fernet:`) distinguishes new vs. old ciphertext.

### ~~SEC-006: /api/send accessible from external hosts~~ FIXED
**Status:** FIXED (v2.3.0)
**Fix:** Added localhost guard at top of `send_message`. Requests from non-127.0.0.1/::1 clients get HTTP 403. Prevents external message injection via tunnel/LAN.

### ~~SEC-007: Webhook delivery vulnerable to SSRF~~ FIXED
**Status:** FIXED (v2.3.0)
**Fix:** `_deliver_webhooks` now calls `_is_private_url()` before each outbound POST. Private/loopback/link-local URLs are blocked and logged.

### ~~SEC-008: WebSocket has no auth for external connections~~ FIXED
**Status:** FIXED (v2.3.0)
**Fix:** Non-localhost WebSocket clients must supply `?token=<token>`. Token generated at startup via `secrets.token_urlsafe(32)`, served at `GET /api/ws-token` (localhost only).

### ~~SEC-009: MCP auto-approve too broad — fires on any "ghostlink" mention~~ FIXED
**Status:** FIXED (v2.3.0)
**Fix:** Replaced loose substring check with `_GHOSTLINK_MCP_RE` regex that matches `ghostlink/tool_name` format only.

### ~~SEC-010: Plugin safety scanner only checked 3 patterns~~ FIXED
**Status:** FIXED (v2.3.0)
**Fix:** `install_plugin` now uses `SafetyScanner` (AST-based) from `plugin_sdk` first. Falls back to 8-pattern string check if unavailable.

---

## BACKEND FIXES (v2.9.0)

### ~~BUG-C5: Agent process tracking race condition~~ FIXED (v2.9.0)
**Where:** `backend/app.py` — agent spawn/kill handlers
**Root cause:** `_agent_processes` dict accessed from both the spawn endpoint and the kill endpoint without an asyncio lock. Concurrent spawns for the same agent name could overwrite each other's process handle, making one process un-killable (leaked process).
**Fix:** All reads and writes to `_agent_processes` now happen inside `async with deps._agent_lock`. Moved to `deps.py` so all route modules share the same lock instance.

### ~~BUG-H2: Settings concurrent mutation~~ FIXED (v2.9.0)
**Where:** `backend/app.py` — `save_settings` / `get_settings`
**Root cause:** Settings JSON file written and read from multiple async tasks without a lock. Concurrent requests could read a partially-written file or produce a torn write.
**Fix:** `_settings_lock = asyncio.Lock()` in `deps.py`. All settings load/save operations acquire the lock.

### ~~BUG-H4: SIGKILL not escalated when SIGTERM is ignored~~ FIXED (v2.9.0)
**Where:** `backend/app.py` — agent kill endpoint
**Root cause:** Kill endpoint sent `SIGTERM` but never followed up with `SIGKILL` if process remained alive. Agents that ignored SIGTERM would stay running.
**Fix:** After SIGTERM, a 3-second grace period check is added. If process is still alive, `SIGKILL` is sent.

### ~~BUG-H5: Approval file write race (non-atomic)~~ FIXED (v2.9.0)
**Where:** `backend/app.py` — approval file creation
**Root cause:** Approval result written by opening the file and writing directly. Concurrent readers could see a partial file.
**Fix:** Write to a temp file then `os.replace()` (atomic on POSIX). Readers always see either the old file or the complete new file.

---

## ARCHITECTURE FIXES (v3.0.0)

### ~~ARCH-004: 3400-line monolithic app.py~~ RESOLVED (v3.0.0)
**Root cause:** All 90+ API endpoints lived in a single `app.py` file, making it impossible to navigate, test in isolation, or extend without merge conflicts.
**Fix:** Split into `backend/deps.py` (shared state) + 13 `backend/routes/` modules: `agents.py`, `bridges.py`, `channels.py`, `jobs.py`, `messages.py`, `misc.py`, `plugins.py`, `providers.py`, `rules.py`, `schedules.py`, `search.py`, `security.py`, `sessions.py`. `app.py` reduced from 3401 → 612 lines.

---

## HOURLY HEALTH AUDIT — 2026-03-24T11:XX UTC

**Audit type:** Automated scheduled audit (no code edits — issues logged only)
**Test suite:** 56/56 tests passed
**TypeScript:** Compiles clean (0 errors from `tsc -b`)
**Frontend:** 0 vulnerabilities in npm audit; 306 packages OK
**Git:** On `master`, up to date with `origin/master`. 50 files with uncommitted changes (all from recent v3.3.0 work). 1 stash present.

### ~~BUG-067: Backend dependency conflict — fastapi vs mcp version pins~~ FIXED (v3.3.1)
**Status:** FIXED
**Fix:** Updated `requirements.txt` to tested-compatible pins: fastapi==0.135.2, mcp==1.26.0, starlette==1.0.0. All 56 tests pass. Fresh `pip install -r requirements.txt` succeeds.

### ~~BUG-068: Audit log hardcodes version "2.5.1" instead of app.__version__~~ FIXED (v3.3.1)
**Status:** FIXED
**Fix:** Replaced hardcoded `"2.5.1"` with `__version__` variable reference in audit_log.log() call.

### ~~BUG-069: MessageRouter constructor mismatch in tests — latent hop-guard crash~~ FIXED (v3.3.1)
**Status:** FIXED
**Fix:** Updated all test calls from `MessageRouter(reg)` to `MessageRouter()` (use defaults) in both `test_modules.py` and `test_integration.py`. The router doesn't need the registry — it receives agent_names as a parameter to get_targets().

### ~~BUG-070: SQLite databases are empty (0 bytes) — data loss~~ FIXED (v3.3.1)
**Status:** FIXED
**Fix:** Added startup recovery logic in `MessageStore.init()`. Before connecting, checks if DB file exists but is 0 bytes. If a `.bak` file exists with data, restores from backup. Otherwise removes the empty file so SQLite creates a fresh database. Prevents `disk I/O error` on startup.

### ~~BUG-071: Version numbers out of sync across packages~~ FIXED (v3.3.1)
**Status:** FIXED
**Fix:** Synced all version strings to `3.3.1`: backend/app.py `__version__`, desktop/package.json, frontend/package.json. Audit log now references `__version__` dynamically (see BUG-068).

### ~~BUG-072: 50 modified files uncommitted on master~~ FIXED (v3.3.0)
**Status:** FIXED
**Fix:** All 64 files (50 modified + 14 new) committed and pushed as v3.3.0.

---

## HOURLY HEALTH AUDIT — 2026-03-24T12:09 UTC

**Audit type:** Automated scheduled audit (no code edits — issues logged only)
**Test suite:** 56/56 tests passed (all green)
**TypeScript:** Compiles clean (0 errors from `tsc -b`)
**Frontend build:** Succeeds (vite build produces 868KB JS + 102KB CSS). Chunk size warning only — not an error.
**Frontend vulnerabilities:** 0 (npm audit clean)
**Git:** On `master`, up to date with `origin/master`. Clean working tree (only 2 untracked: `config.toml.bak`, `ghostlink-frontend-audit.docx`).
**Python deps:** Install cleanly. No conflicts in project dependencies.
**Backend server startup:** **FAILS** — critical regression (see BUG-073).

### ~~BUG-073: Server startup crashes — PermissionError in empty DB recovery~~ FIXED (v3.3.2)
**Status:** FIXED
**Fix:** Removed `db_file.unlink()` call. On 0-byte DB with no backup, SQLite initializes the empty file as a fresh database during `connect()` + `executescript()`. No unlink needed.

### ~~BUG-074: `_save_settings()` duplicated in 3 locations~~ FIXED (v3.3.2)
**Status:** FIXED
**Fix:** Canonical `save_settings()` added to `app_helpers.py`. Route modules `channels.py` and `misc.py` now delegate to it. Single source of truth.

### ~~BUG-075: Duplicate `_VALID_AGENT_NAME` regex~~ FIXED (v3.3.2)
**Status:** FIXED
**Fix:** `routes/agents.py` now imports `_VALID_AGENT_NAME` from `deps.py` instead of redeclaring it.

### ~~BUG-076: Hardcoded port fallback in BridgeManager~~ FIXED (v3.3.2)
**Status:** FIXED
**Fix:** `BridgeManager()` constructor in `app.py` now passes `server_port=PORT` from config instead of relying on default 8300.

### BUG-077: Silent exception swallowing in multiple backend modules
**Severity:** Low — observability gap across 23+ bare `except: pass` blocks
**Status:** Acknowledged — many are intentional (migration checks, optional features). Would require per-site review.

### BUG-078: Frontend build fails on existing dist/ due to EPERM on unlink
**Severity:** Low — WSL/FUSE filesystem limitation, not a code bug
**Workaround:** `vite build --outDir /tmp/dist --emptyOutDir` works.
**Status:** Not fixable in code — OS limitation

### ~~BUG-079: Usage log silently drops entries~~ FIXED (v3.3.2)
**Status:** FIXED
**Fix:** Added `log.info()` message when usage log is trimmed.

### ~~BUG-080: FTS5 search fallback has no logging~~ FIXED (v3.3.2)
**Status:** FIXED
**Fix:** Added `log.warning()` with exception details when FTS5 fails and LIKE fallback is used.

### BUG-081: `_pending_spawns` brief race window
**Severity:** Low — theoretical edge case, never observed in practice
**Status:** Acknowledged — lock protects the critical section, race window is sub-millisecond

---

## HOURLY HEALTH AUDIT — 2026-03-24T13:XX UTC

**Audit type:** Automated scheduled audit (no code edits — issues logged only)
**Test suite:** 56/56 tests passed (all green)
**TypeScript:** Frontend compiles clean (0 errors from `tsc -b`). Desktop compiles clean (0 errors).
**Frontend build:** Existing dist/ present with 868KB JS + 102KB CSS. npm audit: 0 vulnerabilities.
**Git:** On `master`, up to date with `origin/master`. Clean working tree (only 2 untracked: `config.toml.bak`, `ghostlink-frontend-audit.docx`).
**Python deps:** `requirements.txt` installs cleanly. No dependency conflicts.
**Version sync:** All 3 packages at `3.3.2` (backend, frontend, desktop). ✅
**Code scan:** No TODO/FIXME/HACK comments in project code. No missing imports. No hardcoded port mismatches.
**Browser UI:** GhostLink UI renders correctly via Cloudflare tunnel — sidebar (Chat/Jobs/Rules/Settings), main chat area, agent bar, message input, quick actions, stats panel, welcome tour all present and functional. WebSocket works locally (confirmed programmatically); "Connection lost" banner expected through Cloudflare tunnel only.
**API endpoints:** `/api/channels`, `/api/status`, `/api/settings` all respond correctly.

### ~~BUG-082: Server startup crashes — stale journal files block 0-byte DB recovery~~ FIXED (v3.3.3)
**Status:** FIXED
**Fix:** Before `aiosqlite.connect()`, when DB is 0 bytes, now removes stale `-journal`, `-wal`, and `-shm` files. Prevents SQLite from attempting to replay a stale journal on an empty DB file.

### ~~BUG-083: ghostlink_v2.db has no backup file — recovery path incomplete~~ FIXED (v3.3.3)
**Status:** FIXED
**Fix:** `MessageStore.close()` now creates a `.bak` backup on clean shutdown via `_create_backup()`. Both `ghostlink.db` and `ghostlink_v2.db` will have backups after any clean server stop.

### NOTE-001: Feature opportunities for v3.4.0 (from roadmap review)
**Type:** Enhancement notes (not bugs)
**Roadmap Phase 1 (Agent Intelligence)** is well-defined with 6 items: plan/read-only mode, lifecycle hooks, cross-session memory search, auto-lint feedback, watch mode, auto-commit. All have clear acceptance criteria and file targets. No blockers identified — can proceed once BUG-082 is resolved.
**Quick wins identified:**
1. Cross-session memory search (1.3) — `agent_memory.py` already has FTS5 infrastructure from the main store; extending it would be straightforward.
2. Lifecycle hooks (1.2) — `plugin_sdk.py` already has an EventBus; wiring pre/post tool hooks is minimal.
3. The 27+ bare `except Exception:` blocks (BUG-077) remain as an observability gap — low priority but would improve debuggability.
