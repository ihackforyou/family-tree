import type { ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';

/**
 * Base UI Dialog shell around the existing `.dialog` card: focus trap, scroll lock,
 * Esc / outside-click dismissal and correct ARIA, without hand-written key handlers.
 */
export function Modal({
  onClose, label, closable = true, instant, className, children,
}: {
  onClose(): void;
  label: string;
  /** false = cannot be dismissed (e.g. the case picker when no case is open). */
  closable?: boolean;
  /** Keyboard-summoned surfaces (Ctrl+K) appear without animation. */
  instant?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o && closable) onClose(); }} disablePointerDismissal={!closable}>
      <Dialog.Portal>
        <Dialog.Backdrop className={`ui-backdrop ${instant ? 'instant' : ''}`} />
        <Dialog.Popup aria-label={label} className={`ui-popup dialog ${instant ? 'instant' : ''} ${className ?? ''}`}>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { Dialog };
