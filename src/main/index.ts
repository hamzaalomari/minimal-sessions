import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { platform } from 'node:process';
import type { CreateSessionInput, Platform } from '@shared/api';
import type { SessionId, TokenUsage, Turn } from '@shared/types';
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

/**
 * One AbortController per in-flight session turn. The renderer's
 * `api.chat.stop(sessionId)` aborts the matching entry, which cancels the
 * SDK's stream — analog of pressing Esc in the Claude CLI.
 */
const inflight = new Map<SessionId, AbortController>();

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
  const sendToFocused = (
    channel: string,
    ...args: unknown[]
  ): MenuItemConstructorOptions['click'] =>
    (_item, focusedWindow) => {
      if (focusedWindow instanceof BrowserWindow) {
        focusedWindow.webContents.send(channel, ...args);
      }
    };

  const newSessionItem: MenuItemConstructorOptions = {
    label: 'New Session',
    accelerator: 'CmdOrCtrl+N',
    click: sendToFocused('app:request-new-session'),
  };
  const closeTabItem: MenuItemConstructorOptions = {
    label: 'Close Tab',
    accelerator: 'CmdOrCtrl+W',
    click: sendToFocused('app:request-close-tab'),
  };
  const toggleSidebarItem: MenuItemConstructorOptions = {
    label: 'Toggle Sidebar',
    accelerator: 'CmdOrCtrl+\\',
    click: sendToFocused('app:request-toggle-sidebar'),
  };
  const preferencesItem: MenuItemConstructorOptions = {
    label: 'Preferences…',
    accelerator: 'CmdOrCtrl+,',
    click: sendToFocused('app:request-open-settings'),
  };
  const findItem: MenuItemConstructorOptions = {
    label: 'Find Session…',
    accelerator: 'CmdOrCtrl+F',
    click: sendToFocused('app:request-open-search'),
  };
  const selectTabItems: MenuItemConstructorOptions[] = Array.from(
    { length: 9 },
    (_, i) => {
      const n = i + 1;
      return {
        label: `Tab ${n}`,
        accelerator: `CmdOrCtrl+${n}`,
        click: sendToFocused('app:request-select-tab', n),
      };
    },
  );

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              preferencesItem,
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
        newSessionItem,
        { type: 'separator' },
        closeTabItem,
        { role: 'close', label: 'Close Window', accelerator: 'Shift+CmdOrCtrl+W' },
        ...(isMac
          ? []
          : ([
              { type: 'separator' },
              preferencesItem,
            ] as MenuItemConstructorOptions[])),
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
        { type: 'separator' },
        findItem,
      ],
    },
    {
      label: 'View',
      submenu: [
        toggleSidebarItem,
        { type: 'separator' },
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
        { type: 'separator' },
        ...selectTabItems,
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
    async (
      _e,
      sessionId: SessionId,
      userText: string,
      turnId: string,
      globalSystemPrompt = '',
    ) => {
      const db = getDb();
      const session = db.listSessions().find((s) => s.id === sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);
      // If a prior turn is somehow still tracked (e.g. crashed mid-stream),
      // abort it before starting a new one so the map stays consistent.
      inflight.get(sessionId)?.abort();
      const abortController = new AbortController();
      inflight.set(sessionId, abortController);
      try {
        await runStreamingTurn(
          realQuery,
          {
            session,
            userText,
            abortController,
            ...(session.sdkSessionId
              ? { resumeSdkSessionId: session.sdkSessionId }
              : {}),
            ...(globalSystemPrompt ? { globalSystemPrompt } : {}),
          },
          (event) => {
            if (event.type === 'turn-stop' && event.sdkSessionId) {
              db.updateSdkSessionId(sessionId, event.sdkSessionId);
            }
            emitChatEvent(sessionId, event);
          },
          turnId,
        );
      } finally {
        if (inflight.get(sessionId) === abortController) {
          inflight.delete(sessionId);
        }
      }
    },
  );
  ipcMain.handle('chat:stop', (_e, sessionId: SessionId) => {
    inflight.get(sessionId)?.abort();
  });

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
  ipcMain.handle('sessions:purge', (_e, id: SessionId) => getDb().deleteSession(id));
  ipcMain.handle('sessions:list-deleted', () => getDb().listDeletedSessions());

  ipcMain.handle('turns:list', (_e, sessionId: SessionId) =>
    getDb().listTurns(sessionId),
  );
  ipcMain.handle(
    'turns:append',
    (
      _e,
      sessionId: SessionId,
      turn: Turn,
      addTokens?: number,
      addUsage?: TokenUsage,
    ) => getDb().appendTurn(sessionId, turn, addTokens ?? 0, addUsage),
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
