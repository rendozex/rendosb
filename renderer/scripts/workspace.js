(() => {
  'use strict';

  const ws = {
    cwd: '',
    files: [],
    openTabs: [],
    activeFile: null,
    liveFiles: new Set(),
    pollTimer: null,
    fileContents: new Map(),
  };

  const $ = (id) => document.getElementById(id);

  function normalizePath(p) {
    return (p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  }

  function samePath(a, b) {
    return normalizePath(a) === normalizePath(b);
  }

  function basename(dir) {
    const n = (dir || '').replace(/\\/g, '/').replace(/\/+$/, '');
    const parts = n.split('/');
    return parts[parts.length - 1] || n;
  }

  function updateExplorerHeader(cwd) {
    const label = $('explorer-root-label');
    if (!label) return;
    if (!cwd) {
      label.textContent = 'No folder selected';
      label.title = '';
      return;
    }
    label.textContent = basename(cwd);
    label.title = cwd;
  }

  function clearWorkspaceView() {
    ws.files = [];
    ws.openTabs = [];
    ws.activeFile = null;
    ws.fileContents.clear();
    ws.liveFiles.clear();
    renderExplorer();
    renderTabs();
    renderEditor();
    updateExplorerHeader('');
  }

  function getLang(ext) {
    const map = {
      '.js': 'javascript', '.ts': 'typescript', '.py': 'python',
      '.html': 'html', '.css': 'css', '.json': 'json',
      '.md': 'markdown', '.rs': 'rust', '.go': 'go',
    };
    return map[ext] || 'text';
  }

  function highlightCode(code, lang) {
    let escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    if (lang === 'python' || lang === 'javascript' || lang === 'typescript') {
      escaped = escaped.replace(/(\/\/.*$|#.*$)/gm, '<span class="cmt">$1</span>');
      escaped = escaped.replace(/('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g, '<span class="str">$1</span>');
      escaped = escaped.replace(/\b(function|const|let|var|import|from|export|class|def|return|if|else|for|while|async|await|print)\b/g, '<span class="kw">$1</span>');
    }
    return escaped;
  }

  function buildTree(files) {
    const root = { children: new Map(), type: 'directory' };
    for (const f of files) {
      const parts = f.path.split('/').filter(Boolean);
      let node = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        if (!node.children.has(part)) {
          node.children.set(part, {
            name: part,
            path: parts.slice(0, i + 1).join('/'),
            type: isLast ? f.type : 'directory',
            children: new Map(),
          });
        }
        node = node.children.get(part);
      }
    }
    return root;
  }

  function renderTreeNode(node, depth = 0) {
    const frag = document.createDocumentFragment();
    const sorted = [...node.children.values()].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const child of sorted) {
      const el = document.createElement('div');
      const isDir = child.type === 'directory';
      const isLive = !isDir && ws.liveFiles.has(child.path);
      const isActive = ws.activeFile === child.path;
      el.className = `file-tree-item ${isDir ? 'dir' : 'file'}${isLive ? ' live' : ''}${isActive ? ' active' : ''}`;
      el.style.paddingLeft = `${12 + depth * 14}px`;
      el.innerHTML = `
        <span class="icon">${isDir ? '📁' : '📄'}</span>
        <span class="name">${child.name}</span>
      `;
      if (!isDir) {
        el.addEventListener('click', () => openFile(child.path));
      }
      frag.appendChild(el);
      if (isDir && child.children.size) {
        frag.appendChild(renderTreeNode(child, depth + 1));
      }
    }
    return frag;
  }

  function renderExplorer() {
    const tree = $('file-tree');
    if (!tree) return;
    tree.innerHTML = '';

    if (!ws.cwd) {
      tree.innerHTML = '<div class="empty-state">Select a folder in Settings to browse files</div>';
      return;
    }

    if (!ws.files.length) {
      tree.innerHTML = '<div class="empty-state">This folder is empty</div>';
      return;
    }

    const root = buildTree(ws.files);
    tree.appendChild(renderTreeNode(root));
  }

  function renderTabs() {
    const tabs = $('editor-tabs');
    if (!tabs) return;
    tabs.innerHTML = '';
    for (const filePath of ws.openTabs) {
      const tab = document.createElement('div');
      const isActive = filePath === ws.activeFile;
      const isLive = ws.liveFiles.has(filePath);
      tab.className = `editor-tab${isActive ? ' active' : ''}${isLive ? ' live' : ''}`;
      tab.innerHTML = `
        ${isLive ? '<span class="tab-dot"></span>' : ''}
        <span>${filePath.split('/').pop()}</span>
        <span class="tab-close" data-path="${filePath}">×</span>
      `;
      tab.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-close')) {
          closeTab(filePath);
        } else {
          openFile(filePath, false);
        }
      });
      tabs.appendChild(tab);
    }
  }

  function renderEditor() {
    const gutter = $('editor-gutter');
    const code = $('editor-code');
    const empty = $('editor-empty');
    const banner = $('editor-live-banner');

    if (!ws.activeFile) {
      gutter.innerHTML = '';
      code.innerHTML = '';
      code?.classList.add('hidden');
      empty?.classList.remove('hidden');
      banner?.classList.remove('visible');
      return;
    }

    empty?.classList.add('hidden');
    code?.classList.remove('hidden');
    const content = ws.fileContents.get(ws.activeFile) || '';
    const lines = content.split('\n');
    const lang = getLang('.' + ws.activeFile.split('.').pop());

    gutter.innerHTML = lines.map((_, i) => `<div>${i + 1}</div>`).join('');
    code.innerHTML = highlightCode(content, lang);
    code.className = `editor-code lang-${lang}`;

    const isLive = ws.liveFiles.has(ws.activeFile);
    banner?.classList.toggle('visible', isLive);
    if (banner && isLive) {
      banner.textContent = `Writing ${ws.activeFile}…`;
    }
  }

  async function openFile(filePath, addTab = true) {
    if (!ws.cwd || !filePath) return;
    try {
      const data = await window.appAPI.readFile({ cwd: ws.cwd, filePath });
      ws.fileContents.set(filePath, data.content);
      ws.activeFile = filePath;
      if (addTab && !ws.openTabs.includes(filePath)) {
        ws.openTabs.push(filePath);
      }
      renderTabs();
      renderExplorer();
      renderEditor();
    } catch (err) {
      console.warn('Failed to open file', filePath, err);
    }
  }

  function closeTab(filePath) {
    ws.openTabs = ws.openTabs.filter((p) => p !== filePath);
    if (ws.activeFile === filePath) {
      ws.activeFile = ws.openTabs[ws.openTabs.length - 1] || null;
    }
    renderTabs();
    renderEditor();
  }

  function applyListing(result) {
    if (!result || !ws.cwd) {
      ws.files = [];
      return;
    }
    if (result.root && !samePath(result.root, ws.cwd)) {
      return;
    }
    ws.files = result.files || [];
  }

  async function refreshFiles() {
    if (!ws.cwd) {
      clearWorkspaceView();
      return;
    }
    try {
      const result = await window.appAPI.listFiles(ws.cwd);
      applyListing(result);
      renderExplorer();
    } catch (err) {
      ws.files = [];
      renderExplorer();
      console.warn('refreshFiles failed', err);
    }
  }

  async function reloadActiveFile() {
    if (!ws.activeFile || !ws.cwd) return;
    try {
      const data = await window.appAPI.readFile({ cwd: ws.cwd, filePath: ws.activeFile });
      ws.fileContents.set(ws.activeFile, data.content);
      renderEditor();
    } catch { /* ignore */ }
  }

  function handleFileChange(payload) {
    if (!ws.cwd) return;
    if (payload.root && !samePath(payload.root, ws.cwd)) return;

    if (payload.files) {
      ws.files = payload.files;
    }

    for (const p of payload.created || []) {
      ws.liveFiles.add(p);
      if (!ws.openTabs.includes(p)) ws.openTabs.push(p);
      openFile(p, false);
    }

    for (const p of payload.changed || []) {
      ws.liveFiles.add(p);
      if (!ws.activeFile) {
        openFile(p, true);
      } else if (p === ws.activeFile) {
        reloadActiveFile();
      } else if (!ws.openTabs.includes(p)) {
        ws.openTabs.push(p);
      }
    }

    renderExplorer();
    renderTabs();
  }

  function clearLiveFiles() {
    ws.liveFiles.clear();
    renderExplorer();
    renderTabs();
    renderEditor();
    $('editor-live-banner')?.classList.remove('visible');
  }

  function markStreaming(active) {
    if (active) {
      if (!ws.cwd) return;
      if (!ws.pollTimer) {
        ws.pollTimer = setInterval(async () => {
          if (!ws.cwd) return;
          await refreshFiles();
          if (ws.activeFile) await reloadActiveFile();
        }, 500);
      }
    } else {
      if (ws.pollTimer) {
        clearInterval(ws.pollTimer);
        ws.pollTimer = null;
      }
      setTimeout(clearLiveFiles, 1500);
    }
  }

  async function setCwd(cwd) {
    if (ws.pollTimer) {
      clearInterval(ws.pollTimer);
      ws.pollTimer = null;
    }

    try {
      await window.appAPI.unwatchWorkspace();
    } catch { /* ignore */ }

    ws.openTabs = [];
    ws.activeFile = null;
    ws.fileContents.clear();
    ws.liveFiles.clear();
    ws.files = [];

    if (!cwd) {
      ws.cwd = '';
      clearWorkspaceView();
      return;
    }

    ws.cwd = cwd;
    updateExplorerHeader(cwd);
    renderExplorer();
    renderTabs();
    renderEditor();

    try {
      const result = await window.appAPI.listFiles(cwd);
      if (result.root) ws.cwd = result.root;
      applyListing(result);
      renderExplorer();
      await window.appAPI.watchWorkspace(ws.cwd);
    } catch (err) {
      ws.cwd = '';
      ws.files = [];
      updateExplorerHeader('');
      renderExplorer();
      throw err;
    }
  }

  function init() {
    window.appAPI.onFileChange(handleFileChange);
    updateExplorerHeader('');
  }

  window.Workspace = {
    init,
    setCwd,
    refreshFiles,
    markStreaming,
    openFile,
    getCwd: () => ws.cwd,
  };
})();