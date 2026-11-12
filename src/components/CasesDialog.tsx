import { useState } from 'react';
import { Modal } from './ui/Modal';
import { confirmDialog } from './ui/Confirm';
import { FolderOpen, Sparkles, Trash2, X } from 'lucide-react';
import { useStore } from '../store';
import { localeOf } from '../i18n';
import { useT, useUiLang } from '../i18n/useT';

export function CasesDialog() {
  const cases = useStore((s) => s.cases);
  const cf = useStore((s) => s.cf);
  const user = useStore((s) => s.user);
  const t = useT();
  const ui = useUiLang();
  const { openCase, newCase, deleteCase, loadDemo, setDialog } = useStore.getState();
  const [title, setTitle] = useState('');
  const [fir, setFir] = useState('');

  return (
    <Modal onClose={() => setDialog(null)} label={t('cases.title')} closable={!!cf}>
      <div style={{ display: 'contents' }}>
        <div className="dialog-head">
          <h3>{t('cases.title')}</h3>
          <span className="muted">{t('cases.onlyYours', { name: user.name })}</span>
          {cf && <button className="btn ghost icon-btn" style={{ marginLeft: 'auto' }} aria-label={t('common.close')} onClick={() => setDialog(null)}><X size={16} /></button>}
        </div>
        <div className="dialog-body">
          <div className="section-title">{t('cases.new')}</div>
          <div className="grid2">
            <input className="input" placeholder={t('cases.namePh')} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <input className="input" placeholder={t('cases.firPh')} value={fir} onChange={(e) => setFir(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" disabled={!title.trim()} onClick={() => newCase(title.trim(), fir.trim() || undefined)}>{t('cases.create')}</button>
            <button className="btn" onClick={() => loadDemo('zenith')} title={t('cases.zenithTip')}><Sparkles size={14} /> {t('cases.zenith')}</button>
            <button className="btn" onClick={() => loadDemo('basic')}><Sparkles size={14} /> {t('cases.basic')}</button>
          </div>
          <div className="section-title">{t('cases.saved')}</div>
          <div className="case-list">
            {cases.map((c) => (
              <div key={c.id} className={`case-item ${cf?.id === c.id ? 'on' : ''}`} onClick={() => openCase(c.id)}>
                <FolderOpen size={16} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t">{c.title}</div>
                  <div className="muted">{c.firNo ? `FIR ${c.firNo} · ` : ''}{t('common.people', { n: c.personCount })} · {new Date(c.updatedAt).toLocaleDateString(localeOf(ui))}</div>
                </div>
                <button className="btn ghost icon-btn" title={t('cases.deleteTip')} aria-label={t('cases.deleteTip')} onClick={(e) => {
                  e.stopPropagation();
                  void confirmDialog({
                    title: t('cases.confirmTitle', { title: c.title }),
                    description: t('cases.confirmBody', { n: c.personCount }),
                    confirmLabel: t('cases.deleteTip'),
                  }).then((ok) => { if (ok) void deleteCase(c.id); });
                }}><Trash2 size={14} /></button>
              </div>
            ))}
            {!cases.length && <div className="muted">{t('cases.none')}</div>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
