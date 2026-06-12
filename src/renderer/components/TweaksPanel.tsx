import { useShallow } from 'zustand/react/shallow';
import { Modal } from './Modal';
import { ACCENT_PRESETS } from '../data/accent-presets';
import { CODE_THEMES } from '../data/code-themes';
import { DARK_PRESETS, LIGHT_PRESETS } from '../data/theme-presets';
import { useTweaks } from '../state/tweaks';

interface TweaksPanelProps {
  onClose(): void;
}

export function TweaksPanel({ onClose }: TweaksPanelProps) {
  const {
    theme,
    accent,
    readFont,
    lightPreset,
    darkPreset,
    composerStyle,
    chatWidth,
    chatTextScale,
    codeTheme,
    systemPrompt,
    setTheme,
    setAccent,
    setReadFont,
    setLightPreset,
    setDarkPreset,
    setComposerStyle,
    setChatWidth,
    setChatTextScale,
    setCodeTheme,
    setSystemPrompt,
  } = useTweaks(
    useShallow((s) => ({
      theme: s.theme,
      accent: s.accent,
      readFont: s.readFont,
      lightPreset: s.lightPreset,
      darkPreset: s.darkPreset,
      composerStyle: s.composerStyle,
      chatWidth: s.chatWidth,
      chatTextScale: s.chatTextScale,
      codeTheme: s.codeTheme,
      systemPrompt: s.systemPrompt,
      setTheme: s.setTheme,
      setAccent: s.setAccent,
      setReadFont: s.setReadFont,
      setLightPreset: s.setLightPreset,
      setDarkPreset: s.setDarkPreset,
      setComposerStyle: s.setComposerStyle,
      setChatWidth: s.setChatWidth,
      setChatTextScale: s.setChatTextScale,
      setCodeTheme: s.setCodeTheme,
      setSystemPrompt: s.setSystemPrompt,
    })),
  );

  const WIDTH_OPTS = [
    { id: 'narrow' as const, label: 'Narrow' },
    { id: 'normal' as const, label: 'Normal' },
    { id: 'wide' as const, label: 'Wide' },
    { id: 'full' as const, label: 'Full' },
  ];

  const SIZE_OPTS = [
    { id: 'sm' as const, label: 'Small' },
    { id: 'md' as const, label: 'Normal' },
    { id: 'lg' as const, label: 'Large' },
    { id: 'xl' as const, label: 'X-Large' },
  ];

  const accentMatch = (hex: string): boolean =>
    accent.toLowerCase() === hex.toLowerCase();

  const palettes = theme === 'light' ? LIGHT_PRESETS : DARK_PRESETS;
  const activePreset = theme === 'light' ? lightPreset : darkPreset;
  const setPreset = (id: string): void =>
    theme === 'light' ? setLightPreset(id) : setDarkPreset(id);

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
            <div className="set-label">Palette</div>
            <div className="set-sub">
              {theme === 'light' ? 'Light' : 'Dark'} variants
            </div>
          </div>
          <div className="accent-grid" role="radiogroup" aria-label="Palette preset">
            {palettes.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={activePreset === p.id}
                title={p.label}
                aria-label={p.label}
                className={'accent-swatch' + (activePreset === p.id ? ' on' : '')}
                style={{ background: p.preview }}
                onClick={() => setPreset(p.id)}
                data-testid={`preset-${p.id}`}
              />
            ))}
          </div>
        </div>
        <div className="set-row">
          <div>
            <div className="set-label">Accent</div>
            <div className="set-sub">Highlight color applied in light & dark</div>
          </div>
          <div className="accent-grid" role="radiogroup" aria-label="Accent color">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={accentMatch(p.hex)}
                title={p.label}
                aria-label={p.label}
                className={'accent-swatch' + (accentMatch(p.hex) ? ' on' : '')}
                style={{ background: p.hex }}
                onClick={() => setAccent(p.hex)}
                data-testid={`accent-${p.id}`}
              />
            ))}
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
        <div className="set-row">
          <div>
            <div className="set-label">Chat width</div>
            <div className="set-sub">Maximum width of the transcript column</div>
          </div>
          <div className="seg" role="radiogroup" aria-label="Chat width">
            {WIDTH_OPTS.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={chatWidth === o.id}
                className={chatWidth === o.id ? 'on' : ''}
                onClick={() => setChatWidth(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="set-row">
          <div>
            <div className="set-label">Text size</div>
            <div className="set-sub">Reading-text scale in the transcript</div>
          </div>
          <div className="seg" role="radiogroup" aria-label="Text size">
            {SIZE_OPTS.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={chatTextScale === o.id}
                className={chatTextScale === o.id ? 'on' : ''}
                onClick={() => setChatTextScale(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="set-row">
          <div>
            <div className="set-label">Composer style</div>
            <div className="set-sub">How the message input looks</div>
          </div>
          <div className="seg" role="radiogroup" aria-label="Composer style">
            <button
              type="button"
              role="radio"
              aria-checked={composerStyle === 'panel'}
              className={composerStyle === 'panel' ? 'on' : ''}
              onClick={() => setComposerStyle('panel')}
            >
              Panel
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={composerStyle === 'terminal'}
              className={composerStyle === 'terminal' ? 'on' : ''}
              onClick={() => setComposerStyle('terminal')}
            >
              Terminal
            </button>
          </div>
        </div>
        <div className="set-row">
          <div>
            <div className="set-label">Code theme</div>
            <div className="set-sub">Syntax-highlight palette for code blocks</div>
          </div>
          <select
            className="set-select"
            value={codeTheme}
            onChange={(e) => setCodeTheme(e.target.value)}
            aria-label="Code theme"
          >
            <optgroup label="Built-in">
              {CODE_THEMES.filter((t) => t.css === null).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Light">
              {CODE_THEMES.filter((t) => t.mood === 'light').map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Dark">
              {CODE_THEMES.filter((t) => t.mood === 'dark').map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Both">
              {CODE_THEMES.filter((t) => t.mood === 'both' && t.css !== null).map(
                (t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ),
              )}
            </optgroup>
          </select>
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
