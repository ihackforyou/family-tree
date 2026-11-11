import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { UserPlus } from 'lucide-react';
import { useStore } from './store';
import { addPerson, newPerson } from './engine/ops';
import { TopBar } from './components/TopBar';
import { Canvas } from './components/Canvas';
import { SidePanel } from './components/SidePanel';
import { AddDialog } from './components/AddDialog';
import { LinkDialog } from './components/LinkDialog';
import { CommandPalette } from './components/CommandPalette';
import { CasesDialog } from './components/CasesDialog';

function FirstSuspect() {
  const mutate = useStore((s) => s.mutate);
  const select = useStore((s) => s.select);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const go = () => {
    if (!name.trim()) return;
    let id = '';
    mutate('add', `Suspect ${name} जोड़ा`, (d) => {
      id = addPerson(d, newPerson({ name: name.trim(), gender, role: 'suspect' })).id;
      d.focusId = id;
    });
    select(id);
  };
  return (
    <div className="empty">
      <div className="empty-card">
        <UserPlus size={28} color="var(--accent)" />
        <h3 style={{ margin: '10px 0 4px' }}>Suspect से शुरू करें</h3>
        <p className="muted" style={{ marginTop: 0 }}>पहले मुख्य suspect जोड़ें। फिर उसके card के "+" से परिवार और सहयोगी जोड़ते जाएँ।</p>
        <input className="input" autoFocus placeholder="Suspect का नाम" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
        <div className="radio-row" style={{ justifyContent: 'center', margin: '10px 0' }}>
          <button className={`chip ${gender === 'male' ? 'on' : ''}`} onClick={() => setGender('male')}>पुरुष</button>
          <button className={`chip ${gender === 'female' ? 'on' : ''}`} onClick={() => setGender('female')}>महिला</button>
        </div>
        <button className="btn primary" disabled={!name.trim()} onClick={go} style={{ width: '100%', justifyContent: 'center' }}>जोड़ें</button>
      </div>
    </div>
  );
}

function Shell() {
  const cf = useStore((s) => s.cf);
  const theme = useStore((s) => s.theme);
  const selectedId = useStore((s) => s.selectedId);
  const dialog = useStore((s) => s.dialog);
  const palette = useStore((s) => s.palette);
  const toast = useStore((s) => s.toast);
  const ready = useStore((s) => s.ready);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState();
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); st.setPalette(!st.palette); return; }
      if (typing) return;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) st.redo(); else st.undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); st.redo(); return; }
      if (e.key === 'Escape') { st.select(null); st.setPath(null, null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const empty = cf && Object.keys(cf.persons).length === 0;
  const selectedOk = cf && selectedId && cf.persons[selectedId];

  return (
    <div className="app">
      <TopBar />
      <div className="main">
        {cf ? <Canvas /> : <div className="canvas" />}
        {empty && <FirstSuspect />}
        {selectedOk && <SidePanel />}
      </div>
      {cf && dialog?.type === 'add' && cf.persons[dialog.anchorId] && <AddDialog anchorId={dialog.anchorId} preset={dialog.preset} tplId={dialog.tplId} />}
      {cf && dialog?.type === 'link' && cf.persons[dialog.aId] && cf.persons[dialog.bId] && <LinkDialog aId={dialog.aId} bId={dialog.bId} />}
      {(dialog?.type === 'cases' || (ready && !cf)) && <CasesDialog />}
      {cf && palette && <CommandPalette />}
      {toast && <div className={`toast ${toast.kind === 'err' ? 'err' : ''}`} role="status">{toast.msg}</div>}
    </div>
  );
}

export default function App() {
  const init = useStore((s) => s.init);
  useEffect(() => { void init(); }, [init]);
  return (
    <ReactFlowProvider>
      <Shell />
    </ReactFlowProvider>
  );
}
