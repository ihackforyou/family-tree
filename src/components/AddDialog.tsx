import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from './ui/Modal';
import { X } from 'lucide-react';
import type { CaseFile, Confidence, Person, Role, SocialType, Status } from '../types';
import { useStore } from '../store';
import { TEMPLATES, searchTemplates, type RelationTemplate } from '../engine/templates';
import { pick, pickBoth, pickOther, type TKey } from '../i18n';
import { useT, useTRich, useUiLang } from '../i18n/useT';
import { SOCIAL_TYPES } from '../engine/social';
import { addEdge, addPerson, applyTemplate, draftOf, findDuplicates, newPerson } from '../engine/ops';
import { computeRelations, relationLabel } from '../engine/relations';
import { CONF_META, ROLE_META, STATUS_META } from './meta';
import { PersonPicker } from './PersonPicker';

type Preset = 'up' | 'down' | 'sibling' | 'spouse' | 'social' | undefined;

function presetTemplate(preset: Preset, anchor: Person, cf: CaseFile): RelationTemplate | undefined {
  const id = (x: string) => TEMPLATES.find((t) => t.id === x);
  const hasParent = (g: 'male' | 'female') => Object.values(cf.edges).some(
    (e) => e.kind === 'parent' && e.to === anchor.id && cf.persons[e.from]?.gender === g,
  );
  switch (preset) {
    case 'up': return hasParent('male') && !hasParent('female') ? id('mother') : id('father');
    case 'down': return id('son');
    case 'sibling': return id('brother');
    case 'spouse': return anchor.gender === 'female' ? id('husband') : id('wife');
    default: return undefined;
  }
}

export function AddDialog({ anchorId, preset, tplId }: { anchorId: string; preset?: Preset; tplId?: string }) {
  const cf = useStore((s) => s.cf)!;
  const lang = useStore((s) => s.lang);
  const mutate = useStore((s) => s.mutate);
  const setDialog = useStore((s) => s.setDialog);
  const select = useStore((s) => s.select);
  const t = useT();
  const tr = useTRich();
  const ui = useUiLang();
  const anchor = cf.persons[anchorId];

  const [mode, setMode] = useState<'family' | 'social'>(preset === 'social' ? 'social' : 'family');
  const [q, setQ] = useState('');
  const [tpl, setTpl] = useState<RelationTemplate | undefined>(
    () => (tplId ? TEMPLATES.find((t) => t.id === tplId) : undefined) ?? presetTemplate(preset, anchor, cf),
  );
  const [social, setSocial] = useState<SocialType>('friend');
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new');
  const [existingId, setExistingId] = useState<string>('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [age, setAge] = useState('');
  const [role, setRole] = useState<Role>(preset === 'social' ? 'associate' : 'relative');
  const [status, setStatus] = useState<Status>('alive');
  const [confidence, setConfidence] = useState<Confidence>('probable');
  const [source, setSource] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tpl && mode === 'family') nameRef.current?.focus();
    else searchRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(() => searchTemplates(q), [q]);
  const socialResults = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return SOCIAL_TYPES;
    return SOCIAL_TYPES.filter((s) => [s.hi, s.en, ...s.keywords].some((k) => k.toLowerCase().includes(n)));
  }, [q]);

  const personDraft = (): Partial<Person> & { name: string } => ({
    name: name.trim(),
    mobiles: mobile.trim() ? [mobile.trim()] : [],
    approxAge: age && /^\d{1,3}$/.test(age) ? Number(age) : undefined,
    dob: age && /^\d{4}/.test(age) ? age : undefined,
    role,
    status,
  });

  const canSubmit = (mode === 'social' || !!tpl) && (targetMode === 'existing' ? !!existingId : name.trim().length > 0);

  // Dry run on a copy: preview label, ghost count, and errors before saving
  const preview = useMemo(() => {
    if (!canSubmit) return null;
    try {
      const d = draftOf(cf);
      const before = Object.keys(d.persons).length;
      let tid: string;
      if (mode === 'family') {
        tid = applyTemplate(d, anchorId, tpl!, targetMode === 'existing' ? { existingId } : { person: personDraft() });
      } else {
        tid = targetMode === 'existing' ? existingId : addPerson(d, newPerson(personDraft())).id;
        addEdge(d, 'social', anchorId, tid, { subtype: social });
      }
      const ghosts = Object.keys(d.persons).length - before - (targetMode === 'new' ? 1 : 0);
      const focus = d.focusId ?? anchorId;
      const lbl = relationLabel(computeRelations(d, focus).get(tid), lang);
      return { ok: true as const, ghosts, lbl, focusName: d.persons[focus]?.name };
    } catch (e) {
      return { ok: false as const, err: (e as Error).message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cf, mode, tpl, social, targetMode, existingId, name, mobile, age, role, status, lang, anchorId, ui]);

  const dups = useMemo(
    () => (targetMode === 'new' && (name.trim().length > 2 || mobile.trim().length > 5) ? findDuplicates(cf, { name, mobiles: mobile ? [mobile] : [] }) : []),
    [cf, targetMode, name, mobile],
  );

  const submit = () => {
    if (!canSubmit) return;
    let newId = '';
    const what = pick(mode === 'family' ? tpl! : SOCIAL_TYPES.find((s) => s.type === social)!, ui);
    const ok = mutate('add', t('audit.addRelative', { name: anchor.isGhost ? t('common.unknown') : anchor.name, what }), (d) => {
      const meta = { confidence, source: source.trim() || undefined };
      if (mode === 'family') {
        newId = applyTemplate(d, anchorId, tpl!, targetMode === 'existing' ? { existingId } : { person: personDraft() }, meta);
      } else {
        newId = targetMode === 'existing' ? existingId : addPerson(d, newPerson(personDraft())).id;
        addEdge(d, 'social', anchorId, newId, { ...meta, subtype: social });
      }
    });
    if (ok) {
      setDialog(null);
      select(newId);
    }
  };

  const grouped = useMemo(() => {
    const g = new Map<string, RelationTemplate[]>();
    for (const r of results) {
      const k = q ? t('add.results') : t(`tplGroup.${r.group}` as TKey);
      const a = g.get(k);
      if (a) a.push(r);
      else g.set(k, [r]);
    }
    return [...g.entries()];
  }, [results, q, t]);

  return (
    <Modal onClose={() => setDialog(null)} label={t('add.aria')}>
      <div style={{ display: 'contents' }} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(); }}>
        <div className="dialog-head">
          <h3>{t('add.title', { name: anchor.isGhost ? t('common.unknown') : anchor.name })}</h3>
          <div className="seg" style={{ marginLeft: 'auto' }}>
            <button className={mode === 'family' ? 'on' : ''} onClick={() => setMode('family')}>{t('add.family')}</button>
            <button className={mode === 'social' ? 'on' : ''} onClick={() => { setMode('social'); setRole('associate'); }}>{t('add.socialMode')}</button>
          </div>
          <button className="btn ghost icon-btn" onClick={() => setDialog(null)} aria-label={t('common.close')}><X size={16} /></button>
        </div>
        <div className="dialog-body">
          <input
            ref={searchRef}
            className="input"
            placeholder={mode === 'family' ? t('add.searchFamily') : t('add.searchSocial')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && mode === 'family' && results[0]) { setTpl(results[0]); nameRef.current?.focus(); }
            }}
          />

          {mode === 'family' ? (
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {grouped.map(([g, list]) => (
                <div key={g}>
                  <div className="group-label">{g}</div>
                  <div className="tpl-grid">
                    {list.map((r) => (
                      <button key={r.id} className={`tpl ${tpl?.id === r.id ? 'on' : ''}`} onClick={() => setTpl(r)} title={pickOther(r, ui)}>
                        {pick(r, ui)}{q && <span className="en">{pickOther(r, ui)}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!results.length && <div className="muted">{t('add.noMatch')}</div>}
            </div>
          ) : (
            <div className="tpl-grid">
              {socialResults.map((s) => (
                <button key={s.type} className={`tpl ${social === s.type ? 'on' : ''}`} onClick={() => setSocial(s.type)}>
                  {pick(s, ui)}<span className="en">{pickOther(s, ui)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="radio-row">
            <button className={`chip ${targetMode === 'new' ? 'on' : ''}`} onClick={() => setTargetMode('new')}>{t('add.newPerson')}</button>
            <button className={`chip ${targetMode === 'existing' ? 'on' : ''}`} onClick={() => setTargetMode('existing')}>{t('add.existing')}</button>
          </div>

          {targetMode === 'existing' ? (
            <PersonPicker value={existingId} onChange={setExistingId} exclude={[anchorId]} />
          ) : (
            <>
              <div className="grid2">
                <label className="field"><span>{t('add.nameReq')}</span>
                  <input ref={nameRef} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('add.namePh')} onKeyDown={(e) => e.key === 'Enter' && submit()} />
                </label>
                <label className="field"><span>{t('add.mobile')}</span>
                  <input className="input num" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="98xxxxxxxx" />
                </label>
                <label className="field"><span>{t('add.age')}</span>
                  <input className="input num" value={age} onChange={(e) => setAge(e.target.value)} placeholder={t('add.agePh')} />
                </label>
                <label className="field"><span>{t('add.role')}</span>
                  <select className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                    {Object.entries(ROLE_META).map(([k, v]) => <option key={k} value={k}>{pickBoth(v, ui)}</option>)}
                  </select>
                </label>
                <label className="field"><span>{t('add.status')}</span>
                  <select className="select" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                    {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{pickBoth(v, ui)}</option>)}
                  </select>
                </label>
              </div>
              {dups.length > 0 && (
                <div className="warn">
                  {t('add.dup')} <b>{dups[0].name}</b>{dups[0].mobiles[0] ? ` (${dups[0].mobiles[0]})` : ''}.{' '}
                  <button className="btn" style={{ padding: '2px 8px', marginLeft: 6 }} onClick={() => { setTargetMode('existing'); setExistingId(dups[0].id); }}>
                    {t('add.useThem')}
                  </button>
                </div>
              )}
            </>
          )}

          <div className="grid2">
            <label className="field"><span>{t('add.confidence')}</span>
              <select className="select" value={confidence} onChange={(e) => setConfidence(e.target.value as Confidence)}>
                {Object.entries(CONF_META).map(([k, v]) => <option key={k} value={k}>{pickBoth(v, ui)}</option>)}
              </select>
            </label>
            <label className="field"><span>{t('add.source')}</span>
              <input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder={t('add.sourcePh')} />
            </label>
          </div>

          {preview && (
            preview.ok ? (
              <div className="preview">
                {tr('add.preview', { focus: <b>{preview.focusName}</b>, rel: <b>{preview.lbl}</b> })}
                {preview.ghosts > 0 && t('add.ghosts', { n: preview.ghosts })}
              </div>
            ) : <div className="warn">{preview.err}</div>
          )}
        </div>
        <div className="dialog-foot">
          <span className="muted hide-sm" style={{ marginRight: 'auto' }}><span className="kbd">Enter</span> {t('add.kbdAdd')} · <span className="kbd">Esc</span> {t('add.kbdClose')}</span>
          <button className="btn" onClick={() => setDialog(null)}>{t('common.cancel')}</button>
          <button className="btn primary" disabled={!canSubmit || (preview !== null && !preview.ok)} onClick={submit}>{t('common.add')}</button>
        </div>
      </div>
    </Modal>
  );
}
