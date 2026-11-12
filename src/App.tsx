import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { UserPlus } from 'lucide-react';
import { Toaster } from 'sonner';
import { useStore } from './store';
import { addPerson, newPerson } from './engine/ops';
import { TopBar } from './components/TopBar';
import { LeftRail } from './components/LeftRail';
import { RightRail } from './components/RightRail';
import { BottomBar } from './components/BottomBar';
import { Canvas } from './components/Canvas';
import { PersonPanel } from './components/PanelSheet';
import { AddDialog } from './components/AddDialog';
import { LinkDialog } from './components/LinkDialog';
import { CommandPalette } from './components/CommandPalette';
import { CasesDialog } from './components/CasesDialog';
import { AiDialog } from './components/AiDialog';
import { SuspectTable } from './components/SuspectTable';
import { TooltipProvider } from './components/Rail';
import { ConfirmHost } from './components/ui/Confirm';
import { useT } from './i18n/useT';

function FirstSuspect() {
  const mutate = useStore((s) => s.mutate);
  const select = useStore((s) => s.select);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const t = useT();
  const go = () => {
    if (!name.trim()) return;
    let id = '';
    mutate('add', t('audit.addSuspect', { name: name.trim() }), (d) => {
      id = addPerson(d, newPerson({ name: name.trim(), gender, role: 'suspect' })).id;
      d.focusId = id;
    });
    select(id);
  };
  return (
    <div className="empty">
      <div className="empty-card">
        <UserPlus size={28} color="var(--accent)" />
        <h3 style={{ margin: '10px 0 4px' }}>{t('first.title')}</h3>
        <p className="muted" style={{ marginTop: 0 }}>{t('first.body')}</p>
        <input className="input" autoFocus placeholder={t('first.ph')} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
        <div className="radio-row" style={{ justifyContent: 'center', margin: '10px 0' }}>
          <button className={`chip ${gender === 'male' ? 'on' : ''}`} onClick={() => setGender('male')}>{t('common.male')}</button>
          <button className={`chip ${gender === 'female' ? 'on' : ''}`} onClick={() => setGender('female')}>{t('common.female')}</button>
        </div>
        <button className="btn primary" disabled={!name.trim()} onClick={go} style={{ width: '100%', justifyContent: 'center' }}>{t('common.add')}</button>
      </div>
    </div>
  );
}

function Shell() {
  const cf = useStore((s) => s.cf);
  const view = useStore((s) => s.view);
  const theme = useStore((s) => s.theme);
  const selectedId = useStore((s) => s.selectedId);
  const dialog = useStore((s) => s.dialog);
  const palette = useStore((s) => s.palette);
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
      if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); if (st.cf) st.setDialog({ type: 'ai' }); return; }
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
      <div className="workspace">
        <LeftRail />
        <div className="center">
          <div className="main">
            {cf ? (view === 'table' ? <SuspectTable /> : <Canvas />) : <div className="canvas" />}
            {empty && <FirstSuspect />}
            {selectedOk && <PersonPanel />}
          </div>
          <BottomBar />
        </div>
        <RightRail />
      </div>
      {cf && dialog?.type === 'add' && cf.persons[dialog.anchorId] && <AddDialog anchorId={dialog.anchorId} preset={dialog.preset} tplId={dialog.tplId} />}
      {cf && dialog?.type === 'link' && cf.persons[dialog.aId] && cf.persons[dialog.bId] && <LinkDialog aId={dialog.aId} bId={dialog.bId} />}
      {(dialog?.type === 'cases' || (ready && !cf)) && <CasesDialog />}
      {cf && dialog?.type === 'ai' && <AiDialog />}
      {cf && palette && <CommandPalette />}
      <Toaster theme={theme} position="bottom-center" offset={60} gap={8} visibleToasts={4} className="toaster" />
      <ConfirmHost />
    </div>
  );
}

export default function App() {
  const init = useStore((s) => s.init);
  useEffect(() => { void init(); }, [init]);
  return (
    <ReactFlowProvider>
      <TooltipProvider>
        <Shell />
      </TooltipProvider>
    </ReactFlowProvider>
  );
}
