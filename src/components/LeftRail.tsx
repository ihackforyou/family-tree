import { ArrowDown, ArrowLeftRight, ArrowUp, Crosshair, Heart, History, ListTree, Route, Trash2, UserPlus, UserRound, Users } from 'lucide-react';
import { useStore, type PanelTab } from '../store';
import { removePerson } from '../engine/ops';
import type { TKey } from '../i18n';
import { useT } from '../i18n/useT';
import { RailButton, RailDivider } from './Rail';

type Preset = 'up' | 'down' | 'sibling' | 'spouse' | 'social';

const ADD: [Preset, TKey, typeof ArrowUp][] = [
  ['up', 'add.up', ArrowUp],
  ['down', 'add.down', ArrowDown],
  ['sibling', 'add.sibling', ArrowLeftRight],
  ['spouse', 'add.spouse', Heart],
  ['social', 'add.social', Users],
];

const PANEL: [PanelTab, TKey, typeof ArrowUp][] = [
  ['details', 'lr.details', UserRound],
  ['relations', 'lr.relations', ListTree],
  ['path', 'lr.path', Route],
  ['history', 'lr.history', History],
];

/**
 * Left rail: everything you do to a person, one click each.
 * Works on the selected person, or the focus person when nothing is selected.
 */
export function LeftRail() {
  const cf = useStore((s) => s.cf);
  const selectedId = useStore((s) => s.selectedId);
  const panelTab = useStore((s) => s.panelTab);
  const t = useT();
  const { setDialog, setFocus, openPanel, mutate, select } = useStore.getState();

  const targetId = (selectedId && cf?.persons[selectedId] ? selectedId : cf?.focusId) ?? null;
  const target = targetId ? cf?.persons[targetId] : undefined;
  const who = target ? ` — ${target.isGhost ? t('common.unknown') : target.name}` : '';
  const off = !target;

  const del = () => {
    if (!target || !targetId) return;
    // Undoable, so no blocking confirm: delete at once and offer Undo in the toast.
    const name = target.isGhost ? t('common.unknown') : target.name;
    if (!mutate('delete', t('audit.deleted', { name }), (d) => removePerson(d, targetId))) return;
    select(null);
    useStore.getState().notify(t('toast.deleted', { name }), 'ok', { label: t('common.undo'), onClick: () => useStore.getState().undo() });
  };

  return (
    <aside className="rail rail-left" aria-label={t('lr.aria')}>
      <RailButton side="right" label={`${t('lr.addAny')}${who}`} disabled={off} onClick={() => targetId && setDialog({ type: 'add', anchorId: targetId })}>
        <UserPlus size={17} />
      </RailButton>
      {ADD.map(([preset, key, Icon]) => (
        <RailButton key={preset} side="right" label={`${t(key)}${who}`} disabled={off} onClick={() => targetId && setDialog({ type: 'add', anchorId: targetId, preset })}>
          <Icon size={16} />
        </RailButton>
      ))}
      <RailDivider />
      <RailButton side="right" label={`${t('lr.makeFocus')}${who}`} shortcut="Double-click" disabled={off || cf?.focusId === targetId} onClick={() => targetId && setFocus(targetId)}>
        <Crosshair size={17} />
      </RailButton>
      {PANEL.map(([tab, key, Icon]) => (
        <RailButton
          key={tab}
          side="right"
          label={`${t(key)}${who}`}
          active={!!selectedId && panelTab === tab}
          disabled={off}
          onClick={() => targetId && openPanel(targetId, tab)}
        >
          <Icon size={17} />
        </RailButton>
      ))}
      <div className="rail-end">
        <RailButton side="right" label={`${t('lr.delete')}${who}`} danger disabled={off} onClick={del}>
          <Trash2 size={16} />
        </RailButton>
      </div>
    </aside>
  );
}
