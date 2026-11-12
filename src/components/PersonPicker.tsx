import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Avatar } from './PersonNode';
import { ROLE_META } from './meta';
import type { Person } from '../types';
import { skeleton } from '../engine/translit';
import { pick } from '../i18n';
import { useT, useUiLang } from '../i18n/useT';

export function matchPerson(p: Person, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  const digits = n.replace(/\D/g, '');
  const sk = /[a-z]/.test(n) ? skeleton(n) : '';
  return (
    p.name.toLowerCase().includes(n) ||
    (sk.length >= 2 && [p.name, ...p.aliases].some((x) => skeleton(x).includes(sk))) ||
    p.aliases.some((a) => a.toLowerCase().includes(n)) ||
    p.firs.some((f) => f.toLowerCase().includes(n)) ||
    (digits.length >= 3 && p.mobiles.some((m) => m.replace(/\D/g, '').includes(digits))) ||
    (!!p.aadhaarLast4 && digits.length === 4 && p.aadhaarLast4 === digits)
  );
}

export function PersonPicker({ value, onChange, exclude = [] }: { value: string; onChange: (id: string) => void; exclude?: string[] }) {
  const cf = useStore((s) => s.cf)!;
  const [q, setQ] = useState('');
  const t = useT();
  const ui = useUiLang();
  const list = useMemo(
    () => Object.values(cf.persons).filter((p) => !exclude.includes(p.id) && matchPerson(p, q)).slice(0, 40),
    [cf.persons, q, exclude],
  );
  return (
    <div className="field">
      <input className="input" autoFocus placeholder={t('picker.ph')} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="case-list" style={{ maxHeight: 200, overflowY: 'auto', marginTop: 6 }}>
        {list.map((p) => (
          <div key={p.id} className={`rel-row ${value === p.id ? 'case-item on' : ''}`} onClick={() => onChange(p.id)}>
            <Avatar person={p} size={30} />
            <div style={{ minWidth: 0 }}>
              <div className="nm">{p.isGhost ? t('common.unknownGhost') : p.name}</div>
              <div className="lb">{pick(ROLE_META[p.role], ui)}{p.mobiles[0] ? ` · ${p.mobiles[0]}` : ''}{p.firs[0] ? ` · FIR ${p.firs[0]}` : ''}</div>
            </div>
          </div>
        ))}
        {!list.length && <div className="muted">{t('picker.none')}</div>}
      </div>
    </div>
  );
}
