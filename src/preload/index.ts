import { contextBridge, ipcRenderer } from 'electron';
import type { Api } from '@shared/api';

const api: Api = {
  app: {
    ping: () => ipcRenderer.invoke('app:ping'),
    platform: () => ipcRenderer.invoke('app:platform'),
  },
};

contextBridge.exposeInMainWorld('api', api);
