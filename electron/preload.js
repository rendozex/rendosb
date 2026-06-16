const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('grokAPI', {
  getInfo: () => ipcRenderer.invoke('grok:get-info'),
  getModels: (opts) => ipcRenderer.invoke('models:list', opts),
  send: (options) => ipcRenderer.invoke('grok:send', options),
  cancel: () => ipcRenderer.invoke('grok:cancel'),
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  setThemeBackground: (color) => ipcRenderer.invoke('theme:set-background', color),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  listFiles: (cwd) => ipcRenderer.invoke('fs:list', cwd),
  readFile: (opts) => ipcRenderer.invoke('fs:read', opts),
  watchWorkspace: (cwd) => ipcRenderer.invoke('fs:watch', cwd),
  unwatchWorkspace: () => ipcRenderer.invoke('fs:unwatch'),
  onStream: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('grok:stream', handler);
    return () => ipcRenderer.removeListener('grok:stream', handler);
  },
  onFileChange: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('fs:change', handler);
    return () => ipcRenderer.removeListener('fs:change', handler);
  },
});