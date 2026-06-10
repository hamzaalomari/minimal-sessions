/** Mock filesystem for the M1 FolderPicker. M3 replaces this with Electron's
 * dialog.showOpenDialog. */
export interface MockFolder {
  name: string;
  meta?: string;
}

export const FOLDER_TREE: Record<string, MockFolder[]> = {
  '~': [
    { name: 'dev', meta: '24 items' },
    { name: 'sandbox', meta: '3 items' },
    { name: 'Documents' },
    { name: 'Downloads' },
  ],
  '~/dev': [
    { name: 'acme', meta: '6 repos' },
    { name: 'internal', meta: '4 repos' },
    { name: 'open-source' },
  ],
  '~/dev/acme': [
    { name: 'auth-service', meta: 'git' },
    { name: 'marketing-site', meta: 'git' },
    { name: 'billing-api', meta: 'git' },
    { name: 'design-system', meta: 'git' },
  ],
  '~/dev/internal': [
    { name: 'data-pipelines', meta: 'git' },
    { name: 'infra', meta: 'git' },
  ],
  '~/sandbox': [{ name: 'scratch' }, { name: 'prototypes' }],
};

export function hasChildren(path: string): boolean {
  return FOLDER_TREE[path] != null;
}

export function childPath(cwd: string, name: string): string {
  return cwd === '~' ? '~/' + name : cwd + '/' + name;
}
