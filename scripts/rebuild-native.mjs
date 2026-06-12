// Download the right `better-sqlite3` prebuilt binary for either the Electron
// runtime (for `npm run dev` / `npm run build`) or the bundled Node runtime
// (for `npm test`), so the ABI matches whatever's about to load the module.
//
// Why this exists: `@electron/rebuild` writes a `.forge-meta` cache marker
// (`<arch>--<abi>`) and treats it as authoritative, so a stale marker without
// a matching `.node` file silently makes the rebuild a no-op. Using
// `prebuild-install` directly skips that cache entirely — it just downloads
// the right `.node` file from the better-sqlite3 release.
//
// Usage: node scripts/rebuild-native.mjs --runtime=electron
//        node scripts/rebuild-native.mjs --runtime=node

import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const moduleDir = resolve(projectRoot, 'node_modules/better-sqlite3');
const prebuildInstall = resolve(
  projectRoot,
  'node_modules/.bin/prebuild-install',
);

// node-pty's npm post-install only chmods files in `build/Release`, but the
// prebuilt unix binary ships in `prebuilds/<platform>-<arch>/spawn-helper`
// without the executable bit. That makes `posix_spawnp` fail on first launch.
// Restore the bit here so it survives every `npm install`.
function fixNodePtySpawnHelper() {
  const nodePtyPrebuilds = resolve(
    projectRoot,
    'node_modules/node-pty/prebuilds',
  );
  if (!existsSync(nodePtyPrebuilds)) return;
  for (const arch of readdirSync(nodePtyPrebuilds)) {
    const helper = resolve(nodePtyPrebuilds, arch, 'spawn-helper');
    if (existsSync(helper)) {
      try {
        chmodSync(helper, 0o755);
      } catch (e) {
        console.warn(`[rebuild-native] failed to chmod ${helper}: ${e.message}`);
      }
    }
  }
}
fixNodePtySpawnHelper();

const runtimeArg = process.argv
  .find((a) => a.startsWith('--runtime='))
  ?.split('=')[1];
if (!runtimeArg || (runtimeArg !== 'electron' && runtimeArg !== 'node')) {
  console.error(
    'Usage: node scripts/rebuild-native.mjs --runtime=electron|node',
  );
  process.exit(1);
}

if (!existsSync(moduleDir)) {
  // Module not installed yet — `npm install` will run our install hook later.
  console.log(`[rebuild-native] ${moduleDir} not found; skipping.`);
  process.exit(0);
}

// Clear any stale forge-meta marker left behind by `@electron/rebuild` so it
// can't make a follow-up `electron-rebuild` no-op our work.
const forgeMeta = resolve(moduleDir, 'build/Release/.forge-meta');
if (existsSync(forgeMeta)) rmSync(forgeMeta);

if (runtimeArg === 'electron') {
  // For Electron we know exactly which Electron version we ship against, and
  // better-sqlite3 publishes a prebuilt for every Electron release. Use
  // prebuild-install directly — it's fast (~1s) and skips node-gyp.
  const target = JSON.parse(
    readFileSync(
      resolve(projectRoot, 'node_modules/electron/package.json'),
      'utf-8',
    ),
  ).version;
  console.log(
    `[rebuild-native] prebuild-install --runtime=electron --target=${target}`,
  );
  execFileSync(
    prebuildInstall,
    ['--runtime', 'electron', '--target', target, '--force'],
    { cwd: moduleDir, stdio: 'inherit' },
  );
} else {
  // For Node we let better-sqlite3's own install script do the work. It tries
  // prebuild-install first and falls back to `node-gyp rebuild` if there's no
  // matching prebuild for the current Node version (some patch releases lag).
  // That fallback is critical — prebuild-install fails hard otherwise.
  console.log('[rebuild-native] npm rebuild better-sqlite3 (Node runtime)');
  execFileSync('npm', ['rebuild', 'better-sqlite3', '--silent'], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
}
