import { useState } from 'react';
import { FolderOpen, Sparkles, Trash2, X } from 'lucide-react';
import { useStore } from '../store';

export function CasesDialog() {
  const cases = useStore((s) => s.cases);
  const cf = useStore((s) => s.cf);
  const user = useStore((s) => s.user);
  const { openCase, newCase, deleteCase, loadDemo, setDialog } = useStore.getState();
  const [title, setTitle] = useState('');
  const [fir, setFir] = useState('');

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && cf && setDialog(null)}>
      <div className="dialog" role="dialog" onKeyDown={(e) => e.key === 'Escape' && cf && setDialog(null)}>
        <div className="dialog-head">
          <h3>मेरे केस</h3>
          <span className="muted">({user.name} — सिर्फ़ आपके केस दिखते हैं)</span>
          {cf && <button className="btn ghost icon-btn" style={{ marginLeft: 'auto' }} onClick={() => setDialog(null)}><X size={16} /></button>}
        </div>
        <div className="dialog-body">
          <div className="section-title">नया केस</div>
          <div className="grid2">
            <input className="input" placeholder="केस का नाम *" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <input className="input" placeholder="FIR नंबर" value={fir} onChange={(e) => setFir(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary" disabled={!title.trim()} onClick={() => newCase(title.trim(), fir.trim() || undefined)}>केस बनाएँ</button>
            <button className="btn" onClick={() => loadDemo()}><Sparkles size={14} /> Demo केस खोलें</button>
          </div>
          <div className="section-title">पुराने केस</div>
          <div className="case-list">
            {cases.map((c) => (
              <div key={c.id} className={`case-item ${cf?.id === c.id ? 'on' : ''}`} onClick={() => openCase(c.id)}>
                <FolderOpen size={16} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t">{c.title}</div>
                  <div className="muted">{c.firNo ? `FIR ${c.firNo} · ` : ''}{c.personCount} व्यक्ति · {new Date(c.updatedAt).toLocaleDateString('hi-IN')}</div>
                </div>
                <button className="btn ghost icon-btn" title="केस हटाएँ" onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`"${c.title}" हमेशा के लिए हटाएँ?`)) deleteCase(c.id);
                }}><Trash2 size={14} /></button>
              </div>
            ))}
            {!cases.length && <div className="muted">अभी कोई केस नहीं</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
