import NumberFlow from '@number-flow/react';
import { useReactFlow, useStore as useFlowStore } from '@xyflow/react';
import { CornerDownRight, Expand, Info, LayoutGrid, Map as MapIcon, Maximize, Minus, Plus, Redo2, Shrink, Slash, Spline, Tags, Undo2, X } from 'lucide-react';
import { useStore } from '../store';
import { pick } from '../i18n';
import { useT, useUiLang } from '../i18n/useT';
import { ROLE_META } from './meta';
import { RailButton, RailDivider } from './Rail';

const ROLES = ['suspect', 'accused', 'witness', 'victim', 'associate', 'relative'] as const;
const zoomSel = (s: { transform: [number, number, number] }) => s.transform[2];

/** Bottom bar: history, zoom, canvas toggles and role filters. One click each. */
export function BottomBar() {
  const rf = useReactFlow();
  const zoom = useFlowStore(zoomSel);
  const t = useT();
  const ui = useUiLang();
  const cf = useStore((s) => s.cf);
  const past = useStore((s) => s.past.length);
  const future = useStore((s) => s.future.length);
  const roleFilter = useStore((s) => s.roleFilter);
  const minimap = useStore((s) => s.minimap);
  const legend = useStore((s) => s.legend);
  const saving = useStore((s) => s.saving);
  const pathFrom = useStore((s) => s.pathFrom);
  const cardSize = useStore((s) => s.cardSize);
  const view = useStore((s) => s.view);
  const lineStyle = useStore((s) => s.lineStyle);
  const allLabels = useStore((s) => s.allLabels);
  const hasManual = useStore((s) => (s.view !== 'table' ? !!s.cf?.layout?.[s.view] && Object.keys(s.cf.layout[s.view]!).length > 0 : false));
  const { cycleLineStyle, toggleLabels, resetLayout } = useStore.getState();
  const { undo, redo, toggleRole, toggleMinimap, toggleLegend, setPath, toggleCardSize } = useStore.getState();

  return (
    <footer className="bottombar" aria-label={t('bb.aria')}>
      <RailButton side="top" label="Undo" shortcut="Ctrl Z" disabled={!past} onClick={undo}><Undo2 size={16} /></RailButton>
      <RailButton side="top" label="Redo" shortcut="Ctrl Shift Z" disabled={!future} onClick={redo}><Redo2 size={16} /></RailButton>
      <RailDivider vertical />
      <RailButton side="top" label={t('bb.zoomOut')} onClick={() => void rf.zoomOut({ duration: 200 })}><Minus size={16} /></RailButton>
      <button type="button" className="zoom-pct num" title={t('bb.zoom100')} onClick={() => void rf.zoomTo(1, { duration: 200 })}>{Math.round(zoom * 100)}%</button>
      <RailButton side="top" label={t('bb.zoomIn')} onClick={() => void rf.zoomIn({ duration: 200 })}><Plus size={16} /></RailButton>
      <RailButton side="top" label={t('bb.fit')} onClick={() => void rf.fitView({ duration: 400, padding: 0.1 })}><Maximize size={15} /></RailButton>
      <RailDivider vertical />
      <RailButton side="top" label={t('bb.lineStyle', { style: t(lineStyle === 'step' ? 'bb.ls.step' : lineStyle === 'curve' ? 'bb.ls.curve' : 'bb.ls.straight') })} onClick={cycleLineStyle}>
        {lineStyle === 'step' ? <CornerDownRight size={15} /> : lineStyle === 'curve' ? <Spline size={15} /> : <Slash size={15} />}
      </RailButton>
      <RailButton side="top" label={allLabels ? t('bb.labelsHide') : t('bb.labelsShow')} active={allLabels} onClick={toggleLabels}>
        <Tags size={15} />
      </RailButton>
      <RailButton side="top" label={t('bb.resetLayout')} disabled={!hasManual} onClick={() => view !== 'table' && resetLayout(view)}>
        <LayoutGrid size={15} />
      </RailButton>
      <RailButton side="top" label={cardSize === 'compact' ? t('bb.bigCards') : t('bb.smallCards')} active={cardSize === 'compact'} onClick={toggleCardSize}>
        {cardSize === 'compact' ? <Expand size={15} /> : <Shrink size={15} />}
      </RailButton>
      <RailButton side="top" label={t('bb.minimap')} active={minimap} onClick={toggleMinimap}><MapIcon size={16} /></RailButton>
      <RailButton side="top" label={t('bb.legend')} active={legend} onClick={toggleLegend}><Info size={16} /></RailButton>
      <RailDivider vertical />
      <div className="role-filters" role="group" aria-label={t('bb.roleFilter')}>
        {ROLES.map((r) => (
          <button key={r} type="button" className={`chip ${roleFilter.has(r) ? 'on' : ''}`} onClick={() => toggleRole(r)} title={t('bb.onlyRole', { role: pick(ROLE_META[r], ui) })}>
            <span className="sw" style={{ background: ROLE_META[r].color }} />
            {pick(ROLE_META[r], ui)}
          </button>
        ))}
        {roleFilter.size > 0 && (
          <button type="button" className="chip" onClick={() => [...roleFilter].forEach((r) => toggleRole(r))} title={t('bb.clearFilter')} aria-label={t('bb.clearFilter')}><X size={12} /></button>
        )}
      </div>
      <div className="bb-end">
        {pathFrom && <button type="button" className="chip on" onClick={() => setPath(null, null)}>{t('bb.pathOn')} <X size={12} /></button>}
        <span className={`saving ${saving ? 'busy' : ''}`} title={saving ? t('bb.saving') : t('bb.saved')}><span className="d" /></span>
        {cf && <span className="muted num"><NumberFlow value={Object.keys(cf.persons).length} suffix={t('bb.peopleSuffix')} /></span>}
      </div>
    </footer>
  );
}
