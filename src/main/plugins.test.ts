import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  clearPluginCache,
  discoverCommands,
  discoverPlugins,
  discoverSkills,
  setBuiltinCommandsDir,
} from './plugins';

async function writeManifest(dir: string): Promise<void> {
  await fs.mkdir(join(dir, '.claude-plugin'), { recursive: true });
  await fs.writeFile(
    join(dir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'fake' }),
  );
}

describe('discoverPlugins', () => {
  let workdir: string;

  beforeEach(async () => {
    clearPluginCache();
    workdir = await mkdtemp(join(tmpdir(), 'ms-plugins-'));
  });

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  it('returns an empty list when no .claude/plugins dir exists', () => {
    expect(discoverPlugins(workdir)).toEqual([]);
  });

  it('discovers a project-local plugin', async () => {
    const plugin = join(workdir, '.claude', 'plugins', 'sec-review');
    await writeManifest(plugin);
    const result = discoverPlugins(workdir);
    expect(result).toEqual([{ type: 'local', path: plugin }]);
  });

  it('skips directories without a plugin.json manifest', async () => {
    const real = join(workdir, '.claude', 'plugins', 'real');
    const fake = join(workdir, '.claude', 'plugins', 'not-a-plugin');
    await writeManifest(real);
    await fs.mkdir(fake, { recursive: true });
    const result = discoverPlugins(workdir);
    expect(result).toEqual([{ type: 'local', path: real }]);
  });

  it('deduplicates by absolute path', async () => {
    // Discovery scans user-global + project roots; if a plugin lives in both
    // (unusual but possible via a symlink chain), we should only list it once.
    const plugin = join(workdir, '.claude', 'plugins', 'dup');
    await writeManifest(plugin);
    const result = discoverPlugins(workdir);
    expect(result.filter((p) => p.path === plugin)).toHaveLength(1);
  });
});

describe('discoverCommands', () => {
  let workdir: string;

  beforeEach(async () => {
    clearPluginCache();
    workdir = await mkdtemp(join(tmpdir(), 'ms-commands-'));
  });

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  it('discovers standalone project commands with their descriptions', async () => {
    const dir = join(workdir, '.claude', 'commands');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      join(dir, 'review.md'),
      '---\ndescription: Review the diff for issues\n---\nPlease review...',
    );
    await fs.writeFile(join(dir, 'noop.md'), 'just a prompt with no frontmatter');

    const result = discoverCommands(workdir);
    expect(result).toEqual([
      { name: 'noop', scope: 'project' },
      { name: 'review', description: 'Review the diff for issues', scope: 'project' },
    ]);
  });

  it('namespaces plugin-bundled commands as pluginName:cmdName', async () => {
    const plugin = join(workdir, '.claude', 'plugins', 'sec-pack');
    await fs.mkdir(join(plugin, '.claude-plugin'), { recursive: true });
    await fs.writeFile(
      join(plugin, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'sec-pack' }),
    );
    await fs.mkdir(join(plugin, 'commands'), { recursive: true });
    await fs.writeFile(
      join(plugin, 'commands', 'audit.md'),
      '---\ndescription: Security audit\n---\nAudit prompt...',
    );

    const result = discoverCommands(workdir);
    expect(result).toContainEqual({
      name: 'sec-pack:audit',
      description: 'Security audit',
      scope: 'plugin',
    });
  });

  it('returns an empty list when nothing exists', () => {
    expect(discoverCommands(workdir)).toEqual([]);
  });

  it('exposes built-in commands when a builtinCommandsDir is set', async () => {
    const builtins = join(workdir, 'app-resources', 'commands');
    await fs.mkdir(builtins, { recursive: true });
    await fs.writeFile(
      join(builtins, 'security-review.md'),
      '---\ndescription: Security review\n---\nprompt body',
    );
    setBuiltinCommandsDir(builtins);
    try {
      const result = discoverCommands(workdir);
      expect(result).toContainEqual({
        name: 'security-review',
        description: 'Security review',
        scope: 'builtin',
      });
    } finally {
      setBuiltinCommandsDir(null);
    }
  });

  it('lets a project command override a built-in of the same name', async () => {
    const builtins = join(workdir, 'app-resources', 'commands');
    const project = join(workdir, '.claude', 'commands');
    await fs.mkdir(builtins, { recursive: true });
    await fs.mkdir(project, { recursive: true });
    await fs.writeFile(
      join(builtins, 'test.md'),
      '---\ndescription: Built-in test runner\n---\nbuilt-in',
    );
    await fs.writeFile(
      join(project, 'test.md'),
      '---\ndescription: Project test runner\n---\nproject',
    );
    setBuiltinCommandsDir(builtins);
    try {
      const result = discoverCommands(workdir);
      const test = result.find((c) => c.name === 'test');
      expect(test).toEqual({
        name: 'test',
        description: 'Project test runner',
        scope: 'project',
      });
      // And only one entry — dedup actually worked.
      expect(result.filter((c) => c.name === 'test')).toHaveLength(1);
    } finally {
      setBuiltinCommandsDir(null);
    }
  });
});

describe('discoverSkills', () => {
  let workdir: string;

  beforeEach(async () => {
    clearPluginCache();
    workdir = await mkdtemp(join(tmpdir(), 'ms-skills-'));
  });

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  it('returns an empty list when no skills exist anywhere', () => {
    expect(discoverSkills(workdir)).toEqual([]);
  });

  it('discovers a project skill with description', async () => {
    const skill = join(workdir, '.claude', 'skills', 'review-prs');
    await fs.mkdir(skill, { recursive: true });
    await fs.writeFile(
      join(skill, 'SKILL.md'),
      '---\ndescription: Review pull requests\n---\nSkill body...',
    );
    const result = discoverSkills(workdir);
    expect(result).toEqual([
      { name: 'review-prs', description: 'Review pull requests', scope: 'project' },
    ]);
  });

  it('namespaces plugin-bundled skills as pluginName:skillName', async () => {
    const plugin = join(workdir, '.claude', 'plugins', 'sec-pack');
    await fs.mkdir(join(plugin, '.claude-plugin'), { recursive: true });
    await fs.writeFile(
      join(plugin, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'sec-pack' }),
    );
    await fs.mkdir(join(plugin, 'skills', 'audit'), { recursive: true });
    await fs.writeFile(
      join(plugin, 'skills', 'audit', 'SKILL.md'),
      '---\ndescription: Security audit skill\n---\nBody',
    );
    const result = discoverSkills(workdir);
    expect(result).toContainEqual({
      name: 'sec-pack:audit',
      description: 'Security audit skill',
      scope: 'plugin',
    });
  });

  it('ignores skill directories without a SKILL.md file', async () => {
    const skill = join(workdir, '.claude', 'skills', 'incomplete');
    await fs.mkdir(skill, { recursive: true });
    expect(discoverSkills(workdir)).toEqual([]);
  });
});
