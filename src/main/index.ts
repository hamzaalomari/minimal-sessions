import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { platform } from 'node:process';
import type { CreateSessionInput, Platform } from '@shared/api';
import type { SessionId, Turn } from '@shared/types';
import { openSessionsDb, seedIfEmpty, type SessionsDb } from './db';
import { branchFor, dirExists } from './fs';
import {
  listSupportedModels,
  realQuery,
  runStreamingTurn,
  type ChatEvent,
  type SdkModel,
} from './chat';
import { SEED_SESSIONS } from '@shared/seed';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isMac = platform === 'darwin';

let sessionsDb: SessionsDb | null = null;
let modelsCache: SdkModel[] | null = null;

function getDb(): SessionsDb {
  if (!sessionsDb) throw new Error('SessionsDb not initialized');
  return sessionsDb;
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: '#1a1a1a',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isMac ? { x: 14, y: 14 } : undefined,
    titleBarOverlay: isMac
      ? undefined
      : {
          color: '#00000000',
          symbolColor: '#888',
          height: 40,
        },
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

function buildMenu(): Menu {
  const closeTabItem: MenuItemConstructorOptions = {
    label: 'Close Tab',
    accelerator: 'CmdOrCtrl+W',
    click: (_item, focusedWindow) => {
      if (focusedWindow instanceof BrowserWindow) {
        focusedWindow.webContents.send('app:request-close-tab');
      }
    },
  };

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ] as MenuItemConstructorOptions[])
      : []),
    {
      label: 'File',
      submenu: [
        closeTabItem,
        { role: 'close', label: 'Close Window', accelerator: 'Shift+CmdOrCtrl+W' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? ([{ type: 'separator' }, { role: 'front' }] as MenuItemConstructorOptions[])
          : []),
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

function emitChatEvent(sessionId: SessionId, event: ChatEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('chat:event', sessionId, event);
  }
}

function registerIpc(): void {
  ipcMain.handle('app:ping', () => 'pong' as const);
  ipcMain.handle('app:platform', () => platform as Platform);
  ipcMain.handle('app:home-dir', () => homedir());
  ipcMain.handle('app:close-window', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close();
  });

  ipcMain.handle('fs:pick-directory', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0] ?? null;
  });
  ipcMain.handle('fs:branch-for', (_e, path: string) => branchFor(path));
  ipcMain.handle('fs:is-readable-dir', (_e, path: string) => dirExists(path));

  ipcMain.handle('models:list', async () => {
    if (modelsCache) return modelsCache;
    modelsCache = await listSupportedModels();
    return modelsCache;
  });

  ipcMain.handle(
    'chat:send',
    async (_e, sessionId: SessionId, userText: string, turnId: string) => {
      const db = getDb();
      const session = db.listSessions().find((s) => s.id === sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);
      await runStreamingTurn(
        realQuery,
        {
          session,
          userText,
          ...(session.sdkSessionId
            ? { resumeSdkSessionId: session.sdkSessionId }
            : {}),
        },
        (event) => {
          if (event.type === 'turn-stop' && event.sdkSessionId) {
            db.updateSdkSessionId(sessionId, event.sdkSessionId);
          }
          emitChatEvent(sessionId, event);
        },
        turnId,
      );
    },
  );

  ipcMain.handle('sessions:list', () => getDb().listSessions());
  ipcMain.handle('sessions:create', (_e, input: CreateSessionInput) =>
    getDb().createSession({
      id: input.id,
      name: input.name,
      path: input.path,
      model: input.model,
      systemPrompt: input.systemPrompt,
      branch: input.branch,
      createdAt: input.createdAt,
    }),
  );
  ipcMain.handle('sessions:rename', (_e, id: SessionId, name: string) =>
    getDb().renameSession(id, name),
  );
  ipcMain.handle(
    'sessions:update-system-prompt',
    (_e, id: SessionId, systemPrompt: string) =>
      getDb().updateSystemPrompt(id, systemPrompt),
  );
  ipcMain.handle('sessions:delete', (_e, id: SessionId) => getDb().softDeleteSession(id));
  ipcMain.handle('sessions:restore', (_e, id: SessionId) => getDb().restoreSession(id));
  ipcMain.handle('sessions:list-deleted', () => getDb().listDeletedSessions());

  ipcMain.handle('turns:list', (_e, sessionId: SessionId) =>
    getDb().listTurns(sessionId),
  );
  ipcMain.handle(
    'turns:append',
    (_e, sessionId: SessionId, turn: Turn, addTokens?: number) =>
      getDb().appendTurn(sessionId, turn, addTokens ?? 0),
  );
}

app.whenReady().then(() => {
  sessionsDb = openSessionsDb(join(app.getPath('userData'), 'sessions.db'));
  seedIfEmpty(sessionsDb, SEED_SESSIONS);
  registerIpc();
  Menu.setApplicationMenu(buildMenu());
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

app.on('will-quit', () => {
  sessionsDb?.close();
  sessionsDb = null;
});
