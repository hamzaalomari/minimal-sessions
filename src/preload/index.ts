import { contextBridge, ipcRenderer } from 'electron';
import type { Api, ChatEvent } from '@shared/api';
import type { SessionId } from '@shared/types';

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
  models: {
    list: () => ipcRenderer.invoke('models:list'),
  },
  chat: {
    send: (sessionId, userText) => {
      const turnId =
        globalThis.crypto?.randomUUID?.() ??
        `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      return ipcRenderer.invoke('chat:send', sessionId, userText, turnId);
    },
    onEvent: (handler) => {
      const listener = (_e: unknown, sessionId: SessionId, event: ChatEvent): void =>
        handler(sessionId, event);
      ipcRenderer.on('chat:event', listener);
      return () => ipcRenderer.removeListener('chat:event', listener);
    },
  },
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    listDeleted: () => ipcRenderer.invoke('sessions:list-deleted'),
    create: (input) => ipcRenderer.invoke('sessions:create', input),
    rename: (id, name) => ipcRenderer.invoke('sessions:rename', id, name),
    updateSystemPrompt: (id, prompt) =>
      ipcRenderer.invoke('sessions:update-system-prompt', id, prompt),
    delete: (id) => ipcRenderer.invoke('sessions:delete', id),
    restore: (id) => ipcRenderer.invoke('sessions:restore', id),
  },
  turns: {
    list: (sessionId) => ipcRenderer.invoke('turns:list', sessionId),
    append: (sessionId, turn, addTokens) =>
      ipcRenderer.invoke('turns:append', sessionId, turn, addTokens ?? 0),
  },
};

contextBridge.exposeInMainWorld('api', api);
