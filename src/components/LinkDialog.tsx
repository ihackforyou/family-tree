import { useMemo, useState } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import type { Confidence, SocialType } from '../types';
import { useStore } from '../store';
import { addEdge, draftOf, linkPrimitive, mergePersons, type PrimitiveRel } from '../engine/ops';
import { SOCIAL_TYPES } from '../engine/social';
import { computeRelations, relationLabel } from '../engine/relations';
import { CONF_META } from './meta';

const PRIMS: { rel: PrimitiveRel; hi: string; en: string }[] = [
  { rel: 'father', hi: 'पिता', en: 'Father' },
  { rel: 'mother', hi: 'माता', en: 'Mother' },
  { rel: 'son', hi: 'बेटा', en: 'Son' },
  { rel: 'daughter', hi: 'बेटी', en: 'Daughter' },
  { rel: 'husband', hi: 'पति', en: 'Husband' },
  { rel: 'wife', hi: 'पत्नी', en: 'Wife' },
  { rel: 'brother', hi: 'भाई', en: 'Brother' },
  { rel: 'sister', hi: 'बहन', en: 'Sister' },
];

type Choice = { k: 'prim'; rel: PrimitiveRel } | { k: 'social'; t: SocialType } | { k: 'merge' };

/** Drag-to-link: "A, B का कौन है?" */
export function LinkDialog({ aId: a0, bId: b0 }: { aId: string; bId: string }) {
  const cf = useStore((s) => s.cf)!;
  const lang = useStore((s) => s.lang);
  const mutate = useStore((s) => s.mutate);
  const setDialog = useStore((s) => s.setDialog);
  const [ids, setIds] = useState<[string, string]>([a0, b0]);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [confidence, setConfidence] = useState<Confidence>('probable');
  const [source, setSource] = useState('');
  const [aId, bId] = ids;
  const A = cf.persons[aId];
  const B = cf.persons[bId];
  const nm = (p: typeof A) => (p.isGhost ? 'अज्ञात' : p.name);

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
      if (choice.k === 'merge') return { ok: true as const, text: 'दोनों एक ही व्यक्ति माने जाएँगे; सारे रिश्ते एक card पर आ जाएँगे।' };
      const focus = d.focusId ?? bId;
      const l = relationLabel(computeRelations(d, focus).get(aId), lang);
      return { ok: true as const, text: `Focus ${d.persons[focus]?.name} से ${nm(A)} का रिश्ता: ${l}` };
    } catch (e) {
      return { ok: false as const, text: (e as Error).message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, cf, aId, bId, lang]);

  const submit = () => {
    if (!choice || !preview?.ok) return;
    const ok = mutate('link', `${nm(A)} ↔ ${nm(B)} जोड़ा`, (d) => apply(d, choice));
    if (ok) setDialog(null);
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setDialog(null)}>
      <div className="dialog" role="dialog" onKeyDown={(e) => e.key === 'Escape' && setDialog(null)}>
        <div className="dialog-head">
          <h3><b>{nm(A)}</b>, <b>{nm(B)}</b> का कौन है?</h3>
          <button className="btn ghost icon-btn" title="उल्टा करें" onClick={() => { setIds([bId, aId]); setChoice(null); }}><ArrowLeftRight size={16} /></button>
          <button className="btn ghost icon-btn" style={{ marginLeft: 'auto' }} onClick={() => setDialog(null)}><X size={16} /></button>
        </div>
        <div className="dialog-body">
          <div className="group-label">परिवार</div>
          <div className="tpl-grid">
            {PRIMS.map((p) => (
              <button key={p.rel} className={`tpl ${choice?.k === 'prim' && choice.rel === p.rel ? 'on' : ''}`} onClick={() => setChoice({ k: 'prim', rel: p.rel })}>
                {p.hi}<span className="en">{p.en}</span>
              </button>
            ))}
          </div>
          <div className="muted">चाचा, मामा जैसे रिश्ते बीच के लोगों से अपने आप बनते हैं। उनके लिए card के "+" से जोड़ें।</div>
          <div className="group-label">दोस्त / सहयोगी</div>
          <div className="tpl-grid">
            {SOCIAL_TYPES.map((s) => (
              <button key={s.type} className={`tpl ${choice?.k === 'social' && choice.t === s.type ? 'on' : ''}`} onClick={() => setChoice({ k: 'social', t: s.type })}>
                {s.hi}
              </button>
            ))}
          </div>
          <div className="group-label">Duplicate</div>
          <div className="tpl-grid">
            <button className={`tpl ${choice?.k === 'merge' ? 'on' : ''}`} onClick={() => setChoice({ k: 'merge' })}>दोनों एक ही व्यक्ति हैं (merge)</button>
          </div>
          <div className="grid2">
            <label className="field"><span>भरोसा</span>
              <select className="select" value={confidence} onChange={(e) => setConfidence(e.target.value as Confidence)}>
                {Object.entries(CONF_META).map(([k, v]) => <option key={k} value={k}>{v.hi} · {v.en}</option>)}
              </select>
            </label>
            <label className="field"><span>Source</span>
              <input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="पूछताछ, CDR…" />
            </label>
          </div>
          {preview && <div className={preview.ok ? 'preview' : 'warn'}>{preview.text}</div>}
        </div>
        <div className="dialog-foot">
          <button className="btn" onClick={() => setDialog(null)}>रद्द करें</button>
          <button className="btn primary" disabled={!choice || !preview?.ok} onClick={submit}>जोड़ें</button>
        </div>
      </div>
    </div>
  );
}
