import { useEffect, useRef, useState } from 'react';
import type { ModelId } from '@shared/types';
import type { SdkModel } from '@shared/api';
import { Icon } from './Icon';
import { MODELS } from '../data/models';
import { usePopoverClose } from '../lib/usePopoverClose';

interface ModelPickerProps {
  value: ModelId;
  onChange(id: ModelId): void;
}

interface DisplayModel {
  id: string;
  label: string;
  description: string;
}

const LOCAL_MODELS: DisplayModel[] = Object.values(MODELS).map((m) => ({
  id: m.id,
  label: m.name,
  description: m.description,
}));

function toDisplay(m: SdkModel): DisplayModel {
  return {
    id: m.id,
    label: m.displayName || m.id,
    description: m.description ?? '',
  };
}

export function ModelPicker({ value, onChange }: ModelPickerProps) {
  const [models, setModels] = useState<DisplayModel[]>(LOCAL_MODELS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  usePopoverClose(panelRef, () => setOpen(false), {
    triggerEl: triggerRef.current,
  });

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

  const visible = models.some((m) => m.id === value)
    ? models
    : [{ id: value, label: value, description: '' }, ...models];
  const current = visible.find((m) => m.id === value) ?? visible[0]!;

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="model-dd">
      <button
        ref={triggerRef}
        type="button"
        className="model-dd-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mdd-current">{current.label}</span>
        {current.description && (
          <span className="mdd-desc">{current.description}</span>
        )}
        <Icon name="chevD" className="mdd-chev" />
      </button>

      {open && (
        <div ref={panelRef} className="model-dd-panel" role="listbox">
          <div className="mdd-hd">
            <strong>Select model</strong>
            <span>Pick the Claude model for this session.</span>
          </div>
          <ol className="mdd-list">
            {visible.map((m, i) => {
              const selected = m.id === value;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={'mdd-item' + (selected ? ' sel' : '')}
                    onClick={() => pick(m.id)}
                  >
                    <span className="mdd-num">{i + 1}.</span>
                    <span className="mdd-name">
                      {m.label}
                      {selected && <Icon name="check" className="mdd-check" />}
                    </span>
                    {m.description && (
                      <span className="mdd-row-desc">{m.description}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
          {loading && <div className="mdd-foot">Loading models…</div>}
          {error && !loading && (
            <div className="mdd-foot" role="alert">
              Showing built-in models (couldn’t reach the SDK list).
            </div>
          )}
        </div>
      )}
    </div>
  );
}
