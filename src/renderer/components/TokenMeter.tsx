import { useRef, useState } from 'react';
import type { Session } from '@shared/types';
import { costFor, formatTokens, formatUSD, totalTokens } from '@shared/pricing';
import { Icon } from './Icon';
import { UsagePopover } from './UsagePopover';
import type { Anchor } from './ContextMenu';

interface TokenMeterProps {
  session: Session;
}

/**
 * Status-bar pill showing the active session's accumulated token spend +
 * a USD estimate. Clicking opens the breakdown popover anchored above the pill.
 */
export function TokenMeter({ session }: TokenMeterProps) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const tokens = totalTokens(session.usage);
  const cost = costFor(session.usage, session.model);

  const open = (): void => {
    if (anchor) {
      setAnchor(null);
      return;
    }
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Clamp the popover's left so its right edge stays inside the viewport.
    // POP_WIDTH must track .usage-pop's width in app.css.
    const POP_WIDTH = 320;
    const MARGIN = 8;
    const maxLeft = window.innerWidth - POP_WIDTH - MARGIN;
    const left = Math.max(MARGIN, Math.min(r.left, maxLeft));
    setAnchor({
      left,
      bottom: window.innerHeight - r.top + 6,
    });
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="st-seg st-btn st-tokens"
        onClick={open}
        title="Token usage for this session"
        aria-label="Token usage"
        aria-expanded={anchor ? 'true' : 'false'}
        data-testid="token-meter"
      >
        <Icon name="cpu" />
        <span>{formatTokens(tokens)} tok</span>
        <span className="st-tokens-sep">·</span>
        <span>{formatUSD(cost.total)}</span>
      </button>
      {anchor && (
        <UsagePopover
          anchor={anchor}
          triggerEl={btnRef.current}
          session={session}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}
