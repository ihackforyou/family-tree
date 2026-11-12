import { useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { Modal } from './ui/Modal';
import { useStore } from '../store';
import { searchTemplates } from '../engine/templates';
import { computeRelations, relationLabel } from '../engine/relations';
import { Avatar } from './PersonNode';
import { matchPerson } from './PersonPicker';
import type { Person } from '../types';
import { SIDE_META } from './meta';
import { pick, pickOther, type TKey } from '../i18n';
import { useT, useUiLang } from '../i18n/useT';

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
  const t = useT();
  const ui = useUiLang();
  const st = useStore.getState();
  const [q, setQ] = useState('');
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
      const tpl = searchTemplates(addCmd.rel)[0];
      if (p && tpl) {
        out.push({
          key: 'cmd-add', kind: 'command', title: t('cmd.add', { name: p.name, rel: pick(tpl, ui) }), sub: pickOther(tpl, ui),
          run: () => { close(); st.setDialog({ type: 'add', anchorId: p.id, tplId: tpl.id }); },
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
          key: 'cmd-path', kind: 'path', title: t('cmd.path', { a: a.name, b: b.name, rel: lbl }), sub: t('cmd.pathSub'),
          run: () => { close(); st.setPath(a.id, b.id); st.select(a.id); },
        });
      }
    }

    const actions: Item[] = [
      { key: 'a-tree', kind: 'view', title: t('cmd.tree'), sub: t('cmd.treeSub'), run: () => { st.setView('tree'); close(); } },
      { key: 'a-net', kind: 'view', title: t('cmd.network'), sub: t('cmd.networkSub'), run: () => { st.setView('network'); close(); } },
      { key: 'a-undo', kind: 'action', title: 'Undo', sub: 'Ctrl+Z', run: () => { st.undo(); close(); } },
      { key: 'a-redo', kind: 'action', title: 'Redo', sub: 'Ctrl+Shift+Z', run: () => { st.redo(); close(); } },
      { key: 'a-case', kind: 'action', title: t('cmd.cases'), run: () => { close(); st.setDialog({ type: 'cases' }); } },
      ...(['paternal', 'maternal', 'inlaw', 'associate'] as const).map<Item>((side) => ({
        key: `a-lane-${side}`, kind: 'lane', title: t('cmd.lane', { side: pick(SIDE_META[side], ui) }),
        run: () => { st.toggleLane(side); close(); },
      })),
      { key: 'a-clear', kind: 'action', title: t('path.clear'), run: () => { st.setPath(null, null); close(); } },
      { key: 'a-theme', kind: 'action', title: t('cmd.theme'), run: () => { st.toggleTheme(); close(); } },
    ];
    const lower = text.toLowerCase();
    const rel = cf.focusId ? computeRelations(cf, cf.focusId) : new Map();
    const people = persons
      .filter((p) => matchPerson(p, text))
      .slice(0, 12)
      .map<Item>((p) => ({
        key: p.id, kind: 'person', person: p, title: p.isGhost ? t('common.unknownGhost') : p.name,
        sub: [relationLabel(rel.get(p.id), lang), p.mobiles[0], p.aliases[0]].filter(Boolean).join(' · '),
        run: () => { st.select(p.id); close(); },
      }));
    out.push(...people);
    out.push(...actions.filter((a) => !lower || a.title.toLowerCase().includes(lower) || a.sub?.toLowerCase().includes(lower)));
    return out.slice(0, 30);
  }, [q, cf, lang, st, t, ui]);

  const people = items.filter((it) => it.kind === 'person');
  const rest = items.filter((it) => it.kind !== 'person');
  const row = (it: Item) => (
    <Command.Item key={it.key} value={it.key} onSelect={it.run} className="palette-item">
      {it.person && <Avatar person={it.person} size={28} />}
      <div style={{ minWidth: 0 }}>
        <div>{it.title}</div>
        {it.sub && <div className="sub">{it.sub}</div>}
      </div>
      <span className="kind">{t(`kind.${it.kind}` as TKey)}</span>
    </Command.Item>
  );

  // cmdk handles ↑ ↓ Enter, looping and scroll-into-view; Base UI handles Esc, focus and outside click.
  return (
    <Modal onClose={close} label={t('rr.search')} instant className="palette">
      <Command shouldFilter={false} loop label={t('rr.search')}>
        <Command.Input
          className="palette-input"
          autoFocus
          placeholder={t('cmd.ph')}
          value={q}
          onValueChange={setQ}
        />
        <Command.List className="palette-list">
          <Command.Empty className="palette-empty">{t('cmd.empty')}</Command.Empty>
          {rest.filter((it) => it.kind === 'command' || it.kind === 'path').map(row)}
          {people.length > 0 && <Command.Group heading={t('cmd.people')}>{people.map(row)}</Command.Group>}
          {rest.some((it) => it.kind !== 'command' && it.kind !== 'path') && (
            <Command.Group heading={t('cmd.actions')}>{rest.filter((it) => it.kind !== 'command' && it.kind !== 'path').map(row)}</Command.Group>
          )}
        </Command.List>
        <div className="palette-foot"><span><span className="kbd">↑↓</span> {t('cmd.kbdSelect')}</span><span><span className="kbd">Enter</span> {t('cmd.kbdOpen')}</span><span><span className="kbd">Esc</span> {t('cmd.kbdClose')}</span></div>
      </Command>
    </Modal>
  );
}
