(() => {
  'use strict';

  const state = {
    sessionId: null,
    isStreaming: false,
    cwd: '',
    conversations: new Map(),
    currentThought: '',
    currentResponse: '',
    currentResponseEl: null,
    currentThoughtEl: null,
    currentThoughtContentEl: null,
    currentMarkdownEl: null,
    provider: 'grok',
    model: '',
    ollamaMessages: [],
  };

  const $ = (id) => document.getElementById(id);

  const paneBody = $('pane-body');
  const chatMessages = $('chat-messages');
  const chatInput = $('chat-input');
  const chatInputContainer = $('chat-input-container');
  const btnSend = $('btn-send');
  const btnStop = $('btn-stop');
  const btnNewChat = $('btn-new-chat');
  const errorBanner = $('error-banner');
  const ollamaGuide = $('ollama-setup-guide');
  const ollamaGuideError = $('ollama-guide-error');
  const statusState = $('status-state');
  const statusGrok = $('status-grok');
  const statusMode = $('status-mode');
  const modelSelect = $('model-select');
  const providerSelect = $('provider-select');
  const titlebarFolderPath = $('titlebar-folder-path');

  function setStatusbarLabel(el, text) {
    const label = el?.querySelector('.statusbar-item-label');
    if (label) label.textContent = text;
    else if (el) el.textContent = text;
  }

  function setStatus(text) {
    setStatusbarLabel(statusState, text);
  }

  function showError(message) {
    errorBanner.textContent = message;
    errorBanner.classList.remove('hidden');
  }

  function clearError() {
    errorBanner.classList.add('hidden');
    errorBanner.textContent = '';
  }

  function showOllamaGuideError(message) {
    if (!ollamaGuideError) return;
    ollamaGuideError.textContent = message;
    ollamaGuideError.classList.remove('hidden');
  }

  function clearOllamaGuideError() {
    if (!ollamaGuideError) return;
    ollamaGuideError.classList.add('hidden');
    ollamaGuideError.textContent = '';
  }

  function formatOllamaError(err) {
    const msg = err?.message || String(err);
    if (msg.includes('ECONNREFUSED') || msg.includes('connect')) {
      return 'Cannot connect to Ollama at the URL in Settings. Make sure Docker is running and you started the container (see steps above).';
    }
    if (msg.includes('No models found')) {
      return 'Ollama is running but no models are installed. Run: docker exec -it ollama ollama pull llama3.2';
    }
    return msg.replace(/^Error invoking remote method '[^']+':\s*/i, '').replace(/^Error:\s*/i, '');
  }

  function updateTitlebarFolder(cwd) {
    if (!titlebarFolderPath) return;
    if (!cwd) {
      titlebarFolderPath.textContent = 'No folder selected';
      titlebarFolderPath.title = '';
      titlebarFolderPath.classList.remove('has-folder');
      return;
    }
    const parts = cwd.replace(/\\/g, '/').split('/');
    const short = parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : cwd;
    titlebarFolderPath.textContent = short;
    titlebarFolderPath.title = cwd;
    titlebarFolderPath.classList.add('has-folder');
  }

  function setProviderUI(provider) {
    state.provider = provider;
    const isOllama = provider === 'ollama';

    setStatusbarLabel(statusMode, isOllama ? 'Ollama' : 'Grok');
    $('chat-hint').textContent = isOllama ? 'Docker / Ollama' : 'Grok CLI';
    chatInput.placeholder = isOllama
      ? 'Ask your local model… (Enter to send)'
      : 'Ask anything… (Enter to send)';

    ollamaGuide?.classList.toggle('hidden', !isOllama);
    $('chat-welcome')?.classList.toggle('hidden', isOllama);

    if (!isOllama) {
      clearOllamaGuideError();
      clearError();
      chatInput.disabled = false;
      btnSend.disabled = state.isStreaming;
    }
  }

  function updateGoalBanner(working) {
    const banner = $('chat-goal-banner');
    if (!banner) return;
    const cwd = state.cwd || window.Workspace?.getCwd?.() || '';
    if (!working || !cwd) {
      banner.classList.remove('has-goal');
      banner.innerHTML = '';
      return;
    }
    const short = cwd.replace(/\\/g, '/').split('/').pop() || cwd;
    banner.classList.add('has-goal');
    banner.innerHTML = `
      <div class="chat-goal-banner">
        <span class="codicon codicon-folder" aria-hidden="true"></span>
        <span class="chat-goal-banner-text">Working in <strong>${short}</strong></span>
      </div>
    `;
  }

  function setWorking(working) {
    state.isStreaming = working;
    chatInputContainer.classList.toggle('working', working);
    btnSend.disabled = working;
    btnStop.disabled = !working;
    chatInput.disabled = working;
    setStatus(working ? 'Generating…' : 'Ready');
    updateGoalBanner(working);
    window.Workspace?.markStreaming(working);
  }

  function showChatArea() {
    paneBody.classList.remove('chat-view-welcome-visible');
    paneBody.classList.add('welcome-hidden');
    chatMessages.classList.remove('hidden');
    if (state.provider === 'ollama') {
      ollamaGuide?.classList.add('hidden');
    }
  }

  function showWelcome() {
    paneBody.classList.add('chat-view-welcome-visible');
    paneBody.classList.remove('welcome-hidden');
    chatMessages.classList.add('hidden');
    if (state.provider === 'ollama') {
      ollamaGuide?.classList.remove('hidden');
    }
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderMarkdown(text) {
    let html = escapeHtml(text);
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
      const label = lang ? `<span style="opacity:0.6;font-size:11px;">${lang}</span><br>` : '';
      return `<pre>${label}<code>${code.trim()}</code></pre>`;
    });
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.split(/\n\n+/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    return html;
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function createMessageEl(role, text) {
    const isRequest = role === 'user';
    const agentName = state.provider === 'ollama' ? 'Local AI' : 'Grok';
    const container = document.createElement('div');
    container.className = `interactive-item-container ${isRequest ? 'interactive-request' : 'interactive-response'}`;
    container.innerHTML = `
      <div class="header">
        <div class="user">
          <div class="avatar-container">
            <div class="avatar codicon-avatar">
              <span style="font-size:12px;font-weight:600;">${isRequest ? 'You' : 'AI'}</span>
            </div>
          </div>
          <span class="username">${isRequest ? 'You' : agentName}</span>
        </div>
      </div>
      <div class="value"><div class="rendered-markdown">${renderMarkdown(text)}</div></div>
    `;
    return container;
  }

  function appendUserMessage(text) {
    chatMessages.appendChild(createMessageEl('user', text));
    scrollToBottom();
  }

  function startAssistantMessage() {
    state.currentThought = '';
    state.currentResponse = '';
    const agentName = state.provider === 'ollama' ? 'Local AI' : 'Grok';

    const container = document.createElement('div');
    container.className = 'interactive-item-container interactive-response chat-response-loading chat-most-recent-response';
    container.innerHTML = `
      <div class="header">
        <div class="user">
          <div class="avatar codicon-avatar"><span style="font-size:12px;font-weight:600;">AI</span></div>
          <span class="username">${agentName} <span class="chat-animated-ellipsis"></span></span>
        </div>
      </div>
      <div class="value">
        <details class="chat-thinking-box thought-block hidden" id="current-thought-block">
          <summary class="chat-used-context-label">Thinking</summary>
          <div class="chat-thinking-content thought-content" id="current-thought-content"></div>
        </details>
        <div class="rendered-markdown" id="current-response-md"></div>
      </div>
    `;
    chatMessages.appendChild(container);

    state.currentResponseEl = container;
    state.currentThoughtEl = container.querySelector('#current-thought-block');
    state.currentThoughtContentEl = container.querySelector('#current-thought-content');
    state.currentMarkdownEl = container.querySelector('#current-response-md');
    scrollToBottom();
  }

  function updateAssistantStream() {
    if (!state.currentMarkdownEl) return;
    if (state.currentThought) {
      state.currentThoughtContentEl.textContent = state.currentThought;
      state.currentThoughtEl.classList.remove('hidden');
    }
    state.currentMarkdownEl.innerHTML = renderMarkdown(state.currentResponse);
    scrollToBottom();
  }

  function finishAssistantMessage() {
    if (!state.currentResponseEl) return;
    state.currentResponseEl.classList.remove('chat-response-loading');
    const agentName = state.provider === 'ollama' ? 'Local AI' : 'Grok';
    const username = state.currentResponseEl.querySelector('.username');
    if (username) username.innerHTML = agentName;
    if (!state.currentThought) state.currentThoughtEl?.classList.add('hidden');

    if (state.provider === 'ollama' && state.currentResponse) {
      state.ollamaMessages.push({ role: 'assistant', content: state.currentResponse });
    }

    state.currentResponseEl = null;
    state.currentThoughtEl = null;
    state.currentThoughtContentEl = null;
    state.currentMarkdownEl = null;
  }

  async function loadModels() {
    const provider = providerSelect.value;
    setProviderUI(provider);
    const ollamaUrl = $('setting-ollama-url')?.value || 'http://127.0.0.1:11434';

    if (provider === 'grok') {
      clearOllamaGuideError();
      clearError();
    }

    try {
      const data = await window.appAPI.getModels({ provider, ollamaUrl });
      modelSelect.innerHTML = '';
      for (const m of data.models || []) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m + (m === data.default ? ' (default)' : '');
        modelSelect.appendChild(opt);
      }
      state.model = data.default || data.models?.[0] || '';
      modelSelect.value = state.model;

      if (provider === 'ollama') {
        clearOllamaGuideError();
      }
    } catch (err) {
      modelSelect.innerHTML = '<option value="">Unavailable</option>';

      if (provider === 'ollama') {
        showOllamaGuideError(formatOllamaError(err));
        showWelcome();
      } else {
        showError(`Could not load models: ${formatOllamaError(err)}`);
      }
    }
  }

  async function pickFolder() {
    try {
      const dir = await window.appAPI.selectDirectory();
      if (dir) await applyCwd(dir);
    } catch (err) {
      showError(`Could not open folder picker: ${err.message || err}`);
    }
  }

  async function applyCwd(cwd) {
    if (!cwd) {
      state.cwd = '';
      $('setting-cwd').value = '';
      updateTitlebarFolder('');
      await window.Workspace.setCwd('');
      return;
    }
    try {
      await window.Workspace.setCwd(cwd);
      state.cwd = window.Workspace.getCwd() || cwd;
      $('setting-cwd').value = state.cwd;
      updateTitlebarFolder(state.cwd);
      clearError();
    } catch (err) {
      state.cwd = '';
      $('setting-cwd').value = '';
      updateTitlebarFolder('');
      showError(err.message || 'Could not open that folder');
    }
  }

  async function sendMessage(prompt) {
    const text = (prompt || chatInput.value).trim();
    if (!text || state.isStreaming) return;

    const activeCwd = state.cwd || $('setting-cwd').value;
    if (!activeCwd) {
      showError('Select a folder using Browse at the top (or in Settings).');
      return;
    }

    if (state.provider === 'ollama' && !modelSelect.value) {
      showOllamaGuideError('Connect to Ollama and pull a model before chatting (see setup guide above).');
      return;
    }

    clearError();
    showChatArea();
    appendUserMessage(text);
    chatInput.value = '';
    autoResizeInput();
    startAssistantMessage();
    setWorking(true);

    if (state.provider === 'ollama') {
      state.ollamaMessages.push({ role: 'user', content: text });
    }

    try {
      const result = await window.appAPI.send({
        prompt: text,
        provider: state.provider,
        sessionId: state.sessionId,
        cwd: activeCwd,
        model: modelSelect.value || state.model,
        permissionMode: $('setting-permission').value,
        maxTurns: Number($('setting-max-turns').value) || 25,
        ollamaUrl: $('setting-ollama-url').value || 'http://127.0.0.1:11434',
        messages: state.provider === 'ollama' ? state.ollamaMessages.slice(0, -1) : [],
      });

      state.sessionId = result.sessionId || state.sessionId;
      finishAssistantMessage();
      await window.Workspace.refreshFiles();
    } catch (err) {
      finishAssistantMessage();
      if (state.currentMarkdownEl && !state.currentResponse) {
        state.currentMarkdownEl.innerHTML = `<p style="color:var(--vscode-errorForeground)">${escapeHtml(err.message)}</p>`;
      }
      if (state.provider === 'ollama') {
        state.ollamaMessages.pop();
        showOllamaGuideError(formatOllamaError(err));
        showWelcome();
      } else {
        showError(err.message || String(err));
      }
    } finally {
      setWorking(false);
      chatInput.focus();
    }
  }

  function autoResizeInput() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + 'px';
  }

  function newChat() {
    if (state.isStreaming) return;
    state.sessionId = null;
    state.ollamaMessages = [];
    chatMessages.innerHTML = '';
    clearError();
    chatInput.value = '';
    if (chatMessages.children.length === 0) {
      showWelcome();
    }
    chatInput.focus();
  }

  function setupStreamListener() {
    window.appAPI.onStream((event) => {
      if (event.type === 'thought' && typeof event.data === 'string') {
        state.currentThought += event.data;
        updateAssistantStream();
      } else if (event.type === 'text' && typeof event.data === 'string') {
        state.currentResponse += event.data;
        updateAssistantStream();
      }
    });
  }

  function setupActivityBar() {
    document.querySelectorAll('.activitybar-item').forEach((item) => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.activitybar-item').forEach((i) => i.classList.remove('active'));
        item.classList.add('active');
        const view = item.dataset.view;
        $('explorer-panel').classList.toggle('hidden', view === 'settings');
        $('editor-panel').classList.toggle('hidden', view === 'settings');
        document.querySelector('.chat-panel').classList.toggle('hidden', view === 'settings');
        $('sidebar-settings').classList.toggle('hidden', view !== 'settings');
        if (view === 'settings') {
          document.querySelector('.workspace-split').style.display = 'none';
          $('sidebar-settings').classList.remove('hidden');
          $('sidebar-settings').style.width = '100%';
        } else {
          document.querySelector('.workspace-split').style.display = 'flex';
          $('sidebar-settings').style.width = '';
        }
      });
    });
  }

  async function onProviderChange() {
    state.sessionId = null;
    state.ollamaMessages = [];
    chatMessages.innerHTML = '';

    if (providerSelect.value === 'grok') {
      clearOllamaGuideError();
      clearError();
      showWelcome();
    } else {
      showWelcome();
    }

    await loadModels();
    chatInput.focus();
  }

  function setupFolderPicker() {
    $('btn-pick-cwd')?.addEventListener('click', pickFolder);
    $('btn-titlebar-folder')?.addEventListener('click', pickFolder);
  }

  function setupThemePicker() {
    const themeSelect = $('setting-theme');
    if (!themeSelect || !window.ThemeManager) return;

    const current = window.ThemeManager.getSavedTheme();
    window.ThemeManager.populateThemeSelect(themeSelect, current);

    themeSelect.addEventListener('change', () => {
      window.ThemeManager.applyTheme(themeSelect.value);
    });
  }

  async function init() {
    window.Workspace.init();
    setupStreamListener();
    setupActivityBar();
    setupFolderPicker();
    setupThemePicker();

    const info = await window.appAPI.getInfo();
    setStatusbarLabel(
      statusGrok,
      info.version === 'not found'
        ? 'Grok CLI not found'
        : info.version.replace(/^grok\s*/i, '')
    );

    $('setting-cwd').value = '';
    updateTitlebarFolder('');
    setProviderUI('grok');
    await loadModels();

    providerSelect.addEventListener('change', onProviderChange);

    modelSelect.addEventListener('change', () => {
      state.model = modelSelect.value;
    });

    $('setting-ollama-url')?.addEventListener('change', () => {
      if (providerSelect.value === 'ollama') loadModels();
    });

    btnSend.addEventListener('click', () => sendMessage());
    btnStop.addEventListener('click', async () => {
      await window.appAPI.cancel();
      setWorking(false);
      finishAssistantMessage();
      setStatus('Cancelled');
    });
    btnNewChat?.addEventListener('click', newChat);

    $('btn-refresh-files').addEventListener('click', () => window.Workspace.refreshFiles());

    chatInput.addEventListener('input', autoResizeInput);
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    document.querySelectorAll('.welcome-prompt').forEach((btn) => {
      btn.addEventListener('click', () => sendMessage(btn.dataset.prompt));
    });

    document.addEventListener('click', (e) => {
      const link = e.target.closest('a.md-link');
      if (link?.dataset?.url) {
        e.preventDefault();
        window.appAPI.openExternal(link.dataset.url);
      }
    });

    chatInput.focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();