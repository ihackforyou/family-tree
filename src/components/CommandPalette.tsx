import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { searchTemplates } from '../engine/templates';
import { computeRelations, relationLabel } from '../engine/relations';
import { Avatar } from './PersonNode';
import { matchPerson } from './PersonPicker';
import type { Person } from '../types';

interface Item {
  key: string;
  title: string;
  sub?: string;
  kind: string;
  person?: Person;
  run: () => void;
}

/**
 * Ctrl+K: find a person, or type a Hinglish command such as
 *   "Rahul का मामा जोड़ो", "add mama to Rahul", "Rahul और Vikas का रिश्ता", "network", "undo"
 */
export function CommandPalette() {
  const cf = useStore((s) => s.cf)!;
  const lang = useStore((s) => s.lang);
  const st = useStore.getState();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const close = () => st.setPalette(false);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const persons = Object.values(cf.persons);
    const find = (name: string) => persons.find((p) => matchPerson(p, name));
    const text = q.trim();

    // "<name> का <relation> जोड़ो" / "add <relation> to <name>"
    const m1 = text.match(/^(.+?)\s+(?:का|की|के|ka|ki|ke)\s+(.+?)\s+(?:जोड़ो|जोड़ें|jodo|joden|add)$/i);
    const m2 = text.match(/^add\s+(.+?)\s+(?:to|of|for)\s+(.+)$/i);
    const addCmd = m1 ? { who: m1[1], rel: m1[2] } : m2 ? { who: m2[2], rel: m2[1] } : null;
    if (addCmd) {
      const p = find(addCmd.who);
      const t = searchTemplates(addCmd.rel)[0];
      if (p && t) {
        out.push({
          key: 'cmd-add', kind: 'command', title: `${p.name} का ${t.hi} जोड़ें`, sub: t.en,
          run: () => { close(); st.setDialog({ type: 'add', anchorId: p.id, tplId: t.id }); },
        });
      }
    }
    // "<a> और <b> का रिश्ता"
    const m3 = text.match(/^(.+?)\s+(?:और|aur|and|&)\s+(.+?)(?:\s+(?:का|ka)\s+(?:रिश्ता|rishta|relation).*)?$/i);
    if (m3) {
      const a = find(m3[1]);
      const b = find(m3[2]);
      if (a && b && a.id !== b.id) {
        const lbl = relationLabel(computeRelations(cf, a.id).get(b.id), lang);
        out.push({
          key: 'cmd-path', kind: 'path', title: `${b.name}, ${a.name} के ${lbl}`, sub: 'Canvas पर रास्ता दिखाएँ',
          run: () => { close(); st.setPath(a.id, b.id); st.select(a.id); },
        });
      }
    }

    const actions: Item[] = [
      { key: 'a-tree', kind: 'view', title: 'Tree view', sub: 'पीढ़ी के हिसाब से', run: () => { st.setView('tree'); close(); } },
      { key: 'a-net', kind: 'view', title: 'Network view', sub: 'सबको एक साथ', run: () => { st.setView('network'); close(); } },
      { key: 'a-undo', kind: 'action', title: 'Undo', sub: 'Ctrl+Z', run: () => { st.undo(); close(); } },
      { key: 'a-redo', kind: 'action', title: 'Redo', sub: 'Ctrl+Shift+Z', run: () => { st.redo(); close(); } },
      { key: 'a-case', kind: 'action', title: 'केस बदलें / नया केस', run: () => { close(); st.setDialog({ type: 'cases' }); } },
      { key: 'a-pat', kind: 'lane', title: 'पितृ पक्ष छोटा / बड़ा करें', run: () => { st.toggleLane('paternal'); close(); } },
      { key: 'a-mat', kind: 'lane', title: 'मातृ पक्ष छोटा / बड़ा करें', run: () => { st.toggleLane('maternal'); close(); } },
      { key: 'a-inl', kind: 'lane', title: 'ससुराल पक्ष छोटा / बड़ा करें', run: () => { st.toggleLane('inlaw'); close(); } },
      { key: 'a-ass', kind: 'lane', title: 'सहयोगी छोटा / बड़ा करें', run: () => { st.toggleLane('associate'); close(); } },
      { key: 'a-clear', kind: 'action', title: 'Highlight हटाएँ', run: () => { st.setPath(null, null); close(); } },
      { key: 'a-theme', kind: 'action', title: 'Light / Dark theme', run: () => { st.toggleTheme(); close(); } },
    ];
    const lower = text.toLowerCase();
    const rel = cf.focusId ? computeRelations(cf, cf.focusId) : new Map();
    const people = persons
      .filter((p) => matchPerson(p, text))
      .slice(0, 12)
      .map<Item>((p) => ({
        key: p.id, kind: 'person', person: p, title: p.isGhost ? 'अज्ञात (ghost)' : p.name,
        sub: [relationLabel(rel.get(p.id), lang), p.mobiles[0], p.aliases[0]].filter(Boolean).join(' · '),
        run: () => { st.select(p.id); close(); },
      }));
    out.push(...people);
    out.push(...actions.filter((a) => !lower || a.title.toLowerCase().includes(lower) || a.sub?.toLowerCase().includes(lower)));
    return out.slice(0, 30);
  }, [q, cf, lang, st]);

  const go = (idx: number) => items[idx]?.run();

  return (
    <div className="overlay palette" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="dialog" role="dialog" aria-label="Command palette">
        <input
          className="palette-input"
          autoFocus
          placeholder='नाम / mobile खोजें, या लिखें: "Rahul का मामा जोड़ो", "Rahul और Vikas का रिश्ता"'
          value={q}
          onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
            else if (e.key === 'Enter') go(i);
          }}
        />
        <div className="palette-list">
          {items.map((it, idx) => (
            <div key={it.key} className={`palette-item ${idx === i ? 'on' : ''}`} onMouseEnter={() => setI(idx)} onClick={() => go(idx)}>
              {it.person && <Avatar person={it.person} size={28} />}
              <div style={{ minWidth: 0 }}>
                <div>{it.title}</div>
                {it.sub && <div className="sub">{it.sub}</div>}
              </div>
              <span className="kind">{it.kind}</span>
            </div>
          ))}
          {!items.length && <div className="muted" style={{ padding: 12 }}>कुछ नहीं मिला</div>}
        </div>
      </div>
    </div>
  );
}
