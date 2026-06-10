import type { ModelId } from '@shared/types';
import { MODELS } from '../data/models';

interface ModelPickerProps {
  value: ModelId;
  onChange(id: ModelId): void;
}

export function ModelPicker({ value, onChange }: ModelPickerProps) {
  return (
    <div className="model-grid" role="radiogroup" aria-label="Model">
      {Object.values(MODELS).map((m) => {
        const selected = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={'model-card' + (selected ? ' sel' : '')}
            onClick={() => onChange(m.id)}
          >
            <span className="mc-dot" style={{ background: m.color }} />
            <span className="mc-main">
              <span className="mc-name">
                {m.name} <span className="mc-tier">{m.tier}</span>
              </span>
              <span className="mc-desc">{m.description}</span>
            </span>
            <span className="mc-radio" />
          </button>
        );
      })}
    </div>
  );
}
