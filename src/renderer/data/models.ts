import type { ModelFamily, ModelId } from '@shared/types';

export interface ModelInfo {
  id: ModelId;
  family: ModelFamily;
  /** Long form, e.g. "Claude Sonnet 4.6". */
  name: string;
  /** Short form, e.g. "Sonnet". */
  short: string;
  /** Marketing tier label, e.g. "Most capable", "Balanced", "Fastest". */
  tier: string;
  /** Hex color or CSS var, used for the model dot. */
  color: string;
  description: string;
}

export const MODELS: Record<ModelId, ModelInfo> = {
  'claude-opus-4-6': {
    id: 'claude-opus-4-6',
    family: 'opus',
    name: 'Claude Opus 4.6',
    short: 'Opus',
    tier: 'Most capable',
    color: 'var(--model-opus)',
    description: 'Deepest reasoning for hard, multi-step work. Slower and higher cost.',
  },
  'claude-sonnet-4-6': {
    id: 'claude-sonnet-4-6',
    family: 'sonnet',
    name: 'Claude Sonnet 4.6',
    short: 'Sonnet',
    tier: 'Balanced',
    color: 'var(--model-sonnet)',
    description: 'The everyday default — strong coding and reasoning at good speed.',
  },
  'claude-haiku-4-5': {
    id: 'claude-haiku-4-5',
    family: 'haiku',
    name: 'Claude Haiku 4.5',
    short: 'Haiku',
    tier: 'Fastest',
    color: 'var(--model-haiku)',
    description: 'Near-instant responses for quick edits, lookups, and light tasks.',
  },
};

/** Context window size in tokens — currently uniform across all M1 mocked models. */
export const CTX_WINDOW = 200_000;

export function getModel(id: ModelId): ModelInfo | undefined {
  return MODELS[id];
}
