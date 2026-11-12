import type { ReactNode } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { create } from 'zustand';
import { useT } from '../../i18n/useT';

interface Ask {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  resolve(ok: boolean): void;
}

const useConfirm = create<{ ask: Ask | null; open: boolean }>(() => ({ ask: null, open: false }));

/** Promise-based replacement for window.confirm(), on Base UI AlertDialog. */
export function confirmDialog(opts: Omit<Ask, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => useConfirm.setState({ ask: { ...opts, resolve }, open: true }));
}

export function ConfirmHost() {
  const { ask, open } = useConfirm();
  const t = useT();
  const settle = (ok: boolean) => {
    ask?.resolve(ok);
    useConfirm.setState({ open: false });
  };
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => { if (!o) settle(false); }}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="ui-backdrop anim" />
        <AlertDialog.Popup className="ui-popup dialog confirm anim">
          <div className="dialog-body" style={{ padding: 16, gap: 6 }}>
            <AlertDialog.Title className="confirm-title">{ask?.title}</AlertDialog.Title>
            {ask?.description && <AlertDialog.Description className="muted" style={{ margin: 0, lineHeight: 1.55 }}>{ask.description}</AlertDialog.Description>}
          </div>
          <div className="dialog-foot" style={{ borderTop: 0, paddingTop: 4 }}>
            <AlertDialog.Close className="btn ghost">{t('common.cancel')}</AlertDialog.Close>
            <button type="button" className="btn destructive" onClick={() => settle(true)}>{ask?.confirmLabel ?? t('common.yes')}</button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
