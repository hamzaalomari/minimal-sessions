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
    onRequestNewSession: (handler) => {
      const listener = (): void => handler();
      ipcRenderer.on('app:request-new-session', listener);
      return () => ipcRenderer.removeListener('app:request-new-session', listener);
    },
    onRequestToggleSidebar: (handler) => {
      const listener = (): void => handler();
      ipcRenderer.on('app:request-toggle-sidebar', listener);
      return () => ipcRenderer.removeListener('app:request-toggle-sidebar', listener);
    },
    onRequestOpenSettings: (handler) => {
      const listener = (): void => handler();
      ipcRenderer.on('app:request-open-settings', listener);
      return () => ipcRenderer.removeListener('app:request-open-settings', listener);
    },
    onRequestOpenSearch: (handler) => {
      const listener = (): void => handler();
      ipcRenderer.on('app:request-open-search', listener);
      return () => ipcRenderer.removeListener('app:request-open-search', listener);
    },
    onRequestToggleTerminal: (handler) => {
      const listener = (): void => handler();
      ipcRenderer.on('app:request-toggle-terminal', listener);
      return () =>
        ipcRenderer.removeListener('app:request-toggle-terminal', listener);
    },
    onRequestSelectTab: (handler) => {
      const listener = (_e: unknown, n: number): void => handler(n);
      ipcRenderer.on('app:request-select-tab', listener);
      return () => ipcRenderer.removeListener('app:request-select-tab', listener);
    },
    onRequestNavigateBack: (handler) => {
      const listener = (): void => handler();
      ipcRenderer.on('app:request-navigate-back', listener);
      return () =>
        ipcRenderer.removeListener('app:request-navigate-back', listener);
    },
    onRequestNavigateForward: (handler) => {
      const listener = (): void => handler();
      ipcRenderer.on('app:request-navigate-forward', listener);
      return () =>
        ipcRenderer.removeListener('app:request-navigate-forward', listener);
    },
  },
  fs: {
    pickDirectory: () => ipcRenderer.invoke('fs:pick-directory'),
    branchFor: (path) => ipcRenderer.invoke('fs:branch-for', path),
    isReadableDir: (path) => ipcRenderer.invoke('fs:is-readable-dir', path),
    gitInitSession: (input) => ipcRenderer.invoke('fs:git-init-session', input),
  },
  models: {
    list: () => ipcRenderer.invoke('models:list'),
  },
  commands: {
    list: (cwd) => ipcRenderer.invoke('commands:list', cwd),
  },
  chat: {
    send: (sessionId, userText, globalSystemPrompt = '') => {
      const turnId =
        globalThis.crypto?.randomUUID?.() ??
        `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      return ipcRenderer.invoke(
        'chat:send',
        sessionId,
        userText,
        turnId,
        globalSystemPrompt,
      );
    },
    stop: (sessionId) => ipcRenderer.invoke('chat:stop', sessionId),
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
    purge: (id) => ipcRenderer.invoke('sessions:purge', id),
    purgeAllDeleted: () => ipcRenderer.invoke('sessions:purge-all-deleted'),
  },
  turns: {
    list: (sessionId) => ipcRenderer.invoke('turns:list', sessionId),
    append: (sessionId, turn, addTokens, addUsage) =>
      ipcRenderer.invoke(
        'turns:append',
        sessionId,
        turn,
        addTokens ?? 0,
        addUsage ?? { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 },
      ),
  },
  terminal: {
    open: (sessionId, cwd, cols, rows) =>
      ipcRenderer.invoke('terminal:open', sessionId, cwd, cols, rows),
    write: (sessionId, data) =>
      ipcRenderer.invoke('terminal:write', sessionId, data),
    resize: (sessionId, cols, rows) =>
      ipcRenderer.invoke('terminal:resize', sessionId, cols, rows),
    close: (sessionId) => ipcRenderer.invoke('terminal:close', sessionId),
    onData: (handler) => {
      const listener = (_e: unknown, sessionId: SessionId, data: string): void =>
        handler(sessionId, data);
      ipcRenderer.on('terminal:data', listener);
      return () => ipcRenderer.removeListener('terminal:data', listener);
    },
    onExit: (handler) => {
      const listener = (_e: unknown, sessionId: SessionId, code: number): void =>
        handler(sessionId, code);
      ipcRenderer.on('terminal:exit', listener);
      return () => ipcRenderer.removeListener('terminal:exit', listener);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);
