import { useMemo, useState } from 'react';
import { Crosshair, Plus, Route, Trash2, X } from 'lucide-react';
import type { Confidence, Edge, Gender, Person, Role, Status } from '../types';
import { useStore } from '../store';
import { computeRelations, relationLabel } from '../engine/relations';
import { removePerson } from '../engine/ops';
import { socialLabel } from '../engine/social';
import { Avatar } from './PersonNode';
import { PersonPicker } from './PersonPicker';
import { CONF_META, ROLE_META, SIDE_META, STATUS_META, genLabel } from './meta';

type Tab = 'details' | 'relations' | 'path' | 'history';

export function SidePanel() {
  const cf = useStore((s) => s.cf)!;
  const id = useStore((s) => s.selectedId)!;
  const lang = useStore((s) => s.lang);
  const select = useStore((s) => s.select);
  const setFocus = useStore((s) => s.setFocus);
  const setDialog = useStore((s) => s.setDialog);
  const mutate = useStore((s) => s.mutate);
  const [tab, setTab] = useState<Tab>('details');
  const p = cf.persons[id];

  const focusInfo = useMemo(
    () => (cf.focusId ? computeRelations(cf, cf.focusId).get(id) : undefined),
    [cf, id],
  );
  if (!p) return null;

  const del = () => {
    if (!confirm(`${p.name} और उसके सारे रिश्ते हटाएँ? (Ctrl+Z से वापस ला सकते हैं)`)) return;
    mutate('delete', `${p.name} हटाया`, (d) => removePerson(d, id));
    select(null);
  };

  return (
    <aside className="panel" aria-label="व्यक्ति का विवरण">
      <div className="panel-head">
        <Avatar person={p} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="panel-title">{p.isGhost ? 'अज्ञात (ghost)' : p.name}</div>
          <div className="muted">
            {relationLabel(focusInfo, lang)}
            {focusInfo && focusInfo.side !== 'unlinked' && focusInfo.side !== 'associate' && <> · {genLabel(focusInfo.generation)} · {SIDE_META[focusInfo.side].hi}</>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {cf.focusId !== id && <button className="btn" onClick={() => setFocus(id)}><Crosshair size={14} /> Focus बनाएँ</button>}
            <button className="btn" onClick={() => setDialog({ type: 'add', anchorId: id })}><Plus size={14} /> जोड़ें</button>
            <button className="btn danger" onClick={del} title="हटाएँ"><Trash2 size={14} /></button>
          </div>
        </div>
        <button className="btn ghost icon-btn" onClick={() => select(null)} aria-label="बंद करें"><X size={16} /></button>
      </div>
      <div className="tabs">
        {([['details', 'विवरण'], ['relations', 'रिश्ते'], ['path', 'रिश्ता खोजें'], ['history', 'History']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
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
                <div className="when">{new Date(a.ts).toLocaleString('hi-IN')} · {a.user}</div>
              </div>
            ))}
            {!cf.audit.length && <div className="muted">अभी कोई बदलाव नहीं</div>}
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
    photo: p.photo,
  }));
  const [dirty, setDirty] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((x) => ({ ...x, [k]: v })); setDirty(true); };

  const save = () => {
    if (f.aadhaarLast4 && !/^\d{4}$/.test(f.aadhaarLast4)) {
      notify('Aadhaar के सिर्फ़ आख़िरी 4 अंक डालें', 'err');
      return;
    }
    const name = f.name.trim() || (p.isGhost ? 'अज्ञात' : p.name);
    mutate('edit', `${name} का विवरण बदला`, (d) => {
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
      <label className="field"><span>नाम</span>
        <input className="input" value={f.name} placeholder={p.isGhost ? 'अज्ञात — नाम पता हो तो भरें' : ''} onChange={(e) => set('name', e.target.value)} />
      </label>
      <label className="field"><span>उर्फ़ / दूसरे नाम (comma से अलग)</span>
        <input className="input" value={f.aliases} onChange={(e) => set('aliases', e.target.value)} />
      </label>
      <div className="grid2">
        <label className="field"><span>लिंग</span>
          <select className="select" value={f.gender} onChange={(e) => set('gender', e.target.value as Gender)}>
            <option value="male">पुरुष</option><option value="female">महिला</option><option value="other">अन्य</option><option value="unknown">पता नहीं</option>
          </select>
        </label>
        <label className="field"><span>जन्म तिथि / वर्ष</span>
          <input className="input num" value={f.dob} placeholder="1990 या 1990-05-21" onChange={(e) => set('dob', e.target.value)} />
        </label>
        <label className="field"><span>भूमिका</span>
          <select className="select" value={f.role} onChange={(e) => set('role', e.target.value as Role)}>
            {Object.entries(ROLE_META).map(([k, v]) => <option key={k} value={k}>{v.hi} · {v.en}</option>)}
          </select>
        </label>
        <label className="field"><span>स्थिति</span>
          <select className="select" value={f.status} onChange={(e) => set('status', e.target.value as Status)}>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.hi} · {v.en}</option>)}
          </select>
        </label>
        <label className="field"><span>लगभग उम्र</span>
          <input className="input num" value={f.approxAge} onChange={(e) => set('approxAge', e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="field"><span>धर्म / समुदाय</span>
          <input className="input" value={f.religion} onChange={(e) => set('religion', e.target.value)} />
        </label>
      </div>
      <label className="field"><span>Mobile नंबर (comma से अलग)</span>
        <input className="input num" value={f.mobiles} onChange={(e) => set('mobiles', e.target.value)} />
      </label>
      <div className="grid2">
        <label className="field"><span>Aadhaar (सिर्फ़ आख़िरी 4 अंक)</span>
          <input className="input num" maxLength={4} value={f.aadhaarLast4} placeholder="XXXX-XXXX-____" onChange={(e) => set('aadhaarLast4', e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </label>
        <label className="field"><span>FIR नंबर</span>
          <input className="input" value={f.firs} onChange={(e) => set('firs', e.target.value)} />
        </label>
      </div>
      <label className="field"><span>पता</span>
        <input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} />
      </label>
      <label className="field"><span>Notes</span>
        <textarea className="textarea" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
      <label className="field"><span>फ़ोटो</span>
        <input type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </label>
      {f.photo && <button className="btn" onClick={() => set('photo', undefined)}>फ़ोटो हटाएँ</button>}
      <button className="btn primary" disabled={!dirty} onClick={save} style={{ justifyContent: 'center' }}>Save करें</button>
    </>
  );
}

function edgeKindText(e: Edge, selfId: string): string {
  if (e.kind === 'parent') return e.from === selfId ? 'संतान' : 'माता/पिता';
  if (e.kind === 'spouse') return 'पति/पत्नी';
  if (e.kind === 'sibling') return 'भाई/बहन';
  return socialLabel((e.subtype as never) ?? 'other', 'hi');
}

const SUBTYPES: Record<Edge['kind'], { v: string; l: string }[]> = {
  parent: [
    { v: 'biological', l: 'सगा' }, { v: 'adoptive', l: 'गोद' }, { v: 'step', l: 'सौतेला' },
    { v: 'foster', l: 'पालक' }, { v: 'guardian', l: 'संरक्षक / kafala' },
  ],
  spouse: [
    { v: 'married', l: 'शादीशुदा' }, { v: 'divorced', l: 'तलाक' }, { v: 'separated', l: 'अलग' },
    { v: 'widowed', l: 'विधुर/विधवा' }, { v: 'live-in', l: 'लिव-इन' },
  ],
  sibling: [{ v: 'full', l: 'सगा' }, { v: 'half', l: 'सौतेला (half)' }, { v: 'step', l: 'सौतेला (step)' }, { v: 'fictive', l: 'मुँहबोला / राखी' }],
  social: [],
};

function Relations({ id }: { id: string }) {
  const cf = useStore((s) => s.cf)!;
  const lang = useStore((s) => s.lang);
  const select = useStore((s) => s.select);
  const mutate = useStore((s) => s.mutate);
  const rel = useMemo(() => computeRelations(cf, id), [cf, id]);
  const direct = Object.values(cf.edges).filter((e) => e.from === id || e.to === id);

  const update = (eid: string, patch: Partial<Edge>) =>
    mutate('edge', 'रिश्ते का विवरण बदला', (d) => { d.edges[eid] = { ...d.edges[eid], ...patch }; });

  const family = [...rel.values()]
    .filter((r) => r.side !== 'self' && r.side !== 'unlinked')
    .sort((a, b) => a.steps.length - b.steps.length)
    .slice(0, 60);

  return (
    <>
      <div className="section-title">सीधे जुड़े रिश्ते (stored)</div>
      {direct.map((e) => {
        const other = cf.persons[e.from === id ? e.to : e.from];
        if (!other) return null;
        return (
          <div key={e.id} className="rel-row" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span onClick={() => select(other.id)} style={{ cursor: 'pointer' }}><Avatar person={other} size={30} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="nm">{other.isGhost ? 'अज्ञात' : other.name}</div>
                <div className="lb">{relationLabel(rel.get(other.id), lang)} · {edgeKindText(e, id)}</div>
              </div>
              <span className={`conf ${e.confidence}`}>{CONF_META[e.confidence].hi}</span>
              <button className="btn ghost icon-btn" title="यह रिश्ता हटाएँ" onClick={() => mutate('edge-del', `${other.name} से रिश्ता हटाया`, (d) => { delete d.edges[e.id]; })}><Trash2 size={13} /></button>
            </div>
            <div className="grid2" style={{ marginTop: 8 }}>
              <select className="select" value={e.confidence} onChange={(ev) => update(e.id, { confidence: ev.target.value as Confidence })}>
                {Object.entries(CONF_META).map(([k, v]) => <option key={k} value={k}>{v.hi}</option>)}
              </select>
              {SUBTYPES[e.kind].length > 0 ? (
                <select className="select" value={(e.subtype as string) ?? ''} onChange={(ev) => update(e.id, { subtype: ev.target.value as Edge['subtype'] })}>
                  {SUBTYPES[e.kind].map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              ) : <span />}
            </div>
            <input className="input" style={{ marginTop: 6 }} placeholder="Source: पूछताछ, CDR, bank…" defaultValue={e.source ?? ''}
              onBlur={(ev) => ev.target.value !== (e.source ?? '') && update(e.id, { source: ev.target.value || undefined })} />
          </div>
        );
      })}
      {!direct.length && <div className="muted">कोई सीधा रिश्ता नहीं</div>}

      <div className="section-title">इस व्यक्ति की नज़र से सभी रिश्ते</div>
      {family.map((r) => {
        const o = cf.persons[r.personId];
        return (
          <div key={r.personId} className="rel-row" onClick={() => select(o.id)}>
            <Avatar person={o} size={30} />
            <div style={{ minWidth: 0 }}>
              <div className="nm">{o.isGhost ? 'अज्ञात' : o.name}</div>
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
  const target = pathFrom === id ? pathTo ?? '' : '';
  const info = useMemo(() => (target ? computeRelations(cf, id).get(target) : undefined), [cf, id, target]);
  const nm = (pid: string) => (cf.persons[pid]?.isGhost ? 'अज्ञात' : cf.persons[pid]?.name);

  return (
    <>
      <div className="muted"><Route size={14} style={{ verticalAlign: -2 }} /> किसी दूसरे व्यक्ति को चुनें। Canvas पर दोनों के बीच का रास्ता चमकेगा।</div>
      {info && (
        <div className="path-box">
          {info.side === 'unlinked'
            ? <>दोनों के बीच अभी कोई रिश्ता नहीं जुड़ा है।</>
            : <><b>{nm(target)}</b>, <b>{nm(id)}</b> के <b>{relationLabel(info, lang)}</b> हैं{lang !== 'en' && <> ({relationLabel(info, 'en')})</>}।</>}
          {info.steps.length > 0 && (
            <div className="path-steps">
              <span>{nm(id)}</span>
              {info.steps.map((s, i) => (
                <span key={i}>→ <b>{nm(s.to)}</b></span>
              ))}
            </div>
          )}
          <button className="btn" style={{ marginTop: 8 }} onClick={() => setPath(null, null)}>Highlight हटाएँ</button>
        </div>
      )}
      <PersonPicker value={target} onChange={(t) => setPath(id, t)} exclude={[id]} />
    </>
  );
}
