import { useEffect, useState } from 'react';
import type { ModelId } from '@shared/types';
import type { SdkModel } from '@shared/api';
import { Icon } from './Icon';
import { MODELS } from '../data/models';

interface ModelPickerProps {
  value: ModelId;
  onChange(id: ModelId): void;
}

interface DisplayModel {
  id: string;
  label: string;
  hint: string;
}

const LOCAL_MODELS: DisplayModel[] = Object.values(MODELS).map((m) => ({
  id: m.id,
  label: m.name,
  hint: m.tier,
}));

function toDisplay(m: SdkModel): DisplayModel {
  return {
    id: m.id,
    label: m.displayName || m.id,
    hint: m.description?.slice(0, 80) ?? '',
  };
}

export function ModelPicker({ value, onChange }: ModelPickerProps) {
  const [models, setModels] = useState<DisplayModel[]>(LOCAL_MODELS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!window.api?.models) {
      setLoading(false);
      return;
    }
    void window.api.models
      .list()
      .then((sdkModels) => {
        if (cancelled) return;
        if (sdkModels && sdkModels.length > 0) {
          setModels(sdkModels.map(toDisplay));
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // If the current value isn't in the list, include it as an option so the
  // select still reflects it.
  const visible = models.some((m) => m.id === value)
    ? models
    : [{ id: value, label: value, hint: '' }, ...models];

  return (
    <div className="model-select-wrap">
      <select
        className="model-select"
        aria-label="Model"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {visible.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
            {m.hint ? ` — ${m.hint}` : ''}
          </option>
        ))}
      </select>
      <Icon name="chevD" className="model-select-chev" />
      {loading && <span className="model-select-hint">Loading…</span>}
      {error && !loading && (
        <span className="model-select-hint" role="alert">
          Showing built-in models (couldn’t reach the SDK list).
        </span>
      )}
    </div>
  );
}
