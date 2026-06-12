/**
 * Discovery of Claude Code plugins for the Agent SDK.
 *
 * A plugin directory is any folder containing a `.claude-plugin/plugin.json`
 * manifest. Inside, the SDK auto-loads `commands/` (slash commands), `skills/`
 * (autonomous skills), `agents/` (subagents), `hooks/`, and `.mcp.json`.
 *
 * We scan two locations on every turn (cached briefly):
 *  1. `~/.claude/plugins/<plugin>/`  — CLI-installed user-global plugins
 *  2. `<cwd>/.claude/plugins/<plugin>/` — project-local plugins
 *
 * Discovered paths are then handed to the SDK via the `plugins: SdkPluginConfig[]`
 * option, after which their slash commands (`/foo`, `/plugin:foo`), skills,
 * hooks, and MCP servers all become available to the agent automatically.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface PluginPath {
  type: 'local';
  path: string;
}

/** A slash command surfaced to the renderer for autocomplete. */
export interface SlashCommand {
  /** The text after the leading "/" that invokes this command, e.g. "test"
   *  or "myplugin:review". Doesn't include the leading slash. */
  name: string;
  /** Short human description from the file's YAML frontmatter, when present. */
  description?: string;
  /** Where this command came from — drives the badge in the suggestion list. */
  scope: 'project' | 'user' | 'plugin' | 'builtin';
}

/** Cache entry — keyed by cwd. The discovery itself is cheap (a couple of
 *  readdir + stat calls) but a chat session can issue many turns per minute,
 *  and re-scanning every time would burn IO for no real benefit. The TTL is
 *  short enough that newly-installed plugins surface within a minute. */
interface CacheEntry {
  paths: PluginPath[];
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

/** Same shape as the plugin path cache, but for the richer command listing. */
const commandsCache = new Map<string, { commands: SlashCommand[]; expiresAt: number }>();

/** Directory of commands shipped with the app itself — set once at startup
 *  by `main/index.ts` using `app.isPackaged` to pick dev vs. packaged path.
 *  Kept here as module state so `plugins.ts` doesn't depend on `electron`
 *  (would break tests). */
let builtinCommandsDir: string | null = null;

/** Set the absolute path to the bundled built-in commands directory. Called
 *  from main on app startup. Idempotent — passing null disables the source. */
export function setBuiltinCommandsDir(dir: string | null): void {
  builtinCommandsDir = dir;
  commandsCache.clear();
}

/** Reset all caches. Exposed for tests; not used at runtime. */
export function clearPluginCache(): void {
  cache.clear();
  commandsCache.clear();
}

/**
 * Discover all installed Claude Code plugins relevant to `cwd`. The result is
 * suitable to pass straight to the SDK's `options.plugins`.
 */
export function discoverPlugins(cwd: string): PluginPath[] {
  const cached = cache.get(cwd);
  if (cached && cached.expiresAt > Date.now()) return cached.paths;

  const roots = [
    join(homedir(), '.claude', 'plugins'),
    ...(cwd ? [join(cwd, '.claude', 'plugins')] : []),
  ];
  const seen = new Set<string>();
  const paths: PluginPath[] = [];

  for (const root of roots) {
    for (const dir of safeListDirs(root)) {
      const full = join(root, dir);
      if (seen.has(full)) continue;
      if (!isPluginDir(full)) continue;
      seen.add(full);
      paths.push({ type: 'local', path: full });
    }
  }

  cache.set(cwd, { paths, expiresAt: Date.now() + CACHE_TTL_MS });
  return paths;
}

/**
 * Enumerate slash commands available for `cwd`. Pulls from three sources:
 *  1. `~/.claude/commands/<name>.md` — standalone user-global commands
 *  2. `<cwd>/.claude/commands/<name>.md` — standalone project commands
 *  3. `<plugin>/commands/<name>.md` — plugin-bundled commands (namespaced
 *     as `<pluginName>:<name>` matching the SDK's invocation format)
 *
 * Same TTL cache as `discoverPlugins` so the renderer can poll cheaply.
 */
export function discoverCommands(cwd: string): SlashCommand[] {
  const cached = commandsCache.get(cwd);
  if (cached && cached.expiresAt > Date.now()) return cached.commands;

  const commands: SlashCommand[] = [];
  const seenNames = new Set<string>();

  const addCommand = (cmd: SlashCommand): void => {
    if (seenNames.has(cmd.name)) return;
    seenNames.add(cmd.name);
    commands.push(cmd);
  };

  // Priority order = added order, since `addCommand` skips on name collision.
  // We want the most specific source to win:
  //   project (this repo)  →  user (~/.claude)  →  plugin  →  builtin (bundled)
  // Built-ins are last so any user-authored or plugin command always overrides
  // them. That way upgrading the app's defaults never clobbers user edits.

  if (cwd) {
    for (const md of listCommandFiles(join(cwd, '.claude', 'commands'))) {
      addCommand({
        name: md.name,
        ...(md.description ? { description: md.description } : {}),
        scope: 'project',
      });
    }
  }
  for (const md of listCommandFiles(join(homedir(), '.claude', 'commands'))) {
    addCommand({
      name: md.name,
      ...(md.description ? { description: md.description } : {}),
      scope: 'user',
    });
  }

  // Plugin-bundled commands — namespaced.
  for (const plugin of discoverPlugins(cwd)) {
    const pluginName = readPluginName(plugin.path);
    if (!pluginName) continue;
    for (const md of listCommandFiles(join(plugin.path, 'commands'))) {
      addCommand({
        name: `${pluginName}:${md.name}`,
        ...(md.description ? { description: md.description } : {}),
        scope: 'plugin',
      });
    }
  }

  // Built-ins shipped with the installer — fall back when nothing else
  // provides the same name.
  if (builtinCommandsDir) {
    for (const md of listCommandFiles(builtinCommandsDir)) {
      addCommand({
        name: md.name,
        ...(md.description ? { description: md.description } : {}),
        scope: 'builtin',
      });
    }
  }

  commands.sort((a, b) => a.name.localeCompare(b.name));
  commandsCache.set(cwd, { commands, expiresAt: Date.now() + CACHE_TTL_MS });
  return commands;
}

interface CommandFile {
  name: string;
  description?: string;
}

/** List *.md files in a commands directory, parsing each one's frontmatter
 *  for an optional description. Returns [] for missing/unreadable dirs. */
function listCommandFiles(dir: string): CommandFile[] {
  const out: CommandFile[] = [];
  for (const entry of safeListEntries(dir)) {
    if (!entry.endsWith('.md')) continue;
    const name = entry.slice(0, -3);
    const description = readFrontmatterDescription(join(dir, entry));
    out.push({ name, ...(description ? { description } : {}) });
  }
  return out;
}

/** Read a plugin's manifest to get its canonical `name` for namespacing.
 *  Falls back to the directory name if the manifest is missing or malformed. */
function readPluginName(pluginPath: string): string {
  try {
    const raw = readFileSync(
      join(pluginPath, '.claude-plugin', 'plugin.json'),
      'utf-8',
    );
    const json = JSON.parse(raw) as { name?: unknown };
    if (typeof json.name === 'string' && json.name) return json.name;
  } catch {
    // fall through
  }
  const tail = pluginPath.split(/[/\\]/).filter(Boolean).pop();
  return tail ?? '';
}

/**
 * Minimal YAML frontmatter scanner — pulls just the `description:` line out
 * of the block between leading `---` markers. We don't want a full yaml
 * dependency just for one field; command files only use a handful of
 * top-level keys and `description` is the only one the suggestion UI cares
 * about. Returns undefined when missing or empty.
 */
function readFrontmatterDescription(file: string): string | undefined {
  try {
    const raw = readFileSync(file, 'utf-8');
    if (!raw.startsWith('---')) return undefined;
    const end = raw.indexOf('\n---', 3);
    if (end < 0) return undefined;
    const block = raw.slice(3, end);
    for (const line of block.split('\n')) {
      const m = /^\s*description\s*:\s*(.+?)\s*$/i.exec(line);
      if (!m) continue;
      // Strip optional surrounding quotes.
      const value = m[1]!.replace(/^['"]|['"]$/g, '').trim();
      return value || undefined;
    }
  } catch {
    // fall through
  }
  return undefined;
}

function safeListEntries(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/** Synchronous listing that returns [] for any missing/unreadable root, so
 *  callers don't need to worry about whether `~/.claude/plugins` exists. */
function safeListDirs(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/** A plugin dir is anything containing a `.claude-plugin/plugin.json` file. */
function isPluginDir(full: string): boolean {
  try {
    const manifest = join(full, '.claude-plugin', 'plugin.json');
    return existsSync(manifest) && statSync(manifest).isFile();
  } catch {
    return false;
  }
}
