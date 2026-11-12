import { useMemo, useState } from 'react';
import { Link2, Printer, X } from 'lucide-react';
import type { CaseFile, Person, Role, SocialType, Status } from '../types';
import { useStore } from '../store';
import { computeRelations, relationLabel } from '../engine/relations';
import { addEdge, linkPrimitive } from '../engine/ops';
import { SOCIAL_TYPES, socialLabel } from '../engine/social';
import { localeOf, pick, type UiLang } from '../i18n';
import { useT, useUiLang } from '../i18n/useT';
import { PRIM_META, ROLE_META, STATUS_META } from './meta';
import { Avatar } from './PersonNode';

const ROLE_ORDER: Role[] = ['suspect', 'accused', 'associate', 'victim', 'witness', 'relative', 'unknown'];
const FAMILY_ORDER = ['father', 'mother', 'son', 'daughter', 'brother', 'sister', 'husband', 'wife'];
const FAMILY_RELS = FAMILY_ORDER.map((r) => PRIM_META.find((p) => p.rel === r)!);

/** of = this person holds the role towards the other ("SIM provider of Sameer"). */
interface Rel { otherId: string; label: string; kind: 'family' | 'social'; criminal: boolean; of?: boolean }

/**
 * Direct relations of a person: family edges named from this person's point of view (relation language),
 * plus social links (interface language).
 */
function relationsOf(cf: CaseFile, id: string, lang: 'hi' | 'en' | 'ur' | 'pa', ui: UiLang): Rel[] {
  const out: Rel[] = [];
  // Family: everyone one kinship step away (parents, children, spouses, and siblings derived from shared parents).
  for (const info of computeRelations(cf, id).values()) {
    if (info.personId === id || !info.kinship || info.steps.length !== 1 || !cf.persons[info.personId]) continue;
    out.push({ otherId: info.personId, label: relationLabel(info, lang), kind: 'family', criminal: false });
  }
  for (const e of Object.values(cf.edges)) {
    if (e.kind !== 'social' || (e.from !== id && e.to !== id)) continue;
    const other = e.from === id ? e.to : e.from;
    if (!cf.persons[other]) continue;
    const t = (e.subtype as SocialType) ?? 'other';
    const def = SOCIAL_TYPES.find((s) => s.type === t);
    // edge from → to with subtype S means: `to` is the S of `from`
    out.push({ otherId: other, label: socialLabel(t, ui), kind: 'social', criminal: def?.group === 'criminal', of: e.to === id });
  }
  return out;
}

/**
 * Case register of everyone in the tree: who they are, how they came into the case, the evidence,
 * and who they are related to. Fields edit in place, a relation can be added from the row,
 * and the page prints as a clean table.
 */
export function SuspectTable() {
  const cf = useStore((s) => s.cf)!;
  const lang = useStore((s) => s.lang);
  const t = useT();
  const ui = useUiLang();
  const [scope, setScope] = useState<'case' | 'all'>('case');
  const [linking, setLinking] = useState<string | null>(null);

  const people = useMemo(() => {
    const list = Object.values(cf.persons).filter((p) => !p.isGhost);
    const inScope = scope === 'all' ? list : list.filter((p) => p.role !== 'relative' && p.role !== 'unknown');
    return inScope.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name));
  }, [cf.persons, scope]);

  return (
    <div className="suspect-table">
      <div className="st-bar no-print">
        <div className="seg">
          <button className={scope === 'case' ? 'on' : ''} onClick={() => setScope('case')}>{t('st.scopeCase')}</button>
          <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>{t('st.scopeAll')}</button>
        </div>
        <span className="muted num">{t('common.people', { n: people.length })}</span>
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => window.print()}><Printer size={14} /> {t('st.print')}</button>
      </div>
      <div className="print-only st-title">
        <b>{cf.title}</b>{cf.firNo ? ` · FIR ${cf.firNo}` : ''}{cf.policeStation ? ` · ${cf.policeStation}` : ''}
        <div className="muted">{t('st.register', { date: new Date(cf.updatedAt).toLocaleDateString(localeOf(ui)) })}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th><th>{t('st.th.name')}</th><th>{t('st.th.role')}</th><th>{t('st.th.mobile')}</th><th>{t('st.th.source')}</th><th>{t('st.th.evidence')}</th><th>{t('st.th.related')}</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p, i) => (
            <Row key={p.id} n={i + 1} p={p} rels={relationsOf(cf, p.id, lang, ui)} linking={linking === p.id} setLinking={(v) => setLinking(v ? p.id : null)} />
          ))}
        </tbody>
      </table>
      {people.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: 40 }}>{t('st.empty')}</p>}
    </div>
  );
}

function Row({ n, p, rels, linking, setLinking }: { n: number; p: Person; rels: Rel[]; linking: boolean; setLinking(v: boolean): void }) {
  const cf = useStore((s) => s.cf)!;
  const mutate = useStore((s) => s.mutate);
  const select = useStore((s) => s.select);
  const setView = useStore((s) => s.setView);
  const t = useT();
  const ui = useUiLang();

  const fieldName = { name: t('st.th.name'), role: t('f.role'), status: t('f.status'), source: t('st.th.source'), evidence: t('st.th.evidence') };
  const save = (patch: Partial<Person>, what: keyof typeof fieldName) =>
    mutate('edit', t('audit.tableEdit', { name: p.name, what: fieldName[what] }), (d) => { d.persons[p.id] = { ...d.persons[p.id], ...patch }; });
  const text = (field: 'name' | 'source' | 'evidence', value: string) => {
    const v = value.trim();
    if (field === 'name') { if (v && v !== p.name) save({ name: v }, 'name'); return; }
    if (v !== (p[field] ?? '')) save({ [field]: v || undefined }, field);
  };
  const showOnChart = (id: string) => { setView('chart'); select(id); };

  return (
    <tr>
      <td className="num muted">{n}</td>
      <td className="st-name">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Avatar person={p} size={26} />
          <div style={{ minWidth: 0 }}>
            <input className="st-in strong" defaultValue={p.name} aria-label={t('st.th.name')} onBlur={(e) => text('name', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
            <span className="print-only"><b>{p.name}</b></span>
            {p.aliases.length > 0 && <div className="muted st-small">{t('st.alias', { list: p.aliases.join(', ') })}</div>}
            {p.firs.length > 0 && <div className="muted st-small">FIR {p.firs.join(', ')}</div>}
          </div>
        </div>
      </td>
      <td>
        <select className="st-sel no-print" value={p.role} aria-label={t('f.role')} onChange={(e) => save({ role: e.target.value as Role }, 'role')}
          style={{ color: ROLE_META[p.role].color }}>
          {ROLE_ORDER.map((r) => <option key={r} value={r}>{pick(ROLE_META[r], ui)}</option>)}
        </select>
        <select className="st-sel no-print" value={p.status} aria-label={t('f.status')} onChange={(e) => save({ status: e.target.value as Status }, 'status')}>
          {(Object.keys(STATUS_META) as Status[]).map((s) => <option key={s} value={s}>{pick(STATUS_META[s], ui)}</option>)}
        </select>
        <span className="print-only">{pick(ROLE_META[p.role], ui)} · {pick(STATUS_META[p.status], ui)}</span>
      </td>
      <td className="num st-small">{p.mobiles.join(', ')}</td>
      <td>
        <textarea className="st-in no-print" rows={2} defaultValue={p.source ?? ''} placeholder="—" aria-label={t('st.th.source')} onBlur={(e) => text('source', e.target.value)} />
        <span className="print-only">{p.source}</span>
      </td>
      <td>
        <textarea className="st-in no-print" rows={2} defaultValue={p.evidence ?? ''} placeholder="—" aria-label={t('st.th.evidence')} onBlur={(e) => text('evidence', e.target.value)} />
        <span className="print-only">{p.evidence}</span>
      </td>
      <td className="st-rels">
        {rels.map((r, i) => (
          <div key={i} className={r.criminal ? 'crim' : ''}>
            <span className="muted">{t(r.of ? 'st.relOf' : 'st.rel', { rel: r.label })}</span>{' '}
            <button className="st-link" onClick={() => showOnChart(r.otherId)}>{cf.persons[r.otherId]?.isGhost ? t('common.unknown') : cf.persons[r.otherId]?.name}</button>
          </div>
        ))}
        {linking
          ? <AddRelation p={p} onDone={() => setLinking(false)} />
          : <button className="st-add no-print" onClick={() => setLinking(true)}><Link2 size={11} /> {t('st.linkTo')}</button>}
      </td>
    </tr>
  );
}

function AddRelation({ p, onDone }: { p: Person; onDone(): void }) {
  const cf = useStore((s) => s.cf)!;
  const mutate = useStore((s) => s.mutate);
  const t = useT();
  const ui = useUiLang();
  const [other, setOther] = useState('');
  const [rel, setRel] = useState('co-accused');
  const people = Object.values(cf.persons).filter((x) => x.id !== p.id && !x.isGhost).sort((a, b) => a.name.localeCompare(b.name));
  const save = () => {
    if (!other) return;
    const o = cf.persons[other];
    const family = FAMILY_RELS.find((f) => f.rel === rel);
    const social = SOCIAL_TYPES.find((s) => s.type === rel);
    const detail = family
      ? t('audit.tableFamily', { other: o.name, rel: pick(family, ui), name: p.name })
      : t('audit.link', { a: p.name, b: `${o.name}: ${social ? pick(social, ui) : rel}` });
    mutate('link', detail, (d) => {
      // "other is the <rel> of p" for family; a social link otherwise
      if (family) linkPrimitive(d, other, family.rel, p.id, { confidence: 'probable', source: 'Suspect table' });
      else addEdge(d, 'social', p.id, other, { subtype: rel as SocialType, confidence: 'probable', source: 'Suspect table' });
    });
    onDone();
  };
  return (
    <div className="st-addform no-print">
      <select className="st-sel" value={other} onChange={(e) => setOther(e.target.value)} aria-label={t('st.personAria')}>
        <option value="">{t('st.person')}</option>
        {people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <span className="muted">{t('st.is')}</span>
      <select className="st-sel" value={rel} onChange={(e) => setRel(e.target.value)} aria-label={t('st.relationAria')}>
        <optgroup label={t('st.familyGroup')}>
          {FAMILY_RELS.map((f) => <option key={f.rel} value={f.rel}>{pick(f, ui)}</option>)}
        </optgroup>
        <optgroup label={t('st.associateGroup')}>
          {SOCIAL_TYPES.map((s) => <option key={s.type} value={s.type}>{pick(s, ui)}</option>)}
        </optgroup>
      </select>
      <button className="btn primary" style={{ height: 24 }} disabled={!other} onClick={save}>{t('common.add')}</button>
      <button className="btn icon-btn" style={{ height: 24 }} aria-label={t('common.cancel')} onClick={onDone}><X size={12} /></button>
    </div>
  );
}
