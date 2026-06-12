import { memo, useEffect, useRef } from 'react';
import type { Session } from '@shared/types';
import { Icon } from './Icon';
import { SessionHead } from './SessionHead';
import { Turn } from './Turn';

interface TranscriptProps {
  session: Session;
  typing?: boolean;
  /** Increment this on the parent to force a scroll-to-bottom — used after
   *  the user hits Send so they always see the new turn + streaming reply,
   *  regardless of where they had previously scrolled. */
  pinToBottomNonce?: number;
}

/** Pixels of slack at the bottom that still count as "at the bottom" — once
 *  the user is within this band they stay pinned to incoming content. */
const STICKY_TOLERANCE = 60;

/** Scroll instantly to the bottom; falls back to direct assignment so jsdom
 *  (which doesn't implement Element.scrollTo) still works in tests. */
function scrollToBottom(el: HTMLElement): void {
  if (typeof el.scrollTo === 'function') {
    el.scrollTo({ top: el.scrollHeight, behavior: 'instant' as ScrollBehavior });
  } else {
    el.scrollTop = el.scrollHeight;
  }
}

// Memoized at the top level. When the user types in the composer, SessionPane
// re-renders with a new draft string, but the displaySession reference is
// stable while not streaming — so Transcript (and its whole subtree) skips.
export const Transcript = memo(function Transcript({
  session,
  typing = false,
  pinToBottomNonce = 0,
}: TranscriptProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  /** True while incoming content should auto-scroll the view. Flips to false
   *  the moment the user scrolls upward; flips back to true when they
   *  scroll back to within STICKY_TOLERANCE of the bottom. */
  const stickRef = useRef(true);

  // A fresh session starts pinned to the latest message.
  useEffect(() => {
    stickRef.current = true;
    const el = ref.current;
    if (el) {
      scrollToBottom(el);
    }
  }, [session.id]);

  // Parent-driven force-scroll. When the user sends a message, SessionPane
  // bumps this nonce — we re-stick to the bottom and scroll, even if the user
  // had previously scrolled up. Skip the no-op initial render at value 0.
  useEffect(() => {
    if (pinToBottomNonce === 0) return;
    stickRef.current = true;
    const el = ref.current;
    if (el) scrollToBottom(el);
  }, [pinToBottomNonce]);

  useEffect(() => {
    const outer = ref.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const onScroll = (): void => {
      const dist = outer.scrollHeight - outer.scrollTop - outer.clientHeight;
      stickRef.current = dist <= STICKY_TOLERANCE;
    };

    // ResizeObserver fires whenever streamed content grows the inner height.
    // Auto-scroll only when the user is currently "stuck" to the bottom.
    // Use behavior: 'instant' so the scroll-behavior: smooth on .transcript
    // doesn't kick in — smooth + ResizeObserver would chase its own tail.
    const ro = new ResizeObserver(() => {
      if (stickRef.current) scrollToBottom(outer);
    });
    ro.observe(inner);
    outer.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      ro.disconnect();
      outer.removeEventListener('scroll', onScroll);
    };
  }, []);

  // While streaming, fold the dots into the last assistant turn instead of
  // showing a second "Claude" header below the in-flight content. Fallback
  // (no turns yet, or last turn is the user's) renders the standalone header.
  const lastIdx = session.turns.length - 1;
  const lastIsAssistant =
    lastIdx >= 0 && session.turns[lastIdx]!.role === 'assistant';
  const trailingTyping = typing && lastIsAssistant;
  const standaloneTyping = typing && !lastIsAssistant;

  return (
    <div className="transcript scroll" ref={ref} data-testid="transcript">
      <div className="transcript-inner" ref={innerRef}>
        <SessionHead session={session} />
        {session.turns.map((t, i) => (
          <Turn key={t.id} turn={t} typing={trailingTyping && i === lastIdx} />
        ))}
        {standaloneTyping && (
          <div className="turn assistant">
            <div className="turn-role">
              <span className="role-badge asst">
                <Icon name="spark" />
              </span>
              <span className="role-name">Claude</span>
            </div>
            <div className="turn-body">
              <div className="typing-dots" data-testid="typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
