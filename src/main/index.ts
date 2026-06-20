import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import type { MenuItemConstructorOptions, OpenDialogOptions } from 'electron';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { platform } from 'node:process';
import type { CreateSessionInput, Platform } from '@shared/api';
import type { SessionId, TokenUsage, Turn } from '@shared/types';
import { openSessionsDb, type SessionsDb } from './db';
import { branchFor, dirExists, gitInitSession, type GitInitSessionInput } from './fs';
import { listClaudeSessions, loadClaudeSession } from './claudeHistory';
import { log, logPath } from './log';
import { discoverCommands, discoverSkills, setBuiltinCommandsDir } from './plugins';
import {
  listSupportedModels,
  realQuery,
  runStreamingTurn,
  type ChatEvent,
  type SdkModel,
} from './chat';
import {
  closeTerminal,
  disposeAllTerminals,
  onTerminalData,
  onTerminalExit,
  openTerminal,
  resizeTerminal,
  writeTerminal,
} from './terminal';
import {
  checkForUpdatesNow,
  getUpdaterState,
  initAutoUpdater,
  quitAndInstallUpdate,
} from './updater';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isMac = platform === 'darwin';

// In dev (`npm run dev`) the launched binary is Electron itself, so the menu
// bar and Dock identity come from Electron's bundle. `app.setName` updates the
// menu-bar label and userData dir; `app.dock.setIcon` swaps the Dock icon.
// The Dock *label* under the icon still says "Electron" because macOS reads it
// from the launching .app's Info.plist — only the packaged build fixes that.
if (!app.isPackaged) {
  app.setName('Minimal Sessions');
}

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

  // Browser-style back/forward — fired by the OS for mouse buttons 4/5
  // (the "back" / "forward" thumb buttons) and by the equivalent browser
  // navigation keys on each platform.
  (win.webContents as unknown as {
    on(channel: string, listener: (e: unknown, cmd: string) => void): void;
  }).on('app-command', (_e, cmd) => {
    if (cmd === 'browser-backward') {
      win.webContents.send('app:request-navigate-back');
    } else if (cmd === 'browser-forward') {
      win.webContents.send('app:request-navigate-forward');
    }
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
    accelerator: 'CmdOrCtrl+B',
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
  const toggleTerminalItem: MenuItemConstructorOptions = {
    label: 'Toggle Terminal',
    accelerator: 'CmdOrCtrl+J',
    click: sendToFocused('app:request-toggle-terminal'),
  };
  const shortcutsItem: MenuItemConstructorOptions = {
    label: 'Keyboard Shortcuts',
    accelerator: 'CmdOrCtrl+/',
    click: sendToFocused('app:request-toggle-shortcuts'),
  };
  // Sidebar view jumps. Each opens the sidebar if collapsed, then switches
  // to the requested view. ⇧⌘ + mnemonic letter chosen to avoid existing
  // ⌘+letter bindings, macOS-reserved shortcuts, and Electron defaults.
  const showSessionsItem: MenuItemConstructorOptions = {
    label: 'Show Sessions',
    accelerator: 'Shift+CmdOrCtrl+S',
    click: sendToFocused('app:request-sidebar-sessions'),
  };
  const showHistoryItem: MenuItemConstructorOptions = {
    label: 'Show History',
    accelerator: 'Shift+CmdOrCtrl+Y',
    click: sendToFocused('app:request-sidebar-history'),
  };
  const showAnalyticsItem: MenuItemConstructorOptions = {
    label: 'Show Analytics',
    accelerator: 'Shift+CmdOrCtrl+L',
    click: sendToFocused('app:request-sidebar-analytics'),
  };
  const showPluginsItem: MenuItemConstructorOptions = {
    label: 'Show Plugins',
    accelerator: 'Shift+CmdOrCtrl+P',
    click: sendToFocused('app:request-sidebar-plugins'),
  };
  // Browser-style navigation through session/sidebar history. Mouse buttons
  // 4/5 also dispatch these via the app-command handler in createWindow().
  const navigateBackItem: MenuItemConstructorOptions = {
    label: 'Navigate Back',
    accelerator: 'CmdOrCtrl+Alt+Left',
    click: sendToFocused('app:request-navigate-back'),
  };
  const navigateForwardItem: MenuItemConstructorOptions = {
    label: 'Navigate Forward',
    accelerator: 'CmdOrCtrl+Alt+Right',
    click: sendToFocused('app:request-navigate-forward'),
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
  // Tab cycling shortcuts. We register several aliases because muscle memory
  // varies between apps (browsers, VSCode, terminals).
  //   - Ctrl+Tab / Ctrl+Shift+Tab     — VSCode + browser standard
  //   - CmdOrCtrl+~                   — user-requested
  //   - CmdOrCtrl+PageDown / PageUp   — browser-style
  //   - CmdOrCtrl+Shift+] / [         — Mac browser convention
  // Cmd+Tab is *not* used on macOS because the OS owns it (app switcher).
  const nextTabAccelerators = [
    'Ctrl+Tab',
    'CmdOrCtrl+~',
    'CmdOrCtrl+PageDown',
    'CmdOrCtrl+Shift+]',
  ];
  const prevTabAccelerators = [
    'Ctrl+Shift+Tab',
    'CmdOrCtrl+PageUp',
    'CmdOrCtrl+Shift+[',
  ];
  // Electron only honours one accelerator per menu item, so we create a
  // visible "Next Tab" / "Previous Tab" item bound to the canonical shortcut
  // and add hidden duplicates for each alias. The hidden items keep the
  // shortcut active without cluttering the menu.
  const nextTabItem: MenuItemConstructorOptions = {
    label: 'Next Tab',
    accelerator: nextTabAccelerators[0],
    click: sendToFocused('app:request-next-tab'),
  };
  const prevTabItem: MenuItemConstructorOptions = {
    label: 'Previous Tab',
    accelerator: prevTabAccelerators[0],
    click: sendToFocused('app:request-prev-tab'),
  };
  const nextTabAliases: MenuItemConstructorOptions[] = nextTabAccelerators
    .slice(1)
    .map((acc) => ({
      label: `Next Tab (${acc})`,
      accelerator: acc,
      visible: false,
      click: sendToFocused('app:request-next-tab'),
    }));
  const prevTabAliases: MenuItemConstructorOptions[] = prevTabAccelerators
    .slice(1)
    .map((acc) => ({
      label: `Previous Tab (${acc})`,
      accelerator: acc,
      visible: false,
      click: sendToFocused('app:request-prev-tab'),
    }));

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
        toggleTerminalItem,
        { type: 'separator' },
        showSessionsItem,
        showHistoryItem,
        showAnalyticsItem,
        showPluginsItem,
        { type: 'separator' },
        navigateBackItem,
        navigateForwardItem,
        { type: 'separator' },
        shortcutsItem,
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
        nextTabItem,
        prevTabItem,
        ...nextTabAliases,
        ...prevTabAliases,
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
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:log-path', () => logPath());
  ipcMain.handle('app:reveal-log', () => {
    const p = logPath();
    if (!p) return;
    shell.showItemInFolder(p);
  });
  ipcMain.handle('app:open-external', (_e, url: string) => {
    // Only open well-formed http(s) URLs from the renderer — anything else
    // (file://, javascript:, custom schemes) is ignored to avoid surprises.
    if (typeof url !== 'string') return;
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
      void shell.openExternal(url);
    } catch {
      // Malformed URL — ignore.
    }
  });
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
  ipcMain.handle('fs:pick-files', async (e, defaultPath?: string) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const opts: OpenDialogOptions = {
      properties: ['openFile', 'multiSelections'],
      ...(defaultPath ? { defaultPath } : {}),
    };
    const result = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts);
    if (result.canceled || result.filePaths.length === 0) return [];
    return result.filePaths;
  });
  ipcMain.handle('fs:branch-for', (_e, path: string) => branchFor(path));
  ipcMain.handle('fs:is-readable-dir', (_e, path: string) => dirExists(path));
  ipcMain.handle('fs:git-init-session', (_e, input: GitInitSessionInput) =>
    gitInitSession(input),
  );

  ipcMain.handle('models:list', async () => {
    if (modelsCache) return modelsCache;
    modelsCache = await listSupportedModels();
    return modelsCache;
  });

  // Slash command discovery for the composer's autocomplete. Cheap + cached
  // inside discoverCommands, so the renderer can call it on every '/' keystroke.
  ipcMain.handle('commands:list', (_e, cwd: string) => discoverCommands(cwd));
  ipcMain.handle('skills:list', (_e, cwd: string) => discoverSkills(cwd));

  ipcMain.handle(
    'chat:send',
    async (
      _e,
      sessionId: SessionId,
      userText: string,
      turnId: string,
      globalSystemPrompt = '',
    ) => {
      log('chat:send', 'invoked', {
        sessionId,
        turnId,
        promptLen: userText.length,
        hasGlobalSystemPrompt: Boolean(globalSystemPrompt),
      });
      const db = getDb();
      const session = db.listSessions().find((s) => s.id === sessionId);
      if (!session) {
        log('chat:send', 'session-not-found', { sessionId });
        throw new Error(`Session not found: ${sessionId}`);
      }
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
  ipcMain.handle('sessions:create', (_e, input: CreateSessionInput) => {
    const session = getDb().createSession({
      id: input.id,
      name: input.name,
      path: input.path,
      model: input.model,
      systemPrompt: input.systemPrompt,
      branch: input.branch,
      createdAt: input.createdAt,
    });
    // Resume-past-session flow: stash the SDK session id so the first turn
    // continues the chosen Claude Code conversation instead of starting fresh.
    if (input.sdkSessionId) {
      getDb().updateSdkSessionId(input.id, input.sdkSessionId);
      session.sdkSessionId = input.sdkSessionId;
    }
    return session;
  });
  ipcMain.handle('claude-history:list', (_e, cwd: string) =>
    listClaudeSessions(cwd),
  );
  ipcMain.handle(
    'claude-history:load',
    (_e, cwd: string, sessionId: string) => loadClaudeSession(cwd, sessionId),
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
  ipcMain.handle('sessions:purge-all-deleted', () => getDb().purgeAllDeleted());
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

  ipcMain.handle(
    'terminal:open',
    (_e, sessionId: SessionId, cwd: string, cols: number, rows: number) =>
      openTerminal({ sessionId, cwd, cols, rows }),
  );
  ipcMain.handle('terminal:write', (_e, sessionId: SessionId, data: string) =>
    writeTerminal(sessionId, data),
  );
  ipcMain.handle(
    'terminal:resize',
    (_e, sessionId: SessionId, cols: number, rows: number) =>
      resizeTerminal(sessionId, cols, rows),
  );
  ipcMain.handle('terminal:close', (_e, sessionId: SessionId) =>
    closeTerminal(sessionId),
  );

  onTerminalData((sessionId, data) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('terminal:data', sessionId, data);
    }
  });
  onTerminalExit((sessionId, code) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('terminal:exit', sessionId, code);
    }
  });

  ipcMain.handle('updater:get-state', () => getUpdaterState());
  ipcMain.handle('updater:check', () => checkForUpdatesNow());
  ipcMain.handle('updater:install', () => quitAndInstallUpdate());
}

app.whenReady().then(() => {
  log('app', 'ready', {
    version: app.getVersion(),
    platform,
    packaged: app.isPackaged,
    logPath: logPath(),
    electron: process.versions.electron,
    node: process.versions.node,
  });
  // Dev-only Dock icon override. Compiled main lives at out/main/index.js,
  // so ../../resources/icon.png resolves to the project root in dev.
  if (!app.isPackaged && isMac && app.dock) {
    app.dock.setIcon(join(__dirname, '..', '..', 'resources', 'icon.png'));
  }
  // Tell the plugin discovery where our bundled slash commands live. In
  // dev that's `<repo>/resources/commands` (relative to the compiled main
  // at out/main/index.js); in a packaged build electron-builder copies
  // the same folder to `<resources>/commands` via the `extraResources`
  // entry in package.json, exposed at runtime as `process.resourcesPath`.
  const builtinCommands = app.isPackaged
    ? join(process.resourcesPath, 'commands')
    : join(__dirname, '..', '..', 'resources', 'commands');
  setBuiltinCommandsDir(builtinCommands);

  sessionsDb = openSessionsDb(join(app.getPath('userData'), 'sessions.db'));
  registerIpc();
  Menu.setApplicationMenu(buildMenu());
  const win = createWindow();

  // Arm electron-updater. The function bails out in dev / when
  // MS_DISABLE_AUTO_UPDATE=1, and the renderer reads the disabled state
  // before showing any banner — so it's safe to call unconditionally.
  void initAutoUpdater(() => {
    return BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ?? win;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

app.on('will-quit', () => {
  disposeAllTerminals();
  sessionsDb?.close();
  sessionsDb = null;
});
