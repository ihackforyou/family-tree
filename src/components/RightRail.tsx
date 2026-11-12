import { useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { FileJson, FileText, FolderOpen, Image, Moon, Network, Orbit, Search, Sparkles, Sun, Table2, Upload, Waypoints } from 'lucide-react';
import { useStore } from '../store';
import type { Lang } from '../types';
import type { TKey } from '../i18n';
import { useT } from '../i18n/useT';
import { exportJSON, exportPDF, exportPNG, readJSONFile } from '../export';
import { RailButton, RailDivider } from './Rail';

/** Relation-name languages: these change only the computed relation words (मामा / Mother's brother …), not the interface. */
const LANGS: [Lang, string, TKey][] = [
  ['hi', 'हिं', 'rr.relLang.hi'],
  ['en', 'EN', 'rr.relLang.en'],
  ['ur', 'اُر', 'rr.relLang.ur'],
  ['pa', 'ਪੰ', 'rr.relLang.pa'],
];

/** Right rail: views, search, cases, export / import, interface + relation language and theme. One click each. */
export function RightRail() {
  const cf = useStore((s) => s.cf);
  const user = useStore((s) => s.user);
  const view = useStore((s) => s.view);
  const lang = useStore((s) => s.lang);
  const uiLang = useStore((s) => s.uiLang);
  const theme = useStore((s) => s.theme);
  const t = useT();
  const { setView, setPalette, setDialog, setLang, setUiLang, toggleTheme, notify, importCase } = useStore.getState();
  const { getNodes } = useReactFlow();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    try { await fn(); } catch (e) { notify(t('toast.exportFailed', { msg: (e as Error).message }), 'err'); } finally { setBusy(false); }
  };

  return (
    <aside className="rail rail-right" aria-label={t('rr.aria')}>
      <RailButton side="left" label={t('rr.chart')} active={view === 'chart'} onClick={() => setView('chart')}>
        <Network size={17} style={{ transform: 'rotate(180deg)' }} />
      </RailButton>
      <RailButton side="left" label={t('rr.lanes')} active={view === 'tree'} onClick={() => setView('tree')}>
        <Waypoints size={17} />
      </RailButton>
      <RailButton side="left" label={t('rr.table')} active={view === 'table'} onClick={() => setView('table')}>
        <Table2 size={17} />
      </RailButton>
      <RailButton side="left" label={t('rr.network')} active={view === 'network'} onClick={() => setView('network')}>
        <Orbit size={17} />
      </RailButton>
      <RailDivider />
      <RailButton side="left" label={t('rr.ai')} shortcut="Ctrl I" disabled={!cf} onClick={() => setDialog({ type: 'ai' })} className="ai-btn">
        <Sparkles size={17} />
      </RailButton>
      <RailButton side="left" label={t('rr.search')} shortcut="Ctrl K" disabled={!cf} onClick={() => setPalette(true)}>
        <Search size={17} />
      </RailButton>
      <RailButton side="left" label={t('rr.cases')} onClick={() => setDialog({ type: 'cases' })}>
        <FolderOpen size={17} />
      </RailButton>
      <RailDivider />
      <RailButton side="left" label={t('rr.pdf')} disabled={!cf || busy} onClick={() => cf && run(() => exportPDF(cf, getNodes(), user.name))}>
        <FileText size={17} />
      </RailButton>
      <RailButton side="left" label={t('rr.png')} disabled={!cf || busy} onClick={() => cf && run(() => exportPNG(cf, getNodes(), user.name))}>
        <Image size={17} />
      </RailButton>
      <RailButton side="left" label={t('rr.jsonBackup')} disabled={!cf || busy} onClick={() => cf && run(() => exportJSON(cf))}>
        <FileJson size={17} />
      </RailButton>
      <RailButton side="left" label={t('rr.jsonImport')} onClick={() => fileRef.current?.click()}>
        <Upload size={17} />
      </RailButton>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try { await importCase(await readJSONFile(f)); notify(t('toast.imported')); } catch (err) { notify(t('toast.importFailed', { msg: (err as Error).message }), 'err'); }
      }} />

      <div className="rail-end">
        {/* Interface language: one click switches EN ↔ हिं (relation names follow; Urdu / Punjabi below stay available) */}
        <RailButton side="left" label={t('rr.uiLang')} onClick={() => setUiLang(uiLang === 'en' ? 'hi' : 'en')} className="ui-lang">
          <span className={uiLang === 'en' ? 'cur' : ''} lang="en">EN</span>
          <span className={uiLang === 'hi' ? 'cur' : ''} lang="hi">हिं</span>
        </RailButton>
        <RailDivider />
        {LANGS.map(([k, short, key]) => (
          <RailButton key={k} side="left" label={t(key)} active={lang === k} onClick={() => setLang(k)} className="rail-txt">
            {short}
          </RailButton>
        ))}
        <RailDivider />
        <RailButton side="left" label={theme === 'dark' ? t('rr.light') : t('rr.dark')} onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </RailButton>
      </div>
    </aside>
  );
}
