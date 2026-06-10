import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Session } from '@shared/types';
import { Icon } from './Icon';
import { getModel } from '../data/models';

interface ComposerProps {
  session: Session;
  value: string;
  onChange(text: string): void;
  onSend(): void;
  busy?: boolean;
}

export function Composer({ session, value, onChange, onSend, busy = false }: ComposerProps) {
  const [focus, setFocus] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const m = getModel(session.model);
  const dot = m?.color ?? 'var(--faint)';
  const short = m?.short ?? session.model;

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(180, ta.scrollHeight) + 'px';
  }, [value]);

  const canSend = value.trim().length > 0 && !busy;
  const submit = () => {
    if (canSend) onSend();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const folderName = session.path.split('/').pop() || session.path;

  return (
    <div className="composer">
      <div className="composer-inner">
        <div className={'composer-box' + (focus ? ' focus' : '')}>
          <textarea
            ref={taRef}
            className="composer-ta"
            rows={1}
            aria-label="Message Claude"
            placeholder={`Message Claude about ${folderName}…`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            onKeyDown={onKeyDown}
          />
          <div className="composer-foot">
            <button type="button" className="cf-btn" title="Attach" aria-label="Attach">
              <Icon name="paperclip" />
            </button>
            <button type="button" className="cf-btn cf-model" title="Model for this session">
              <span className="cf-mdot" style={{ background: dot }} />
              {short}
            </button>
            <div className="cf-spacer" />
            <span className="cf-hint">↵ to send · ⇧↵ newline</span>
            <button
              type="button"
              className="send-btn"
              disabled={!canSend}
              onClick={submit}
              title="Send"
              aria-label="Send message"
            >
              <Icon name="send" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
