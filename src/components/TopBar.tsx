import { ChevronDown, GitFork } from 'lucide-react';
import { useStore } from '../store';
import { useT } from '../i18n/useT';

/** Slim title bar. All tools live in the left / right rails and the bottom bar. */
export function TopBar() {
  const cf = useStore((s) => s.cf);
  const setDialog = useStore((s) => s.setDialog);
  const t = useT();
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><GitFork size={14} /></div>
        <div className="brand-title">Family Tree</div>
      </div>
      {cf && (
        <button className="case-btn" onClick={() => setDialog({ type: 'cases' })} title={t('top.switchCase')}>
          <span className="t">{cf.title}</span>
          {cf.firNo && <span className="s">FIR {cf.firNo}</span>}
          <ChevronDown size={13} style={{ color: 'var(--text-faint)', alignSelf: 'center' }} />
        </button>
      )}
    </header>
  );
}
