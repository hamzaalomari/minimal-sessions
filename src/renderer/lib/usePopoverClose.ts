import { useEffect } from 'react';
import type { RefObject } from 'react';

interface Options {
  /**
   * The trigger element that opened this popover. Mousedown on it is *ignored*
   * by the outside-click handler so the trigger's own click handler can toggle
   * the popover closed on a second click — otherwise the mousedown closes it,
   * and the subsequent click reopens it.
   */
  triggerEl?: HTMLElement | null;
}

/**
 * Close a popover on outside-mousedown or Escape. Pass the popover ref
 * and a stable callback. Both events are added once and reuse the latest callback.
 */
export function usePopoverClose(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  options: Options = {},
): void {
  const { triggerEl } = options;
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const el = ref.current;
      if (!el || !(e.target instanceof Node)) return;
      if (el.contains(e.target)) return;
      if (triggerEl && triggerEl.contains(e.target)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, onClose, triggerEl]);
}
