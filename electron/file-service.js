const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'release', 'dist', 'out', '.grok',
  '__pycache__', '.venv', 'venv', '.next', 'build',
]);

const IGNORE_FILES = new Set(['.DS_Store', 'Thumbs.db']);

let watchState = null;

function isIgnored(name) {
  return name.startsWith('.') && name !== '.env' && name !== '.gitignore';
}

function resolveWorkspaceRoot(rootDir) {
  if (!rootDir || typeof rootDir !== 'string') {
    throw new Error('No workspace directory selected');
  }
  const resolved = path.resolve(rootDir.trim());
  if (!fs.existsSync(resolved)) {
    throw new Error('Workspace directory does not exist');
  }
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error('Workspace path is not a directory');
  }
  return resolved;
}

function isInsideRoot(rootDir, targetPath) {
  const root = path.resolve(rootDir);
  const target = path.resolve(targetPath);
  const rel = path.relative(root, target);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function listWorkspaceFiles(rootDir, maxDepth = 8) {
  const resolvedRoot = resolveWorkspaceRoot(rootDir);
  const results = [];

  function walk(dir, depth, relBase) {
    if (depth > maxDepth) return;
    if (!isInsideRoot(resolvedRoot, dir) && path.resolve(dir) !== resolvedRoot) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) {
        return a.isDirectory() ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name) || IGNORE_FILES.has(entry.name)) continue;
      if (isIgnored(entry.name)) continue;

      const full = path.join(dir, entry.name);
      if (!isInsideRoot(resolvedRoot, full)) continue;

      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        results.push({ path: rel, name: entry.name, type: 'directory' });
        walk(full, depth + 1, rel);
      } else if (entry.isFile()) {
        let size = 0;
        let mtime = 0;
        try {
          const stat = fs.statSync(full);
          size = stat.size;
          mtime = stat.mtimeMs;
        } catch { /* ignore */ }
        results.push({ path: rel, name: entry.name, type: 'file', size, mtime });
      }
    }
  }

  walk(resolvedRoot, 0, '');
  return { root: resolvedRoot, files: results };
}

function readWorkspaceFile(rootDir, relPath) {
  const resolvedRoot = resolveWorkspaceRoot(rootDir);
  const full = path.resolve(resolvedRoot, relPath);
  if (!isInsideRoot(resolvedRoot, full)) {
    throw new Error('Path outside workspace');
  }
  const content = fs.readFileSync(full, 'utf8');
  const stat = fs.statSync(full);
  return { path: relPath, content, mtime: stat.mtimeMs, size: stat.size };
}

function stopWatching() {
  if (!watchState) return;
  if (watchState.watcher) {
    try { watchState.watcher.close(); } catch { /* ignore */ }
  }
  if (watchState.pollTimer) {
    clearInterval(watchState.pollTimer);
  }
  watchState = null;
}

function startWatching(rootDir, onChange, pollMs = 400) {
  stopWatching();
  const resolvedRoot = resolveWorkspaceRoot(rootDir);
  let lastSnapshot = new Map();

  const snapshot = () => {
    const { files } = listWorkspaceFiles(resolvedRoot);
    const map = new Map();
    for (const f of files) {
      if (f.type === 'file') map.set(f.path, f.mtime);
    }
    return map;
  };

  const emitChange = (changed, created, deleted) => {
    const listing = listWorkspaceFiles(resolvedRoot);
    onChange({
      root: resolvedRoot,
      changed,
      created,
      deleted,
      files: listing.files,
    });
  };

  const diffAndEmit = () => {
    if (!watchState || watchState.rootDir !== resolvedRoot) return;

    const next = snapshot();
    const changed = [];
    const created = [];
    const deleted = [];

    for (const [p, mtime] of next) {
      if (!lastSnapshot.has(p)) {
        created.push(p);
        changed.push(p);
      } else if (lastSnapshot.get(p) !== mtime) {
        changed.push(p);
      }
    }
    for (const p of lastSnapshot.keys()) {
      if (!next.has(p)) deleted.push(p);
    }

    if (changed.length || created.length || deleted.length) {
      emitChange(changed, created, deleted);
    }
    lastSnapshot = next;
  };

  lastSnapshot = snapshot();

  let watcher = null;
  try {
    watcher = fs.watch(resolvedRoot, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const full = path.join(resolvedRoot, filename);
      if (isInsideRoot(resolvedRoot, full) || full === resolvedRoot) {
        diffAndEmit();
      }
    });
  } catch {
    watcher = null;
  }

  const pollTimer = setInterval(diffAndEmit, pollMs);
  watchState = { watcher, pollTimer, rootDir: resolvedRoot };
  return resolvedRoot;
}

module.exports = {
  resolveWorkspaceRoot,
  listWorkspaceFiles,
  readWorkspaceFile,
  startWatching,
  stopWatching,
};