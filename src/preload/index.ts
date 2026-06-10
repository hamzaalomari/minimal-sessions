import { contextBridge, ipcRenderer } from 'electron';
import type { Api } from '@shared/api';

const api: Api = {
  app: {
    ping: () => ipcRenderer.invoke('app:ping'),
    platform: () => ipcRenderer.invoke('app:platform'),
    closeWindow: () => ipcRenderer.invoke('app:close-window'),
    onRequestCloseTab: (handler) => {
      const listener = (): void => handler();
      ipcRenderer.on('app:request-close-tab', listener);
      return () => ipcRenderer.removeListener('app:request-close-tab', listener);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);
