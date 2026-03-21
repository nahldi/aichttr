/**
 * GhostLink — Electron Main Process Entry Point
 *
 * Orchestrates the launcher window, backend server lifecycle,
 * system tray, auto-updater, and chat browser window.
 *
 * On first run (no settings file), shows the setup wizard before the launcher.
 */

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import log from 'electron-log';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import os from 'os';

import { serverManager } from './server';
import { createLauncherWindow, getLauncherWindow } from './launcher';
import { setupTray, updateTrayMenu } from './tray';
import { setupUpdater, checkForUpdates, downloadUpdate, installUpdate } from './updater';
import authManager from './auth/index';

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.info('GhostLink starting — version', app.getVersion());

// ---------------------------------------------------------------------------
// Settings file path
// ---------------------------------------------------------------------------
function getSettingsPath(): string {
  const homeDir = os.homedir();
  const ghostlinkDir = path.join(homeDir, '.ghostlink');
  return path.join(ghostlinkDir, 'settings.json');
}

function settingsExist(): boolean {
  try {
    const settingsPath = getSettingsPath();
    if (!fs.existsSync(settingsPath)) return false;
    const data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    return data.setupComplete === true;
  } catch {
    return false;
  }
}

function saveSettings(settings: Record<string, any>): void {
  const settingsPath = getSettingsPath();
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  log.info('Settings saved to', settingsPath);
}

function loadSettings(): Record<string, any> | null {
  try {
    const settingsPath = getSettingsPath();
    if (!fs.existsSync(settingsPath)) return null;
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Single-instance lock — prevent multiple app instances
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  log.warn('Another instance is already running — quitting.');
  app.quit();
}

app.on('second-instance', () => {
  const launcher = getLauncherWindow();
  if (launcher) {
    if (launcher.isMinimized()) launcher.restore();
    launcher.show();
    launcher.focus();
  }
});

// ---------------------------------------------------------------------------
// Wizard window
// ---------------------------------------------------------------------------
let wizardWindow: BrowserWindow | null = null;

function createWizardWindow(): BrowserWindow {
  wizardWindow = new BrowserWindow({
    width: 520,
    height: 620,
    center: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#09090f',
    show: false,

    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hidden' as const }
      : { frame: false }),

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  wizardWindow.loadFile(path.join(__dirname, '..', 'renderer', 'wizard.html'));

  wizardWindow.once('ready-to-show', () => {
    wizardWindow?.show();
    log.info('Wizard window ready');
  });

  wizardWindow.on('closed', () => {
    wizardWindow = null;
  });

  return wizardWindow;
}

// ---------------------------------------------------------------------------
// Chat window
// ---------------------------------------------------------------------------
let chatWindow: BrowserWindow | null = null;

function createChatWindow(port: number): void {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.show();
    chatWindow.focus();
    return;
  }

  chatWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'GhostLink',
    backgroundColor: '#09090f',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  chatWindow.loadURL(`http://127.0.0.1:${port}`);

  chatWindow.once('ready-to-show', () => {
    chatWindow?.show();
    chatWindow?.focus();
    log.info('Chat window opened on port', port);
  });

  chatWindow.on('closed', () => {
    chatWindow = null;
  });
}

// ---------------------------------------------------------------------------
// Wizard IPC Handlers
// ---------------------------------------------------------------------------
function setupWizardIPC(): void {
  // ── Platform detection ────────────────────────────────────────────────
  ipcMain.handle('wizard:detect-platform', async () => {
    const platform = process.platform;
    let detectedPlatform = 'linux';
    let platformLabel = 'Linux';
    let wslAvailable = false;

    if (platform === 'win32') {
      detectedPlatform = 'windows';
      platformLabel = 'Windows (Native)';

      // Check if WSL is available
      try {
        execSync('wsl --status', { timeout: 5000, stdio: 'pipe' });
        wslAvailable = true;
        detectedPlatform = 'wsl';
        platformLabel = 'Windows (WSL)';
      } catch {
        wslAvailable = false;
      }
    } else if (platform === 'darwin') {
      detectedPlatform = 'macos';
      platformLabel = 'macOS';
    }

    return { platform: detectedPlatform, platformLabel, wslAvailable };
  });

  // ── Python detection ──────────────────────────────────────────────────
  ipcMain.handle('wizard:detect-python', async () => {
    let pythonPath = '';
    let version = '';
    let found = false;
    let depsInstalled = false;

    // Try python3 first, then python
    const candidates = ['python3', 'python'];
    for (const cmd of candidates) {
      try {
        const output = execSync(`${cmd} --version`, {
          timeout: 10000,
          stdio: 'pipe',
          encoding: 'utf-8',
        }).trim();
        // Output is like "Python 3.10.11"
        const match = output.match(/Python\s+([\d.]+)/);
        if (match) {
          const ver = match[1];
          const parts = ver.split('.').map(Number);
          if (parts[0] >= 3 && parts[1] >= 10) {
            pythonPath = cmd;
            version = ver;
            found = true;
            break;
          }
        }
      } catch {
        // Not found, try next
      }
    }

    if (found && pythonPath) {
      // Check if fastapi is installed (key dep)
      try {
        execSync(`${pythonPath} -c "import fastapi"`, {
          timeout: 10000,
          stdio: 'pipe',
        });
        depsInstalled = true;
      } catch {
        depsInstalled = false;
      }
    }

    return { found, pythonPath, version, depsInstalled };
  });

  // ── Install dependencies ──────────────────────────────────────────────
  ipcMain.handle('wizard:install-deps', async () => {
    try {
      // Find requirements.txt relative to the app
      const appDir = app.isPackaged
        ? path.join(process.resourcesPath, 'app')
        : path.join(__dirname, '..', '..');

      const reqPath = path.join(appDir, 'requirements.txt');

      if (!fs.existsSync(reqPath)) {
        log.warn('requirements.txt not found at', reqPath);
        return { success: false, error: 'requirements.txt not found' };
      }

      execSync(`pip install -r "${reqPath}"`, {
        timeout: 120000,
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      return { success: true };
    } catch (err: any) {
      log.error('wizard:install-deps failed:', err);
      return { success: false, error: err.message ?? String(err) };
    }
  });

  // ── Folder picker ─────────────────────────────────────────────────────
  ipcMain.handle('wizard:pick-folder', async () => {
    const win = wizardWindow;
    if (!win || win.isDestroyed()) return null;

    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Default Workspace',
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const folderPath = result.filePaths[0];
      win.webContents.send('wizard:folder-picked', folderPath);
      return folderPath;
    }
    return null;
  });

  // ── Complete wizard ───────────────────────────────────────────────────
  ipcMain.handle('wizard:complete', async (_event, settings: Record<string, any>) => {
    log.info('Wizard complete — saving settings');

    // Ensure setupComplete is set
    settings.setupComplete = true;

    // Save settings to ~/.ghostlink/settings.json
    saveSettings(settings);

    // Close wizard window
    if (wizardWindow && !wizardWindow.isDestroyed()) {
      wizardWindow.destroy();
      wizardWindow = null;
    }

    // Now open the launcher
    const launcher = createLauncherWindow();
    setupTray(launcher);
    setupUpdater(launcher);
    checkForUpdates().catch((err) => {
      log.warn('Initial update check failed:', err.message ?? err);
    });

    return { success: true };
  });
}

// ---------------------------------------------------------------------------
// IPC Handlers (launcher + app)
// ---------------------------------------------------------------------------
function setupIPC(): void {
  // ── Server lifecycle ──────────────────────────────────────────────────
  ipcMain.handle('server:start', async () => {
    try {
      const result = await serverManager.start();
      if (result.success) {
        const launcher = getLauncherWindow();
        if (launcher && !launcher.isDestroyed()) {
          launcher.webContents.send('server:started', result.port);
        }
        updateTrayMenu(true);
      }
      return result;
    } catch (err: any) {
      log.error('server:start failed:', err);
      return { success: false, error: err.message ?? String(err) };
    }
  });

  ipcMain.handle('server:stop', async () => {
    try {
      await serverManager.stop();
      updateTrayMenu(false);
      const launcher = getLauncherWindow();
      if (launcher && !launcher.isDestroyed()) {
        launcher.webContents.send('server:stopped');
      }
      return { success: true };
    } catch (err: any) {
      log.error('server:stop failed:', err);
      return { success: false, error: err.message ?? String(err) };
    }
  });

  ipcMain.handle('server:status', () => {
    return serverManager.getStatus();
  });

  // ── Auth ──────────────────────────────────────────────────────────────
  ipcMain.handle('auth:check', async () => {
    try {
      const statuses = await authManager.checkAll();
      return statuses;
    } catch (err: any) {
      log.error('auth:check failed:', err);
      return [];
    }
  });

  ipcMain.handle('auth:check-all', async () => {
    try {
      const statuses = await authManager.checkAll();
      // Also push the result to the renderer for event-based listeners
      const launcher = getLauncherWindow();
      if (launcher && !launcher.isDestroyed()) {
        launcher.webContents.send('auth:status', statuses);
      }
      return statuses;
    } catch (err: any) {
      log.error('auth:check-all failed:', err);
      return [];
    }
  });

  ipcMain.handle('auth:login', async (_event, provider: string) => {
    log.info('auth:login requested for provider:', provider);
    try {
      await authManager.login(provider);
      return { success: true };
    } catch (err: any) {
      log.error('auth:login failed:', err);
      return { success: false, error: err.message ?? String(err) };
    }
  });

  // ── Updates ───────────────────────────────────────────────────────────
  ipcMain.handle('update:check', async () => {
    try {
      await checkForUpdates();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message ?? String(err) };
    }
  });

  ipcMain.handle('update:install', () => {
    installUpdate();
  });

  ipcMain.handle('update:download', async () => {
    try {
      await downloadUpdate();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message ?? String(err) };
    }
  });

  // ── App-level ─────────────────────────────────────────────────────────
  ipcMain.handle('app:open-chat', () => {
    const status = serverManager.getStatus();
    if (!status.running) {
      log.warn('app:open-chat — server is not running');
      return { success: false, error: 'Server is not running' };
    }
    createChatWindow(status.port);
    return { success: true };
  });

  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:pick-folder', async () => {
    const launcher = getLauncherWindow();
    if (!launcher || launcher.isDestroyed()) return null;

    const result = await dialog.showOpenDialog(launcher, {
      properties: ['openDirectory'],
      title: 'Select Default Workspace',
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const folderPath = result.filePaths[0];
      launcher.webContents.send('app:folder-picked', folderPath);
      return folderPath;
    }
    return null;
  });

  ipcMain.handle('app:save-settings', (_event, settings: Record<string, any>) => {
    log.info('Settings saved:', settings);
    saveSettings(settings);
    return { success: true };
  });

  // ── Window controls (titlebar) ────────────────────────────────────────
  ipcMain.handle('window:minimize', () => {
    // Minimize whichever window is focused (wizard or launcher)
    const win = wizardWindow ?? getLauncherWindow();
    if (win && !win.isDestroyed()) {
      win.minimize();
    }
  });

  ipcMain.handle('window:close', () => {
    const win = wizardWindow ?? getLauncherWindow();
    if (win && !win.isDestroyed()) {
      win.close();
    }
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
let isQuitting = false;

app.whenReady().then(async () => {
  log.info('Electron app ready');

  // Wire up IPC (always needed — both wizard and launcher use shared channels)
  setupWizardIPC();
  setupIPC();

  // Check if first run
  if (settingsExist()) {
    log.info('Settings found — skipping wizard, launching normally');
    const launcher = createLauncherWindow();
    setupTray(launcher);
    setupUpdater(launcher);
    checkForUpdates().catch((err) => {
      log.warn('Initial update check failed:', err.message ?? err);
    });
  } else {
    log.info('No settings found — showing setup wizard');
    createWizardWindow();
  }
});

// Keep the app alive when all windows close (tray keeps running)
app.on('window-all-closed', () => {
  // Do nothing — tray keeps the app running
});

// Graceful shutdown: stop the backend before quitting
app.on('before-quit', async (event) => {
  if (!isQuitting) {
    isQuitting = true;
    event.preventDefault();
    log.info('Shutting down — stopping backend server...');
    try {
      await serverManager.stop();
    } catch (err) {
      log.error('Error stopping server during quit:', err);
    }
    app.quit();
  }
});
