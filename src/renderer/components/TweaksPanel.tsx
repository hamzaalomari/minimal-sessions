import { useShallow } from 'zustand/react/shallow';
import { Modal } from './Modal';
import { useTweaks } from '../state/tweaks';

interface TweaksPanelProps {
  onClose(): void;
}

export function TweaksPanel({ onClose }: TweaksPanelProps) {
  const { theme, readFont, systemPrompt, setTheme, setReadFont, setSystemPrompt } =
    useTweaks(
      useShallow((s) => ({
        theme: s.theme,
        readFont: s.readFont,
        systemPrompt: s.systemPrompt,
        setTheme: s.setTheme,
        setReadFont: s.setReadFont,
        setSystemPrompt: s.setSystemPrompt,
      })),
    );

  return (
    <Modal
      title="Tweaks"
      description="App-wide preferences. Changes apply immediately."
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="tweaks-section">
        <div className="set-row">
          <div>
            <div className="set-label">Theme</div>
            <div className="set-sub">Light or dark interface</div>
          </div>
          <div className="seg" role="radiogroup" aria-label="Theme">
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'light'}
              className={theme === 'light' ? 'on' : ''}
              onClick={() => setTheme('light')}
            >
              Light
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'dark'}
              className={theme === 'dark' ? 'on' : ''}
              onClick={() => setTheme('dark')}
            >
              Dark
            </button>
          </div>
        </div>
        <div className="set-row">
          <div>
            <div className="set-label">Reading font</div>
            <div className="set-sub">Body text in the transcript</div>
          </div>
          <div className="seg" role="radiogroup" aria-label="Reading font">
            <button
              type="button"
              role="radio"
              aria-checked={readFont === 'sans'}
              className={readFont === 'sans' ? 'on' : ''}
              onClick={() => setReadFont('sans')}
            >
              Sans
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={readFont === 'serif'}
              className={readFont === 'serif' ? 'on' : ''}
              onClick={() => setReadFont('serif')}
            >
              Serif
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={readFont === 'mono'}
              className={readFont === 'mono' ? 'on' : ''}
              onClick={() => setReadFont('mono')}
            >
              Mono
            </button>
          </div>
        </div>
        <div className="tweaks-preview" data-testid="tweaks-preview">
          The quick brown fox jumps over the lazy dog.
        </div>
      </div>
      <div className="tweaks-section">
        <label className="ns-label" htmlFor="tweaks-system-prompt">
          Global system prompt
        </label>
        <div className="tweaks-hint">
          Prepended to every session&rsquo;s own system prompt before each turn. Leave blank to skip.
        </div>
        <textarea
          id="tweaks-system-prompt"
          className="ns-input edit-instructions-ta"
          rows={8}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a careful coding assistant…"
          data-testid="tweaks-system-prompt"
        />
      </div>
    </Modal>
  );
}
