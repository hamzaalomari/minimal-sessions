/**
 * Curated list of community Claude Code plugins surfaced in the
 * "Plugins" sidebar view.
 *
 * Each entry maps to a `claude plugin install <id>` command we run in the
 * embedded terminal. Adding a new entry is a one-line change here — no UI
 * follow-up needed. We deliberately keep this short and hand-curated; the
 * full ecosystem lives in community awesome-lists, and users can install
 * anything by running `claude plugin install` in the terminal directly.
 */
export interface MarketplacePlugin {
  /** Unique id used in the `claude plugin install <id>` command. Includes the
   *  marketplace suffix (`@anthropic-tools`, `@community`, etc.) per the CLI
   *  format. */
  installId: string;
  /** Human-readable name. */
  name: string;
  /** Author / org credit. */
  author: string;
  /** One-line description. */
  description: string;
  /** Tags surfaced as small badges below the description. */
  tags: string[];
  /** Optional canonical homepage / source URL. Opened externally. */
  url?: string;
}

export const MARKETPLACE_PLUGINS: MarketplacePlugin[] = [
  {
    installId: 'superpowers@obra',
    name: 'Superpowers',
    author: 'obra',
    description:
      'The most popular community skill pack — 90k+ stars. Accepted into Anthropic’s official skills marketplace.',
    tags: ['skills', 'official'],
    url: 'https://github.com/obra/superpowers',
  },
  {
    installId: 'awesome-claude-code@hesreallyhim',
    name: 'Awesome Claude Code',
    author: 'hesreallyhim',
    description:
      'Curated index of skills, hooks, slash commands, agents, and applications for Claude Code.',
    tags: ['index'],
    url: 'https://github.com/hesreallyhim/awesome-claude-code',
  },
  {
    installId: 'claude-command-suite@qdhenry',
    name: 'Claude Command Suite',
    author: 'qdhenry',
    description:
      'Professional slash commands for code review, feature creation, security auditing, and architectural analysis.',
    tags: ['commands', 'review'],
    url: 'https://github.com/qdhenry/Claude-Command-Suite',
  },
  {
    installId: 'frontend-design@claude-plugins-official',
    name: 'Frontend Design',
    author: 'claude-plugins-official',
    description:
      'Skills for visual design verification, screenshot review, and UI iteration.',
    tags: ['skills', 'design'],
  },
  {
    installId: 'awesome-claude-plugins@quemsah',
    name: 'Awesome Claude Plugins',
    author: 'quemsah',
    description:
      'Aggregator index of 15k+ Claude Code plugin repositories.',
    tags: ['index'],
    url: 'https://github.com/quemsah/awesome-claude-plugins',
  },
];
