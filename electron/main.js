const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');
const {
  listWorkspaceFiles,
  readWorkspaceFile,
  startWatching,
  stopWatching,
} = require('./file-service');
const {
  resolveGrokPath,
  listGrokModels,
  listOllamaModels,
  spawnGrok,
  streamOllama,
} = require('./providers');

let mainWindow = null;
let activeProcess = null;
let activeOllamaAbort = null;

function getWindow() {
  return mainWindow;
}

function send(channel, payload) {
  const win = getWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

function killActiveProcess() {
  if (activeOllamaAbort) {
    activeOllamaAbort.aborted = true;
    activeOllamaAbort = null;
  }
  if (!activeProcess) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(activeProcess.pid), '/f', '/t'], { stdio: 'ignore' });
    } else {
      activeProcess.kill('SIGTERM');
    }
  } catch { /* ignore */ }
  activeProcess = null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 650,
    backgroundColor: '#181818',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

ipcMain.handle('grok:get-info', async () => {
  const grokPath = resolveGrokPath();
  let version = 'unknown';
  try {
    version = await new Promise((resolve, reject) => {
      const proc = spawn(grokPath, ['--version'], { windowsHide: true });
      let out = '';
      proc.stdout.on('data', (d) => { out += d.toString(); });
      proc.stderr.on('data', (d) => { out += d.toString(); });
      proc.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject()));
      proc.on('error', reject);
    });
  } catch {
    version = 'not found';
  }
  const grokModels = await listGrokModels();
  return {
    grokPath,
    version,
    platform: process.platform,
    defaultCwd: null,
    grokModels,
  };
});

ipcMain.handle('models:list', async (_event, { provider, ollamaUrl }) => {
  if (provider === 'ollama') {
    return listOllamaModels(ollamaUrl || 'http://127.0.0.1:11434');
  }
  return listGrokModels();
});

ipcMain.handle('theme:set-background', async (_event, color) => {
  const win = getWindow();
  if (win && !win.isDestroyed() && typeof color === 'string') {
    win.setBackgroundColor(color);
  }
  return true;
});

ipcMain.handle('dialog:select-directory', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    app.focus({ steal: true });
  }
  const result = await dialog.showOpenDialog(win || undefined, {
    title: 'Select Working Directory',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Select Folder',
    defaultPath: os.homedir(),
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('shell:open-external', async (_event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('fs:list', async (_event, cwd) => {
  if (!cwd) return { root: null, files: [] };
  return listWorkspaceFiles(cwd);
});

ipcMain.handle('fs:read', async (_event, { cwd, filePath }) => {
  return readWorkspaceFile(cwd, filePath);
});

ipcMain.handle('fs:watch', async (_event, cwd) => {
  if (!cwd) return false;
  startWatching(cwd, (payload) => send('fs:change', payload));
  return true;
});

ipcMain.handle('fs:unwatch', async () => {
  stopWatching();
  return true;
});

ipcMain.handle('grok:send', async (_event, options) => {
  const {
    prompt,
    provider = 'grok',
    sessionId = null,
    cwd = process.cwd(),
    model = null,
    permissionMode = 'bypassPermissions',
    maxTurns = 25,
    ollamaUrl = 'http://127.0.0.1:11434',
    messages = [],
  } = options;

  if (!prompt || !prompt.trim()) throw new Error('Prompt is required');

  killActiveProcess();

  if (provider === 'ollama') {
    activeOllamaAbort = { aborted: false };
    const abort = activeOllamaAbort;
    try {
      const result = await streamOllama(
        { prompt, model, ollamaUrl, messages },
        (event) => { if (!abort.aborted) send('grok:stream', event); },
      );
      activeOllamaAbort = null;
      return result;
    } catch (err) {
      activeOllamaAbort = null;
      throw err;
    }
  }

  return new Promise((resolve, reject) => {
    const session = spawnGrok(
      { prompt, sessionId, cwd, model, permissionMode, maxTurns },
      (event) => send('grok:stream', event),
    );
    activeProcess = session.process;

    session.process.on('error', (err) => {
      activeProcess = null;
      reject(err);
    });

    session.process.on('close', (code) => {
      activeProcess = null;
      const result = session.finalize();
      if (code !== 0 && code !== null) {
        reject(new Error(`Grok exited with code ${code}`));
        return;
      }
      resolve(result);
    });
  });
});

ipcMain.handle('grok:cancel', async () => {
  killActiveProcess();
  return true;
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopWatching();
  killActiveProcess();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopWatching();
  killActiveProcess();
});