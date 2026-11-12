import { useMemo, useState } from 'react';
import { Modal } from './ui/Modal';
import { ArrowLeftRight, X } from 'lucide-react';
import type { Confidence, SocialType } from '../types';
import { useStore } from '../store';
import { addEdge, draftOf, linkPrimitive, mergePersons, type PrimitiveRel } from '../engine/ops';
import { SOCIAL_TYPES } from '../engine/social';
import { computeRelations, relationLabel } from '../engine/relations';
import { pick, pickBoth, pickOther } from '../i18n';
import { useT, useTRich, useUiLang } from '../i18n/useT';
import { CONF_META, PRIM_META } from './meta';

type Choice = { k: 'prim'; rel: PrimitiveRel } | { k: 'social'; t: SocialType } | { k: 'merge' };

/** Drag-to-link: "A, B का कौन है?" */
export function LinkDialog({ aId: a0, bId: b0 }: { aId: string; bId: string }) {
  const cf = useStore((s) => s.cf)!;
  const lang = useStore((s) => s.lang);
  const mutate = useStore((s) => s.mutate);
  const setDialog = useStore((s) => s.setDialog);
  const t = useT();
  const tr = useTRich();
  const ui = useUiLang();
  const [ids, setIds] = useState<[string, string]>([a0, b0]);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [confidence, setConfidence] = useState<Confidence>('probable');
  const [source, setSource] = useState('');
  const [aId, bId] = ids;
  const A = cf.persons[aId];
  const B = cf.persons[bId];
  const nm = (p: typeof A) => (p.isGhost ? t('common.unknown') : p.name);

  const apply = (d: typeof cf, c: Choice) => {
    const meta = { confidence, source: source.trim() || undefined };
    if (c.k === 'prim') linkPrimitive(d, aId, c.rel, bId, meta);
    else if (c.k === 'social') addEdge(d, 'social', bId, aId, { ...meta, subtype: c.t });
    else mergePersons(d, B.isGhost && !A.isGhost ? aId : bId, B.isGhost && !A.isGhost ? bId : aId);
  };

  const preview = useMemo(() => {
    if (!choice) return null;
    try {
      const d = draftOf(cf);
      apply(d, choice);
      if (choice.k === 'merge') return { ok: true as const, text: t('link.mergePreview') };
      const focus = d.focusId ?? bId;
      const l = relationLabel(computeRelations(d, focus).get(aId), lang);
      return { ok: true as const, text: t('link.preview', { focus: d.persons[focus]?.name ?? '', a: nm(A), rel: l }) };
    } catch (e) {
      return { ok: false as const, text: (e as Error).message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, cf, aId, bId, lang, t]);

  const submit = () => {
    if (!choice || !preview?.ok) return;
    const ok = mutate('link', t('audit.link', { a: nm(A), b: nm(B) }), (d) => apply(d, choice));
    if (ok) setDialog(null);
  };

  return (
    <Modal onClose={() => setDialog(null)} label={t('link.aria')}>
      <div style={{ display: 'contents' }}>
        <div className="dialog-head">
          <h3>{tr('link.title', { a: <b>{nm(A)}</b>, b: <b>{nm(B)}</b> })}</h3>
          <button className="btn ghost icon-btn" title={t('link.swap')} aria-label={t('link.swap')} onClick={() => { setIds([bId, aId]); setChoice(null); }}><ArrowLeftRight size={16} /></button>
          <button className="btn ghost icon-btn" style={{ marginLeft: 'auto' }} aria-label={t('common.close')} onClick={() => setDialog(null)}><X size={16} /></button>
        </div>
        <div className="dialog-body">
          <div className="group-label">{t('add.family')}</div>
          <div className="tpl-grid">
            {PRIM_META.map((p) => (
              <button key={p.rel} className={`tpl ${choice?.k === 'prim' && choice.rel === p.rel ? 'on' : ''}`} onClick={() => setChoice({ k: 'prim', rel: p.rel })}>
                {pick(p, ui)}<span className="en">{pickOther(p, ui)}</span>
              </button>
            ))}
          </div>
          <div className="muted">{t('link.derivedHint')}</div>
          <div className="group-label">{t('add.socialMode')}</div>
          <div className="tpl-grid">
            {SOCIAL_TYPES.map((s) => (
              <button key={s.type} className={`tpl ${choice?.k === 'social' && choice.t === s.type ? 'on' : ''}`} onClick={() => setChoice({ k: 'social', t: s.type })} title={pickOther(s, ui)}>
                {pick(s, ui)}
              </button>
            ))}
          </div>
          <div className="group-label">{t('link.duplicate')}</div>
          <div className="tpl-grid">
            <button className={`tpl ${choice?.k === 'merge' ? 'on' : ''}`} onClick={() => setChoice({ k: 'merge' })}>{t('link.merge')}</button>
          </div>
          <div className="grid2">
            <label className="field"><span>{t('add.confidence')}</span>
              <select className="select" value={confidence} onChange={(e) => setConfidence(e.target.value as Confidence)}>
                {Object.entries(CONF_META).map(([k, v]) => <option key={k} value={k}>{pickBoth(v, ui)}</option>)}
              </select>
            </label>
            <label className="field"><span>{t('common.source')}</span>
              <input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder={t('link.sourcePh')} />
            </label>
          </div>
          {preview && <div className={preview.ok ? 'preview' : 'warn'}>{preview.text}</div>}
        </div>
        <div className="dialog-foot">
          <button className="btn" onClick={() => setDialog(null)}>{t('common.cancel')}</button>
          <button className="btn primary" disabled={!choice || !preview?.ok} onClick={submit}>{t('common.add')}</button>
        </div>
      </div>
    </Modal>
  );
}
