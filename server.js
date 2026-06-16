const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { URL } = require('url');
const {
  listWorkspaceFiles,
  readWorkspaceFile,
  startWatching,
  stopWatching,
} = require('./electron/file-service');
const {
  resolveGrokPath,
  listGrokModels,
  listOllamaModels,
  spawnGrok,
  streamOllama,
} = require('./electron/providers');
const { pickDirectory } = require('./electron/folder-picker');

const PORT = Number(process.env.PORT) || 3847;
const ROOT = path.join(__dirname, 'renderer');

let activeProcess = null;
let activeOllamaAbort = null;
const sseClients = new Set();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

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

function broadcastFileChange(payload) {
  for (const client of sseClients) {
    client.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let filePath = path.join(ROOT, decodeURIComponent(url.pathname));
  if (url.pathname === '/' || url.pathname === '') {
    filePath = path.join(ROOT, 'index.html');
  }
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

async function runSendStream(options, res) {
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

  killActiveProcess();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const emit = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  if (provider === 'ollama') {
    activeOllamaAbort = { aborted: false };
    try {
      const result = await streamOllama(
        { prompt, model, ollamaUrl, messages },
        (event) => { if (!activeOllamaAbort?.aborted) emit(event); },
      );
      emit({ type: 'done', code: 0, sessionId: result.sessionId, stopReason: result.stopReason });
    } catch (err) {
      emit({ type: 'error', message: err.message });
    } finally {
      activeOllamaAbort = null;
      res.end();
    }
    return;
  }

  const session = spawnGrok(
    { prompt, sessionId, cwd, model, permissionMode, maxTurns },
    emit,
  );
  activeProcess = session.process;

  session.process.on('close', (code) => {
    const result = session.finalize();
    emit({ type: 'done', code, sessionId: result.sessionId, stopReason: result.stopReason });
    activeProcess = null;
    res.end();
  });

  session.process.on('error', (err) => {
    emit({ type: 'error', message: err.message });
    activeProcess = null;
    res.end();
  });

  res.on('close', () => killActiveProcess());
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (url.pathname === '/api/info' && req.method === 'GET') {
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
    sendJson(res, 200, {
      grokPath, version, platform: process.platform,
      defaultCwd: null, grokModels,
    });
    return;
  }

  if (url.pathname === '/api/models' && req.method === 'GET') {
    const provider = url.searchParams.get('provider') || 'grok';
    const ollamaUrl = url.searchParams.get('ollamaUrl') || 'http://127.0.0.1:11434';
    try {
      const data = provider === 'ollama'
        ? await listOllamaModels(ollamaUrl)
        : await listGrokModels();
      sendJson(res, 200, data);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (url.pathname === '/api/files' && req.method === 'GET') {
    const cwd = url.searchParams.get('cwd');
    if (!cwd) {
      sendJson(res, 200, { root: null, files: [] });
      return;
    }
    try {
      sendJson(res, 200, listWorkspaceFiles(cwd));
    } catch (err) {
      sendJson(res, 400, { error: err.message, root: null, files: [] });
    }
    return;
  }

  if (url.pathname === '/api/file' && req.method === 'GET') {
    const cwd = url.searchParams.get('cwd');
    const filePath = url.searchParams.get('path');
    try {
      sendJson(res, 200, readWorkspaceFile(cwd, filePath));
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (url.pathname === '/api/watch' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req));
    startWatching(body.cwd, broadcastFileChange);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/unwatch' && req.method === 'POST') {
    stopWatching();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/files/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    sseClients.add(res);
    res.on('close', () => sseClients.delete(res));
    return;
  }

  if (url.pathname === '/api/cancel' && req.method === 'POST') {
    killActiveProcess();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/select-directory' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const parsed = body ? JSON.parse(body) : {};
      const selected = pickDirectory({ defaultPath: parsed.defaultPath });
      sendJson(res, 200, { path: selected });
    } catch (err) {
      sendJson(res, 500, { error: err.message || 'Could not open folder picker' });
    }
    return;
  }

  if (url.pathname === '/api/send' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req));
    await runSendStream(body, res);
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    try {
      await handleApi(req, res);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`RendoSB running at http://127.0.0.1:${PORT}`);
});

process.on('SIGINT', () => {
  stopWatching();
  killActiveProcess();
  process.exit(0);
});