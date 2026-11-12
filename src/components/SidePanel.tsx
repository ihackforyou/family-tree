import { useMemo, useState } from 'react';
import { Route, Trash2, X } from 'lucide-react';
import type { Confidence, Edge, Gender, Person, Role, Status } from '../types';
import { useStore } from '../store';
import { computeRelations, relationLabel } from '../engine/relations';
import { socialLabel } from '../engine/social';
import { Avatar } from './PersonNode';
import { PersonPicker } from './PersonPicker';
import { CONF_META, ROLE_META, SIDE_META, STATUS_META, genLabel } from './meta';
import { localeOf, pick, pickBoth, type T, type TKey } from '../i18n';
import { useT, useTRich, useUiLang } from '../i18n/useT';

type Tab = 'details' | 'relations' | 'path' | 'history';

const TABS: [Tab, TKey][] = [
  ['details', 'panel.tab.details'], ['relations', 'panel.tab.relations'], ['path', 'panel.tab.path'], ['history', 'panel.tab.history'],
];

export function SidePanel() {
  const cf = useStore((s) => s.cf)!;
  const id = useStore((s) => s.selectedId)!;
  const lang = useStore((s) => s.lang);
  const t = useT();
  const ui = useUiLang();
  const select = useStore((s) => s.select);
  const tab = useStore((s) => s.panelTab);
  const setTab = useStore((s) => s.setPanelTab);
  const p = cf.persons[id];

  const focusInfo = useMemo(
    () => (cf.focusId ? computeRelations(cf, cf.focusId).get(id) : undefined),
    [cf, id],
  );
  if (!p) return null;

  return (
    <aside className="panel" aria-label={t('panel.aria')}>
      <div className="panel-head">
        <Avatar person={p} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="panel-title">{p.isGhost ? t('common.unknownGhost') : p.name}</div>
          <div className="muted">
            {relationLabel(focusInfo, lang)}
            {focusInfo && focusInfo.side !== 'unlinked' && focusInfo.side !== 'associate' && <> · {genLabel(focusInfo.generation)} · {pick(SIDE_META[focusInfo.side], ui)}</>}
          </div>
        </div>
        <button className="btn ghost icon-btn" onClick={() => select(null)} aria-label={t('common.close')}><X size={16} /></button>
      </div>
      <div className="tabs">
        {TABS.map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t(l)}</button>
        ))}
      </div>
      <div className="panel-body">
        {tab === 'details' && <Details key={id} p={p} />}
        {tab === 'relations' && <Relations id={id} />}
        {tab === 'path' && <PathFinder id={id} />}
        {tab === 'history' && (
          <>
            {[...cf.audit].reverse().slice(0, 80).map((a, i) => (
              <div key={i} className="audit">
                <div>{a.detail}</div>
                <div className="when">{new Date(a.ts).toLocaleString(localeOf(ui))} · {a.user}</div>
              </div>
            ))}
            {!cf.audit.length && <div className="muted">{t('panel.noChanges')}</div>}
          </>
        )}
      </div>
    </aside>
  );
}

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

function Details({ p }: { p: Person }) {
  const mutate = useStore((s) => s.mutate);
  const notify = useStore((s) => s.notify);
  const t = useT();
  const ui = useUiLang();
  const [f, setF] = useState(() => ({
    name: p.isGhost ? '' : p.name,
    aliases: p.aliases.join(', '),
    gender: p.gender,
    dob: p.dob ?? '',
    approxAge: p.approxAge?.toString() ?? '',
    role: p.role,
    status: p.status,
    religion: p.religion ?? '',
    mobiles: p.mobiles.join(', '),
    aadhaarLast4: p.aadhaarLast4 ?? '',
    address: p.address ?? '',
    firs: p.firs.join(', '),
    notes: p.notes ?? '',
    source: p.source ?? '',
    evidence: p.evidence ?? '',
    photo: p.photo,
  }));
  const [dirty, setDirty] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((x) => ({ ...x, [k]: v })); setDirty(true); };

  const save = () => {
    if (f.aadhaarLast4 && !/^\d{4}$/.test(f.aadhaarLast4)) {
      notify(t('toast.aadhaar4'), 'err');
      return;
    }
    // a ghost keeps its stored placeholder name until a real one is typed
    const name = f.name.trim() || p.name;
    mutate('edit', t('audit.editDetails', { name: f.name.trim() || (p.isGhost ? t('common.unknown') : p.name) }), (d) => {
      d.persons[p.id] = {
        ...d.persons[p.id],
        name,
        isGhost: p.isGhost && !f.name.trim(),
        aliases: list(f.aliases),
        gender: f.gender,
        dob: f.dob.trim() || undefined,
        approxAge: f.approxAge ? Number(f.approxAge) : undefined,
        role: f.role,
        status: f.status,
        religion: f.religion.trim() || undefined,
        mobiles: list(f.mobiles),
        aadhaarLast4: f.aadhaarLast4 || undefined,
        address: f.address.trim() || undefined,
        firs: list(f.firs),
        notes: f.notes.trim() || undefined,
        source: f.source.trim() || undefined,
        evidence: f.evidence.trim() || undefined,
        photo: f.photo,
      };
    });
    setDirty(false);
  };

  const onPhoto = (file: File | undefined) => {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas');
      const s = 160;
      const r = Math.max(s / img.width, s / img.height);
      c.width = s; c.height = s;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, (s - img.width * r) / 2, (s - img.height * r) / 2, img.width * r, img.height * r);
      set('photo', c.toDataURL('image/jpeg', 0.82));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <>
      <label className="field"><span>{t('f.name')}</span>
        <input className="input" value={f.name} placeholder={p.isGhost ? t('f.ghostPh') : ''} onChange={(e) => set('name', e.target.value)} />
      </label>
      <label className="field"><span>{t('f.aliases')}</span>
        <input className="input" value={f.aliases} onChange={(e) => set('aliases', e.target.value)} />
      </label>
      <div className="grid2">
        <label className="field"><span>{t('f.gender')}</span>
          <select className="select" value={f.gender} onChange={(e) => set('gender', e.target.value as Gender)}>
            <option value="male">{t('common.male')}</option><option value="female">{t('common.female')}</option><option value="other">{t('common.otherGender')}</option><option value="unknown">{t('common.genderUnknown')}</option>
          </select>
        </label>
        <label className="field"><span>{t('f.dob')}</span>
          <input className="input num" value={f.dob} placeholder={t('f.dobPh')} onChange={(e) => set('dob', e.target.value)} />
        </label>
        <label className="field"><span>{t('f.role')}</span>
          <select className="select" value={f.role} onChange={(e) => set('role', e.target.value as Role)}>
            {Object.entries(ROLE_META).map(([k, v]) => <option key={k} value={k}>{pickBoth(v, ui)}</option>)}
          </select>
        </label>
        <label className="field"><span>{t('f.status')}</span>
          <select className="select" value={f.status} onChange={(e) => set('status', e.target.value as Status)}>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{pickBoth(v, ui)}</option>)}
          </select>
        </label>
        <label className="field"><span>{t('f.approxAge')}</span>
          <input className="input num" value={f.approxAge} onChange={(e) => set('approxAge', e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="field"><span>{t('f.religion')}</span>
          <input className="input" value={f.religion} onChange={(e) => set('religion', e.target.value)} />
        </label>
      </div>
      <label className="field"><span>{t('f.mobiles')}</span>
        <input className="input num" value={f.mobiles} onChange={(e) => set('mobiles', e.target.value)} />
      </label>
      <div className="grid2">
        <label className="field"><span>{t('f.aadhaar')}</span>
          <input className="input num" maxLength={4} value={f.aadhaarLast4} placeholder="XXXX-XXXX-____" onChange={(e) => set('aadhaarLast4', e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </label>
        <label className="field"><span>{t('f.firs')}</span>
          <input className="input" value={f.firs} onChange={(e) => set('firs', e.target.value)} />
        </label>
      </div>
      <label className="field"><span>{t('f.address')}</span>
        <input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} />
      </label>
      <label className="field"><span>{t('f.source')}</span>
        <textarea className="textarea" style={{ minHeight: 48 }} value={f.source} onChange={(e) => set('source', e.target.value)} placeholder={t('f.sourcePh')} />
      </label>
      <label className="field"><span>{t('f.evidence')}</span>
        <textarea className="textarea" style={{ minHeight: 48 }} value={f.evidence} onChange={(e) => set('evidence', e.target.value)} placeholder={t('f.evidencePh')} />
      </label>
      <label className="field"><span>{t('f.notes')}</span>
        <textarea className="textarea" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
      <label className="field"><span>{t('f.photo')}</span>
        <input type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </label>
      {f.photo && <button className="btn" onClick={() => set('photo', undefined)}>{t('f.removePhoto')}</button>}
      <button className="btn primary" disabled={!dirty} onClick={save} style={{ justifyContent: 'center' }}>{t('f.save')}</button>
    </>
  );
}

function edgeKindText(e: Edge, selfId: string, t: T, ui: 'en' | 'hi'): string {
  if (e.kind === 'parent') return e.from === selfId ? t('edge.child') : t('edge.parent');
  if (e.kind === 'spouse') return t('edge.spouse');
  if (e.kind === 'sibling') return t('edge.sibling');
  return socialLabel((e.subtype as never) ?? 'other', ui);
}

const SUBTYPES: Record<Edge['kind'], { v: string; l: TKey }[]> = {
  parent: [
    { v: 'biological', l: 'sub.biological' }, { v: 'adoptive', l: 'sub.adoptive' }, { v: 'step', l: 'sub.step' },
    { v: 'foster', l: 'sub.foster' }, { v: 'guardian', l: 'sub.guardian' },
  ],
  spouse: [
    { v: 'married', l: 'sub.married' }, { v: 'divorced', l: 'sub.divorced' }, { v: 'separated', l: 'sub.separated' },
    { v: 'widowed', l: 'sub.widowed' }, { v: 'live-in', l: 'sub.livein' },
  ],
  sibling: [{ v: 'full', l: 'sub.full' }, { v: 'half', l: 'sub.half' }, { v: 'step', l: 'sub.stepSibling' }, { v: 'fictive', l: 'sub.fictive' }],
  social: [],
};

function Relations({ id }: { id: string }) {
  const cf = useStore((s) => s.cf)!;
  const lang = useStore((s) => s.lang);
  const select = useStore((s) => s.select);
  const mutate = useStore((s) => s.mutate);
  const t = useT();
  const ui = useUiLang();
  const rel = useMemo(() => computeRelations(cf, id), [cf, id]);
  const direct = Object.values(cf.edges).filter((e) => e.from === id || e.to === id);
  const nm = (p: { name: string; isGhost?: boolean }) => (p.isGhost ? t('common.unknown') : p.name);

  const update = (eid: string, patch: Partial<Edge>) =>
    mutate('edge', t('audit.editEdge'), (d) => { d.edges[eid] = { ...d.edges[eid], ...patch }; });

  const family = [...rel.values()]
    .filter((r) => r.side !== 'self' && r.side !== 'unlinked')
    .sort((a, b) => a.steps.length - b.steps.length)
    .slice(0, 60);

  return (
    <>
      <div className="section-title">{t('rel.direct')}</div>
      {direct.map((e) => {
        const other = cf.persons[e.from === id ? e.to : e.from];
        if (!other) return null;
        return (
          <div key={e.id} className="rel-row" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span onClick={() => select(other.id)} style={{ cursor: 'pointer' }}><Avatar person={other} size={30} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="nm">{nm(other)}</div>
                <div className="lb">{relationLabel(rel.get(other.id), lang)} · {edgeKindText(e, id, t, ui)}</div>
              </div>
              <span className={`conf ${e.confidence}`}>{pick(CONF_META[e.confidence], ui)}</span>
              <button className="btn ghost icon-btn" title={t('rel.deleteTip')} aria-label={t('rel.deleteTip')} onClick={() => mutate('edge-del', t('audit.deleteEdge', { name: nm(other) }), (d) => { delete d.edges[e.id]; })}><Trash2 size={13} /></button>
            </div>
            <div className="grid2" style={{ marginTop: 8 }}>
              <select className="select" value={e.confidence} onChange={(ev) => update(e.id, { confidence: ev.target.value as Confidence })}>
                {Object.entries(CONF_META).map(([k, v]) => <option key={k} value={k}>{pick(v, ui)}</option>)}
              </select>
              {SUBTYPES[e.kind].length > 0 ? (
                <select className="select" value={(e.subtype as string) ?? ''} onChange={(ev) => update(e.id, { subtype: ev.target.value as Edge['subtype'] })}>
                  {SUBTYPES[e.kind].map((s) => <option key={s.v} value={s.v}>{t(s.l)}</option>)}
                </select>
              ) : <span />}
            </div>
            <input className="input" style={{ marginTop: 6 }} placeholder={t('rel.sourcePh')} defaultValue={e.source ?? ''}
              onBlur={(ev) => ev.target.value !== (e.source ?? '') && update(e.id, { source: ev.target.value || undefined })} />
          </div>
        );
      })}
      {!direct.length && <div className="muted">{t('rel.noDirect')}</div>}

      <div className="section-title">{t('rel.all')}</div>
      {family.map((r) => {
        const o = cf.persons[r.personId];
        return (
          <div key={r.personId} className="rel-row" onClick={() => select(o.id)}>
            <Avatar person={o} size={30} />
            <div style={{ minWidth: 0 }}>
              <div className="nm">{nm(o)}</div>
              <div className="lb">{relationLabel(r, lang)}</div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function PathFinder({ id }: { id: string }) {
  const cf = useStore((s) => s.cf)!;
  const lang = useStore((s) => s.lang);
  const pathTo = useStore((s) => s.pathTo);
  const pathFrom = useStore((s) => s.pathFrom);
  const setPath = useStore((s) => s.setPath);
  const t = useT();
  const tr = useTRich();
  const target = pathFrom === id ? pathTo ?? '' : '';
  const info = useMemo(() => (target ? computeRelations(cf, id).get(target) : undefined), [cf, id, target]);
  const nm = (pid: string) => (cf.persons[pid]?.isGhost ? t('common.unknown') : cf.persons[pid]?.name);

  return (
    <>
      <div className="muted"><Route size={14} style={{ verticalAlign: -2 }} /> {t('path.hint')}</div>
      {info && (
        <div className="path-box">
          {info.side === 'unlinked'
            ? t('path.unlinked')
            : tr('path.result', {
              b: <b>{nm(target)}</b>,
              a: <b>{nm(id)}</b>,
              rel: <><b>{relationLabel(info, lang)}</b>{lang !== 'en' && <> ({relationLabel(info, 'en')})</>}</>,
            })}
          {info.steps.length > 0 && (
            <div className="path-steps">
              <span>{nm(id)}</span>
              {info.steps.map((s, i) => (
                <span key={i}>→ <b>{nm(s.to)}</b></span>
              ))}
            </div>
          )}
          <button className="btn" style={{ marginTop: 8 }} onClick={() => setPath(null, null)}>{t('path.clear')}</button>
        </div>
      )}
      <PersonPicker value={target} onChange={(t) => setPath(id, t)} exclude={[id]} />
    </>
  );
}
