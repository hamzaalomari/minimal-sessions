import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

interface ModalProps {
  title: string;
  description?: string;
  onClose(): void;
  children: ReactNode;
  /** Hides the X button — useful for first-run / blocking modals. */
  noClose?: boolean;
  /** Footer actions row. */
  footer?: ReactNode;
}

export function Modal({
  title,
  description,
  onClose,
  children,
  noClose = false,
  footer,
}: ModalProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !noClose) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, noClose]);

  return (
    <>
      <div
        className="modal-scrim"
        onClick={noClose ? undefined : onClose}
        data-testid="modal-scrim"
      />
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-hd">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {!noClose && (
            <button
              type="button"
              className="modal-x"
              onClick={onClose}
              aria-label="Close"
            >
              <Icon name="x" />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </>
  );
}
