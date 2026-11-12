import { useSyncExternalStore } from 'react';
import { Drawer } from 'vaul';
import { useStore } from '../store';
import { SidePanel } from './SidePanel';
import { useT } from '../i18n/useT';

const QUERY = '(max-width: 640px)';
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(QUERY);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const useIsPhone = () => useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches);

/**
 * Person details. On wide screens: the docked side panel. On phones: a Vaul bottom sheet
 * that follows the finger, can be flicked away, and leaves the tree visible above it.
 */
export function PersonPanel() {
  const phone = useIsPhone();
  const select = useStore((s) => s.select);
  const t = useT();
  if (!phone) return <SidePanel />;
  return (
    <Drawer.Root open onOpenChange={(o) => { if (!o) select(null); }}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet" aria-describedby={undefined}>
          <div className="sheet-handle" aria-hidden />
          <Drawer.Title className="sr-only">{t('panel.aria')}</Drawer.Title>
          <SidePanel />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
