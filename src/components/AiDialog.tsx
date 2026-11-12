import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, Loader2, LogOut, Mic, MicOff, Sparkles, Users } from 'lucide-react';
import { useStore } from '../store';
import { Modal } from './ui/Modal';
import { AiError, aiCommand, aiStatus, session, signIn, signOut } from '../ai/client';
import { applyFamilyActions } from '../ai/apply';
import type { AiResult, AiStatus, FamilyAction } from '../ai/types';
import { useSpeech } from '../ai/useSpeech';
import { SOCIAL_TYPES } from '../engine/social';
import type { TStep } from '../engine/templates';
import { pick, type T, type TKey } from '../i18n';
import { useT, useUiLang } from '../i18n/useT';
import { CONF_META, ROLE_META } from './meta';

type Mode = 'command' | 'extract';
type Model = 'default' | 'lite';

const STEP_WORD: Record<TStep['kind'], [TKey, TKey, TKey]> = {
  up: ['step.father', 'step.mother', 'step.parent'],
  down: ['step.son', 'step.daughter', 'step.child'],
  sibling: ['step.brother', 'step.sister', 'step.sibling'],
  spouse: ['step.husband', 'step.wife', 'step.spouse'],
};
const stepWord = (s: TStep, t: T) => {
  const w = t(STEP_WORD[s.kind][s.gender === 'male' ? 0 : s.gender === 'female' ? 1 : 2]);
  const f = s.gender === 'female';
  return s.seniority === 'e' ? t(f ? 'step.elderF' : 'step.elder', { w }) : s.seniority === 'y' ? t(f ? 'step.youngerF' : 'step.younger', { w }) : w;
};
const pathText = (steps: TStep[], t: T) => steps.map((s) => stepWord(s, t)).join(' → ');

/**
 * AI assistant for the family tree: type or speak (English / हिंदी / Hinglish), or paste a statement.
 * The server proposes people and relations; nothing changes until the officer ticks and applies them.
 */
export function AiDialog() {
  const cf = useStore((s) => s.cf)!;
  const selectedId = useStore((s) => s.selectedId);
  const { setDialog, mutate, notify } = useStore.getState();
  const t = useT();
  const [signedIn, setSignedIn] = useState(() => !!session.get());
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<Mode>('command');
  const [model, setModel] = useState<Model>('default');
  const [lang, setLang] = useState<'hi-IN' | 'en-IN'>('hi-IN');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);
  const [picked, setPicked] = useState<boolean[]>([]);
  const speech = useSpeech((t) => setText((cur) => (cur ? `${cur} ${t}` : t)));

  useEffect(() => {
    if (!signedIn) return;
    aiStatus().then(setStatus).catch((e) => {
      if (e instanceof AiError && e.status === 401) setSignedIn(false);
    });
  }, [signedIn]);

  const close = () => { speech.stop(); setDialog(null); };
  const name = (id: string) => {
    const p = cf.persons[id];
    if (p) return p.isGhost ? t('common.unknown') : p.name;
    const a = result?.actions.find((x) => 'ref' in x && x.ref === id);
    return a && 'name' in a ? a.name : id;
  };

  const run = async () => {
    if (!text.trim()) return;
    speech.stop();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const persons = Object.values(cf.persons).map((p) => ({
        id: p.id, name: p.isGhost ? 'unknown (placeholder)' : p.name, gender: p.gender, role: p.role, aliases: p.aliases.slice(0, 5),
      }));
      const r = await aiCommand({
        mode, model, text: text.trim(),
        family: { persons, focusId: cf.focusId, selectedId: selectedId && cf.persons[selectedId] ? selectedId : undefined },
      });
      setResult(r);
      setPicked(r.actions.map(() => true));
      setStatus((s) => (s ? { ...s, usedToday: s.usedToday + 1 } : s));
    } catch (e) {
      if (e instanceof AiError && e.status === 401) setSignedIn(false);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!result) return;
    const chosen = result.actions.filter((_, i) => picked[i]);
    if (!chosen.length) return;
    let outcome = { applied: 0, errors: [] as string[] };
    const ok = mutate('ai', t('audit.ai', { n: chosen.length }), (d) => { outcome = applyFamilyActions(d, chosen); });
    if (!ok) return;
    if (outcome.errors.length) notify(t('toast.aiSkipped', { list: outcome.errors.join('; ') }), 'err');
    notify(t('toast.aiAdded', { n: outcome.applied }), 'ok', { label: t('common.undo'), onClick: () => useStore.getState().undo() });
    close();
  };

  if (!signedIn) return <SignIn onDone={() => setSignedIn(true)} onClose={close} />;

  const maxChars = status?.maxChars?.[mode] ?? (mode === 'command' ? 2000 : 20000);
  const count = picked.filter(Boolean).length;

  return (
    <Modal onClose={close} label={t('ai.title')} className="ai-dialog">
      <div className="dialog-head">
        <Sparkles size={16} color="var(--accent)" />
        <h3>{t('ai.title')}</h3>
        <span className="muted" style={{ marginLeft: 'auto' }}>{status ? t('ai.today', { used: status.usedToday, limit: status.dailyLimit }) : ''}</span>
        <button className="btn icon-btn" title={t('ai.signOutTip')} aria-label={t('ai.signOut')} onClick={() => { void signOut(); setSignedIn(false); }}>
          <LogOut size={14} />
        </button>
      </div>
      <div className="dialog-body">
        {status && !status.enabled ? (
          <p className="muted">{t('ai.off')}</p>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>{t('ai.intro')}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <div className="seg">
                <button className={mode === 'command' ? 'on' : ''} onClick={() => setMode('command')}>{t('ai.modeCommand')}</button>
                <button className={mode === 'extract' ? 'on' : ''} onClick={() => setMode('extract')}>{t('ai.modeExtract')}</button>
              </div>
              <div className="seg">
                <button className={model === 'default' ? 'on' : ''} onClick={() => setModel('default')}>Gemini 3.8 Flash</button>
                <button className={model === 'lite' ? 'on' : ''} onClick={() => setModel('lite')}>{t('ai.lite')}</button>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <textarea
                className="textarea"
                autoFocus
                rows={mode === 'extract' ? 9 : 3}
                maxLength={maxChars}
                value={speech.listening && speech.interim ? `${text} ${speech.interim}` : text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void run(); }}
                placeholder={mode === 'extract' ? t('ai.phExtract') : 'Rahul ka mama Suresh add karo, uska mobile 98xxxxxx12 hai'}
                style={{ paddingRight: 84, fontSize: 13.5 }}
              />
              {speech.supported && (
                <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 2 }}>
                  <button className="btn icon-btn" title={t('ai.voiceLang')} aria-label={t('ai.voiceLang')} onClick={() => setLang(lang === 'hi-IN' ? 'en-IN' : 'hi-IN')} style={{ fontSize: 11.5, width: 'auto', padding: '0 6px' }}>
                    {lang === 'hi-IN' ? 'हिं' : 'EN'}
                  </button>
                  <button
                    className={`btn icon-btn ${speech.listening ? 'rec' : ''}`}
                    aria-label={speech.listening ? t('ai.stopVoice') : t('ai.speak')}
                    title={speech.listening ? t('ai.stop') : t('ai.speakTip')}
                    onClick={() => (speech.listening ? speech.stop() : speech.start(lang))}
                  >
                    {speech.listening ? <MicOff size={15} /> : <Mic size={15} />}
                  </button>
                </div>
              )}
            </div>
            {speech.error && <p className="ai-err">{speech.error}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="muted num">{text.length.toLocaleString()} / {maxChars.toLocaleString()}</span>
              <span className="muted" style={{ marginLeft: 'auto' }}>Ctrl Enter</span>
              <button className="btn primary" disabled={busy || !text.trim()} onClick={() => void run()}>
                {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} {busy ? t('ai.thinking') : t('ai.propose')}
              </button>
            </div>
            {error && <p className="ai-err" role="alert"><AlertTriangle size={14} /> {error}</p>}

            {result && (
              <div className="ai-result">
                {result.reply && <p style={{ margin: 0 }}>{result.reply}</p>}
                {result.questions.map((q) => <p key={q} className="ai-q">? {q}</p>)}
                {result.actions.length > 0 && (
                  <ul className="ai-list">
                    {result.actions.map((a, i) => (
                      <li key={i}>
                        <label>
                          <input type="checkbox" checked={picked[i] ?? false} onChange={(e) => setPicked((p) => p.map((v, j) => (j === i ? e.target.checked : v)))} />
                          <ActionText a={a} name={name} />
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                {result.warnings.length > 0 && (
                  <details className="muted">
                    <summary>{t('ai.skipped', { n: result.warnings.length })}</summary>
                    <ul>{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                  </details>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {result && result.actions.length > 0 && (
        <div className="dialog-foot">
          <span className="muted" style={{ marginRight: 'auto' }}>{result.model} · {result.usage.inputTokens + result.usage.outputTokens} tokens</span>
          <button className="btn ghost" onClick={() => setResult(null)}>{t('ai.discard')}</button>
          <button className="btn primary" disabled={!count} onClick={apply}><Check size={14} /> {t('ai.apply', { n: count })}</button>
        </div>
      )}
    </Modal>
  );
}

function ActionText({ a, name }: { a: FamilyAction; name: (id: string) => string }) {
  const t = useT();
  const ui = useUiLang();
  const social = (type: string) => {
    const d = SOCIAL_TYPES.find((s) => s.type === type);
    return d ? pick(d, ui) : type;
  };
  const facts = (x: Extract<FamilyAction, { name: string }>) =>
    [
      x.role && x.role !== 'relative' ? (ROLE_META[x.role] ? pick(ROLE_META[x.role], ui) : x.role) : '',
      x.approxAge ? t('common.yrs', { n: x.approxAge }) : '',
      x.mobile ?? '',
      x.confidence && x.confidence !== 'probable' ? (CONF_META[x.confidence] ? pick(CONF_META[x.confidence], ui) : x.confidence) : '',
    ].filter(Boolean).join(' · ');
  switch (a.op) {
    case 'addRelative':
      return (
        <span className="ai-act">
          <b>{a.name}</b> <span className="muted">{t('ai.relative', { anchor: name(a.anchor), path: pathText(a.steps, t) })}</span>
          {facts(a) && <span className="muted"> · {facts(a)}</span>}
        </span>
      );
    case 'addAssociate':
      return (
        <span className="ai-act">
          <Users size={12} /> <b>{a.name}</b> <span className="muted">{t('ai.associate', { anchor: name(a.anchor), type: social(a.socialType) })}</span>
          {facts(a) && <span className="muted"> · {facts(a)}</span>}
        </span>
      );
    case 'addPerson':
      return <span className="ai-act"><b>{a.name}</b> <span className="muted">{t('ai.newPerson')}{facts(a) ? ` · ${facts(a)}` : ''}</span></span>;
    case 'relate':
      return (
        <span className="ai-act">
          <b>{name(a.a)}</b> <ArrowRight size={12} /> <b>{name(a.b)}</b>{' '}
          <span className="muted">{a.socialType ? social(a.socialType) : a.steps ? pathText(a.steps, t) : ''}</span>
        </span>
      );
  }
}

function SignIn({ onDone, onClose }: { onDone(): void; onClose(): void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal onClose={onClose} label={t('ai.signInAria')}>
      <form onSubmit={submit} style={{ display: 'contents' }}>
        <div className="dialog-head"><Sparkles size={16} color="var(--accent)" /><h3>{t('ai.signInTitle')}</h3></div>
        <div className="dialog-body">
          <p className="muted" style={{ margin: 0 }}>{t('ai.signInBody')}</p>
          <label className="field"><span>{t('ai.email')}</span><input className="input" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="field"><span>{t('ai.password')}</span><input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error && <p className="ai-err" role="alert"><AlertTriangle size={14} /> {error}</p>}
        </div>
        <div className="dialog-foot">
          <button type="button" className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? <Loader2 size={14} className="spin" /> : null} {t('ai.signIn')}</button>
        </div>
      </form>
    </Modal>
  );
}
