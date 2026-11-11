import { useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  Download, FileJson, FileText, GitFork, Image, Moon, Network, Redo2, Search, Sun, Undo2, Upload, Waypoints,
} from 'lucide-react';
import { useStore } from '../store';
import type { Lang } from '../types';
import { exportJSON, exportPDF, exportPNG, readJSONFile } from '../export';

export function TopBar() {
  const cf = useStore((s) => s.cf);
  const user = useStore((s) => s.user);
  const lang = useStore((s) => s.lang);
  const view = useStore((s) => s.view);
  const theme = useStore((s) => s.theme);
  const saving = useStore((s) => s.saving);
  const past = useStore((s) => s.past.length);
  const future = useStore((s) => s.future.length);
  const { setLang, setView, toggleTheme, undo, redo, setDialog, setPalette, notify, importCase } = useStore.getState();
  const { getNodes } = useReactFlow();
  const fileRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void> | void) => {
    setMenu(false);
    setBusy(true);
    try { await fn(); } catch (e) { notify(`Export नहीं हुआ: ${(e as Error).message}`, 'err'); } finally { setBusy(false); }
  };

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><GitFork size={18} /></div>
        <div>
          <div className="brand-title">Suspect Family Tree</div>
          <div className="brand-sub hide-sm">Investigation Camp</div>
        </div>
      </div>
      {cf && (
        <button className="case-btn" onClick={() => setDialog({ type: 'cases' })} title="केस बदलें">
          <span className="t">{cf.title}</span>
          <span className="s">{cf.firNo ? `FIR ${cf.firNo} · ` : ''}{Object.keys(cf.persons).length} व्यक्ति</span>
        </button>
      )}
      <button className="btn search-trigger" onClick={() => setPalette(true)}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Search size={14} /><span className="label">खोजें या command…</span></span>
        <span className="kbd">Ctrl K</span>
      </button>
      <div className="spacer" />
      <span className="saving hide-sm">{saving ? 'Saving…' : 'Saved'}</span>
      <button className="btn icon-btn" onClick={undo} disabled={!past} title="Undo (Ctrl+Z)"><Undo2 size={15} /></button>
      <button className="btn icon-btn" onClick={redo} disabled={!future} title="Redo (Ctrl+Shift+Z)"><Redo2 size={15} /></button>
      <div className="seg">
        <button className={view === 'tree' ? 'on' : ''} onClick={() => setView('tree')} title="पीढ़ी के हिसाब से tree"><Waypoints size={14} style={{ verticalAlign: -2 }} /> <span className="hide-sm">Tree</span></button>
        <button className={view === 'network' ? 'on' : ''} onClick={() => setView('network')} title="Network view"><Network size={14} style={{ verticalAlign: -2 }} /> <span className="hide-sm">Network</span></button>
      </div>
      <div className="seg" title="रिश्तों के नाम की भाषा">
        {([['hi', 'हिं'], ['en', 'EN'], ['ur', 'اردو'], ['pa', 'ਪੰ']] as [Lang, string][]).map(([k, l]) => (
          <button key={k} className={lang === k ? 'on' : ''} onClick={() => setLang(k)}>{l}</button>
        ))}
      </div>
      <button className="btn icon-btn" onClick={toggleTheme} title="Theme">{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button>
      <div style={{ position: 'relative' }}>
        <button className="btn" onClick={() => setMenu((m) => !m)} disabled={!cf || busy}><Download size={14} /> <span className="hide-sm">{busy ? 'बन रहा है…' : 'Export'}</span></button>
        {menu && cf && (
          <div className="dialog" style={{ position: 'absolute', right: 0, top: 40, width: 240, zIndex: 30, padding: 6 }} onMouseLeave={() => setMenu(false)}>
            <button className="btn ghost" onClick={() => run(() => exportPDF(cf, getNodes(), user.name))}><FileText size={14} /> PDF (court / report)</button>
            <button className="btn ghost" onClick={() => run(() => exportPNG(cf, getNodes(), user.name))}><Image size={14} /> PNG image</button>
            <button className="btn ghost" onClick={() => run(() => exportJSON(cf))}><FileJson size={14} /> JSON backup</button>
            <button className="btn ghost" onClick={() => { setMenu(false); fileRef.current?.click(); }}><Upload size={14} /> JSON import</button>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try { await importCase(await readJSONFile(f)); notify('Import हो गया'); } catch (err) { notify(`Import नहीं हुआ: ${(err as Error).message}`, 'err'); }
      }} />
      <span className="muted hide-sm" title="Logged-in user">{user.name}</span>
    </header>
  );
}
