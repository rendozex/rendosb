(function () {
  'use strict';

  const STORAGE_KEY = 'rendosb-theme';
  const DEFAULT_THEME = 'dark-modern';

  const GROUP_LABELS = {
    dark: 'Dark',
    light: 'Light',
    contrast: 'High Contrast',
  };

  const THEME_DEFS = [
    { id: 'dark-modern', label: 'Dark Modern', group: 'dark', windowBackground: '#1F1F1F' },
    { id: 'dark-plus', label: 'Dark+', group: 'dark', windowBackground: '#1E1E1E' },
    { id: '2026-dark', label: '2026 Dark', group: 'dark', windowBackground: '#121314' },
    { id: 'one-dark', label: 'One Dark', group: 'dark', windowBackground: '#282C34' },
    { id: 'dracula', label: 'Dracula', group: 'dark', windowBackground: '#282A36' },
    { id: 'monokai', label: 'Monokai', group: 'dark', windowBackground: '#272822' },
    { id: 'monokai-dimmed', label: 'Monokai Dimmed', group: 'dark', windowBackground: '#1E1E1E' },
    { id: 'solarized-dark', label: 'Solarized Dark', group: 'dark', windowBackground: '#002B36' },
    { id: 'github-dark', label: 'GitHub Dark', group: 'dark', windowBackground: '#0D1117' },
    { id: 'nord', label: 'Nord', group: 'dark', windowBackground: '#2E3440' },
    { id: 'tokyo-night', label: 'Tokyo Night', group: 'dark', windowBackground: '#1A1B26' },
    { id: 'catppuccin-mocha', label: 'Catppuccin Mocha', group: 'dark', windowBackground: '#1E1E2E' },
    { id: 'abyss', label: 'Abyss', group: 'dark', windowBackground: '#000C18' },
    { id: 'tomorrow-night-blue', label: 'Tomorrow Night Blue', group: 'dark', windowBackground: '#002451' },
    { id: 'kimbie-dark', label: 'Kimbie Dark', group: 'dark', windowBackground: '#221A0F' },
    { id: 'red', label: 'Red', group: 'dark', windowBackground: '#390000' },
    { id: 'light-modern', label: 'Light Modern', group: 'light', windowBackground: '#FFFFFF' },
    { id: 'light-plus', label: 'Light+', group: 'light', windowBackground: '#FFFFFF' },
    { id: '2026-light', label: '2026 Light', group: 'light', windowBackground: '#FFFFFF' },
    { id: 'solarized-light', label: 'Solarized Light', group: 'light', windowBackground: '#FDF6E3' },
    { id: 'github-light', label: 'GitHub Light', group: 'light', windowBackground: '#FFFFFF' },
    { id: 'catppuccin-latte', label: 'Catppuccin Latte', group: 'light', windowBackground: '#EFF1F5' },
    { id: 'quiet-light', label: 'Quiet Light', group: 'light', windowBackground: '#F5F5F5' },
    { id: 'hc-dark', label: 'High Contrast Dark', group: 'contrast', windowBackground: '#000000' },
    { id: 'hc-light', label: 'High Contrast Light', group: 'contrast', windowBackground: '#FFFFFF' },
  ];

  const THEMES = THEME_DEFS;

  function getTheme(id) {
    return THEMES.find((t) => t.id === id) || THEMES[0];
  }

  function applyTheme(id) {
    const theme = getTheme(id);
    document.documentElement.setAttribute('data-theme', theme.id);
    localStorage.setItem(STORAGE_KEY, theme.id);

    if (window.appAPI?.setThemeBackground) {
      window.appAPI.setThemeBackground(theme.windowBackground);
    }

    window.dispatchEvent(new CustomEvent('rendosb:theme-changed', { detail: theme }));
    return theme;
  }

  function getSavedTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return THEMES.some((t) => t.id === saved) ? saved : DEFAULT_THEME;
  }

  function populateThemeSelect(selectEl, currentId) {
    if (!selectEl) return;
    selectEl.innerHTML = '';

    for (const [groupKey, groupLabel] of Object.entries(GROUP_LABELS)) {
      const groupThemes = THEMES.filter((t) => t.group === groupKey);
      if (!groupThemes.length) continue;

      const optgroup = document.createElement('optgroup');
      optgroup.label = groupLabel;
      for (const theme of groupThemes) {
        const opt = document.createElement('option');
        opt.value = theme.id;
        opt.textContent = theme.label;
        optgroup.appendChild(opt);
      }
      selectEl.appendChild(optgroup);
    }

    selectEl.value = currentId;
  }

  window.ThemeManager = {
    THEMES,
    GROUP_LABELS,
    DEFAULT_THEME,
    getTheme,
    applyTheme,
    getSavedTheme,
    populateThemeSelect,
    init() {
      return applyTheme(getSavedTheme());
    },
  };

  window.ThemeManager.init();
})();