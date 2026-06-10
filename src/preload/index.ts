import { contextBridge, ipcRenderer } from 'electron';
import type { Api } from '@shared/api';

const api: Api = {
  app: {
    ping: () => ipcRenderer.invoke('app:ping'),
    platform: () => ipcRenderer.invoke('app:platform'),
    closeWindow: () => ipcRenderer.invoke('app:close-window'),
    homeDir: () => ipcRenderer.invoke('app:home-dir'),
    onRequestCloseTab: (handler) => {
      const listener = (): void => handler();
      ipcRenderer.on('app:request-close-tab', listener);
      return () => ipcRenderer.removeListener('app:request-close-tab', listener);
    },
  },
  fs: {
    pickDirectory: () => ipcRenderer.invoke('fs:pick-directory'),
    branchFor: (path) => ipcRenderer.invoke('fs:branch-for', path),
    isReadableDir: (path) => ipcRenderer.invoke('fs:is-readable-dir', path),
  },
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    create: (input) => ipcRenderer.invoke('sessions:create', input),
    rename: (id, name) => ipcRenderer.invoke('sessions:rename', id, name),
    updateSystemPrompt: (id, prompt) =>
      ipcRenderer.invoke('sessions:update-system-prompt', id, prompt),
    delete: (id) => ipcRenderer.invoke('sessions:delete', id),
  },
  turns: {
    list: (sessionId) => ipcRenderer.invoke('turns:list', sessionId),
    append: (sessionId, turn, addTokens) =>
      ipcRenderer.invoke('turns:append', sessionId, turn, addTokens ?? 0),
  },
};

contextBridge.exposeInMainWorld('api', api);
