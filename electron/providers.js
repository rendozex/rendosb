const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');

const DEFAULT_GROK_PATH = path.join(os.homedir(), '.grok', 'bin', process.platform === 'win32' ? 'grok.exe' : 'grok');

function resolveGrokPath() {
  if (process.env.GROK_PATH && fs.existsSync(process.env.GROK_PATH)) {
    return process.env.GROK_PATH;
  }
  if (fs.existsSync(DEFAULT_GROK_PATH)) {
    return DEFAULT_GROK_PATH;
  }
  return 'grok';
}

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { windowsHide: true });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(err || out || `Exit ${code}`));
    });
    proc.on('error', reject);
  });
}

function parseGrokModelsOutput(out) {
  const models = [];
  let defaultModel = null;

  for (const line of out.split(/\r?\n/)) {
    const defaultMatch = line.match(/Default model:\s*(\S+)/i);
    if (defaultMatch) defaultModel = defaultMatch[1].trim();

    // Grok CLI lists models with "-" or marks the default with "*"
    const modelMatch = line.match(/^\s*[-*]\s+(\S+)/);
    if (modelMatch) {
      models.push(modelMatch[1].replace(/\*$/, '').trim());
    }
  }

  const unique = [...new Set(models)];
  if (!unique.length) {
    return {
      default: 'grok-composer-2.5-fast',
      models: ['grok-composer-2.5-fast', 'grok-build'],
    };
  }

  const resolvedDefault = defaultModel || unique[0];
  if (resolvedDefault && !unique.includes(resolvedDefault)) {
    unique.unshift(resolvedDefault);
  }

  const ordered = [
    resolvedDefault,
    ...unique.filter((m) => m !== resolvedDefault),
  ].filter(Boolean);

  return { default: resolvedDefault, models: ordered };
}

async function listGrokModels() {
  try {
    const out = await runCommand(resolveGrokPath(), ['models']);
    return parseGrokModelsOutput(out);
  } catch {
    return {
      default: 'grok-composer-2.5-fast',
      models: ['grok-composer-2.5-fast', 'grok-build'],
    };
  }
}

function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function listOllamaModels(baseUrl) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/tags`;
  const res = await httpRequest(url, { method: 'GET', headers: { Accept: 'application/json' } });
  if (res.statusCode >= 400) {
    throw new Error(`Cannot reach Ollama at ${baseUrl}. Is Docker running?`);
  }
  const parsed = JSON.parse(res.body || '{}');
  const models = (parsed.models || []).map((m) => m.name).filter(Boolean);
  if (!models.length) {
    throw new Error('No models found. Run: ollama pull llama3.2');
  }
  return { default: models[0], models };
}

function spawnGrok(options, onEvent) {
  const {
    prompt,
    sessionId = null,
    cwd = process.cwd(),
    model = null,
    permissionMode = 'bypassPermissions',
    maxTurns = 25,
  } = options;

  const grokPath = resolveGrokPath();
  const args = [
    '-p', prompt,
    '--output-format', 'streaming-json',
    '--permission-mode', permissionMode,
    '--max-turns', String(maxTurns),
    '--cwd', cwd,
  ];
  if (model) args.push('-m', model);
  if (sessionId) args.push('-r', sessionId);

  const proc = spawn(grokPath, args, { cwd, windowsHide: true, env: { ...process.env } });
  let buffer = '';
  let resultSessionId = sessionId;
  let stopReason = null;

  const handleLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const event = JSON.parse(trimmed);
      onEvent(event);
      if (event.type === 'end') {
        resultSessionId = event.sessionId || resultSessionId;
        stopReason = event.stopReason || null;
      }
    } catch {
      onEvent({ type: 'raw', data: trimmed });
    }
  };

  proc.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) handleLine(line);
  });

  proc.stderr.on('data', (chunk) => {
    onEvent({ type: 'stderr', data: chunk.toString() });
  });

  return {
    process: proc,
    finalize: () => {
      if (buffer.trim()) handleLine(buffer);
      return { sessionId: resultSessionId, stopReason };
    },
  };
}

async function streamOllama(options, onEvent) {
  const {
    prompt,
    model = 'llama3.2',
    ollamaUrl = 'http://127.0.0.1:11434',
    messages = [],
  } = options;

  const url = `${ollamaUrl.replace(/\/$/, '')}/api/chat`;
  const body = JSON.stringify({
    model,
    stream: true,
    messages: [...messages, { role: 'user', content: prompt }],
  });

  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      if (res.statusCode >= 400) {
        let errBody = '';
        res.on('data', (c) => { errBody += c; });
        res.on('end', () => reject(new Error(`Ollama ${res.statusCode}: ${errBody.slice(0, 200)}`)));
        return;
      }

      let buffer = '';
      let fullText = '';

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed);
            const piece = event.message?.content || '';
            if (piece) {
              fullText += piece;
              onEvent({ type: 'text', data: piece });
            }
            if (event.done) {
              onEvent({ type: 'end', stopReason: 'EndTurn', sessionId: null });
            }
          } catch { /* ignore */ }
        }
      });

      res.on('end', () => {
        resolve({ sessionId: null, stopReason: 'EndTurn', fullText });
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  resolveGrokPath,
  listGrokModels,
  parseGrokModelsOutput,
  listOllamaModels,
  spawnGrok,
  streamOllama,
};