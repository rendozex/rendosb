(function () {
  const isElectron = typeof window.grokAPI !== 'undefined';

  if (isElectron) {
    window.appAPI = {
      ...window.grokAPI,
      listSessions: async () => [],
    };
    return;
  }

  let fileEventSource = null;

  async function getInfo() {
    const res = await fetch('/api/info');
    return res.json();
  }

  async function getModels({ provider, ollamaUrl }) {
    const params = new URLSearchParams({ provider, ollamaUrl: ollamaUrl || '' });
    const res = await fetch(`/api/models?${params}`);
    return res.json();
  }

  async function listFiles(cwd) {
    const res = await fetch(`/api/files?cwd=${encodeURIComponent(cwd)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to list files');
    return data;
  }

  async function readFile({ cwd, filePath }) {
    const params = new URLSearchParams({ cwd, path: filePath });
    const res = await fetch(`/api/file?${params}`);
    return res.json();
  }

  async function watchWorkspace(cwd) {
    await fetch('/api/watch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd }),
    });
    if (!fileEventSource) {
      fileEventSource = new EventSource('/api/files/events');
      fileEventSource.onmessage = (e) => {
        if (window.__fileChangeHandler) {
          window.__fileChangeHandler(JSON.parse(e.data));
        }
      };
    }
    return true;
  }

  async function unwatchWorkspace() {
    await fetch('/api/unwatch', { method: 'POST' });
    if (fileEventSource) {
      fileEventSource.close();
      fileEventSource = null;
    }
    return true;
  }

  async function cancel() {
    const res = await fetch('/api/cancel', { method: 'POST' });
    return res.json();
  }

  async function selectDirectory() {
    const res = await fetch('/api/select-directory', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to open folder picker');
    return data.path || null;
  }

  async function setThemeBackground(color) {
    document.documentElement.style.backgroundColor = color;
  }

  async function openExternal(url) {
    window.open(url, '_blank', 'noopener');
  }

  async function send(options) {
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });

    if (!res.ok) throw new Error(`Request failed (${res.status})`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sessionId = options.sessionId || null;
    let stopReason = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        const line = part.replace(/^data:\s*/, '').trim();
        if (!line) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === 'done') {
            sessionId = event.sessionId || sessionId;
            stopReason = event.stopReason || null;
            if (event.code !== 0 && event.code !== null) {
              throw new Error(`Provider exited with code ${event.code}`);
            }
            continue;
          }
          if (event.type === 'error') throw new Error(event.message);
          if (window.__grokStreamHandler) window.__grokStreamHandler(event);
          if (event.type === 'end') {
            sessionId = event.sessionId || sessionId;
            stopReason = event.stopReason || null;
          }
        } catch (e) {
          if (e.message && (e.message.includes('exited') || e.message.includes('Ollama'))) throw e;
        }
      }
    }

    return { sessionId, stopReason };
  }

  window.appAPI = {
    getInfo,
    getModels,
    send,
    cancel,
    listFiles,
    readFile,
    watchWorkspace,
    unwatchWorkspace,
    listSessions: async () => [],
    selectDirectory,
    setThemeBackground,
    openExternal,
    onStream: (callback) => {
      window.__grokStreamHandler = callback;
      return () => { window.__grokStreamHandler = null; };
    },
    onFileChange: (callback) => {
      window.__fileChangeHandler = callback;
      return () => { window.__fileChangeHandler = null; };
    },
  };
})();