import { create } from 'zustand';
import type { CaseFile, Lang } from './types';
import type { Side } from './engine/relations';
import { draftOf } from './engine/ops';
import { createAdapter, getConfig, metaOf, type CaseMeta } from './storage';
import { demoCase, emptyCase } from './demo';

let cfg = getConfig();
let adapter = createAdapter(cfg);
const MAX_HISTORY = 100;

export type View = 'tree' | 'network';

export type Dialog =
  | { type: 'add'; anchorId: string; preset?: 'up' | 'down' | 'sibling' | 'spouse' | 'social'; tplId?: string }
  | { type: 'link'; aId: string; bId: string }
  | { type: 'cases' }
  | { type: 'newCase' }
  | null;

interface State {
  user: { id: string; name: string };
  cases: CaseMeta[];
  cf: CaseFile | null;
  past: CaseFile[];
  future: CaseFile[];
  lang: Lang;
  view: View;
  theme: 'dark' | 'light';
  collapsed: Set<Side>;
  selectedId: string | null;
  pathFrom: string | null;
  pathTo: string | null;
  dialog: Dialog;
  palette: boolean;
  toast: { msg: string; kind: 'ok' | 'err' } | null;
  saving: boolean;
  roleFilter: Set<string>;
  ready: boolean;

  init(): Promise<void>;
  openCase(id: string): Promise<void>;
  newCase(title: string, firNo?: string): Promise<void>;
  loadDemo(): Promise<void>;
  deleteCase(id: string): Promise<void>;
  importCase(cf: CaseFile): Promise<void>;
  mutate(action: string, detail: string, fn: (d: CaseFile) => void): boolean;
  undo(): void;
  redo(): void;
  setFocus(id: string): void;
  select(id: string | null): void;
  setLang(l: Lang): void;
  setView(v: View): void;
  toggleTheme(): void;
  toggleLane(s: Side): void;
  toggleRole(r: string): void;
  setDialog(d: Dialog): void;
  setPalette(v: boolean): void;
  setPath(from: string | null, to: string | null): void;
  notify(msg: string, kind?: 'ok' | 'err'): void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

function readPref<T extends string>(k: string, fallback: T): T {
  try { return (localStorage.getItem(`sft:${cfg.userId}:pref:${k}`) as T) || fallback; } catch { return fallback; }
}
function writePref(k: string, v: string) {
  try { localStorage.setItem(`sft:${cfg.userId}:pref:${k}`, v); } catch { /* ignore */ }
}

export const useStore = create<State>((set, get) => {
  const persist = (cf: CaseFile) => {
    set({ saving: true });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await adapter.saveCase(cf);
        set((s) => ({ saving: false, cases: [metaOf(cf), ...s.cases.filter((c) => c.id !== cf.id)] }));
      } catch (e) {
        set({ saving: false });
        get().notify(`Save नहीं हुआ: ${(e as Error).message}`, 'err');
      }
    }, 400);
  };

  const openFile = (cf: CaseFile) => {
    set({ cf, past: [], future: [], selectedId: null, pathFrom: null, pathTo: null });
    writePref('lastCase', cf.id);
  };

  return {
    user: { id: cfg.userId, name: cfg.userName },
    cases: [],
    cf: null,
    past: [],
    future: [],
    lang: readPref<Lang>('lang', 'hi'),
    view: 'tree',
    theme: readPref<'dark' | 'light'>('theme', 'dark'),
    collapsed: new Set(),
    selectedId: null,
    pathFrom: null,
    pathTo: null,
    dialog: null,
    palette: false,
    toast: null,
    saving: false,
    roleFilter: new Set(),
    ready: false,

    async init() {
      // the host page may set window.SFT_CONFIG (or call mount with a config) after this module loaded
      cfg = getConfig();
      adapter = createAdapter(cfg);
      set({ user: { id: cfg.userId, name: cfg.userName }, lang: readPref<Lang>('lang', 'hi'), theme: readPref<'dark' | 'light'>('theme', 'dark') });
      try {
        const cases = await adapter.listCases();
        set({ cases });
        const last = readPref('lastCase', '');
        const pick = cases.find((c) => c.id === last) ?? cases[0];
        if (pick) {
          await get().openCase(pick.id);
        } else {
          await get().loadDemo();
        }
      } catch (e) {
        get().notify(`Data load नहीं हुआ: ${(e as Error).message}`, 'err');
      }
      set({ ready: true });
    },

    async openCase(id) {
      const cf = await adapter.loadCase(id);
      if (cf) openFile(cf);
      set({ dialog: null });
    },

    async newCase(title, firNo) {
      const cf = emptyCase(title, firNo);
      cf.audit.push({ ts: Date.now(), user: cfg.userName, action: 'case', detail: 'नया case बनाया' });
      await adapter.saveCase(cf);
      set((s) => ({ cases: [metaOf(cf), ...s.cases], dialog: null }));
      openFile(cf);
    },

    async loadDemo() {
      const cf = demoCase();
      await adapter.saveCase(cf);
      set((s) => ({ cases: [metaOf(cf), ...s.cases], dialog: null }));
      openFile(cf);
    },

    async deleteCase(id) {
      await adapter.deleteCase(id);
      const cases = get().cases.filter((c) => c.id !== id);
      set({ cases });
      if (get().cf?.id === id) {
        if (cases[0]) await get().openCase(cases[0].id);
        else set({ cf: null });
      }
    },

    async importCase(cf) {
      if (!cf || typeof cf !== 'object' || !cf.persons || !cf.edges) throw new Error('यह Family Tree JSON file नहीं है');
      cf.audit = [...(cf.audit ?? []), { ts: Date.now(), user: cfg.userName, action: 'import', detail: 'JSON से import' }];
      cf.updatedAt = Date.now();
      await adapter.saveCase(cf);
      set((s) => ({ cases: [metaOf(cf), ...s.cases.filter((c) => c.id !== cf.id)] }));
      openFile(cf);
    },

    mutate(action, detail, fn) {
      const cur = get().cf;
      if (!cur) return false;
      const d = draftOf(cur);
      try {
        fn(d);
      } catch (e) {
        get().notify((e as Error).message, 'err');
        return false;
      }
      d.updatedAt = Date.now();
      d.audit.push({ ts: d.updatedAt, user: cfg.userName, action, detail });
      if (d.focusId && !d.persons[d.focusId]) d.focusId = Object.keys(d.persons)[0];
      set((s) => ({ cf: d, past: [...s.past, cur].slice(-MAX_HISTORY), future: [] }));
      persist(d);
      return true;
    },

    undo() {
      const { past, cf } = get();
      if (!past.length || !cf) return;
      const prev = past[past.length - 1];
      set((s) => ({ cf: prev, past: s.past.slice(0, -1), future: [cf, ...s.future] }));
      persist(prev);
    },

    redo() {
      const { future, cf } = get();
      if (!future.length || !cf) return;
      const next = future[0];
      set((s) => ({ cf: next, future: s.future.slice(1), past: [...s.past, cf] }));
      persist(next);
    },

    setFocus(id) {
      const cf = get().cf;
      if (!cf || !cf.persons[id]) return;
      const d = { ...cf, focusId: id };
      set({ cf: d });
      persist(d);
    },
    select(id) { set({ selectedId: id }); },
    setLang(l) { writePref('lang', l); set({ lang: l }); },
    setView(v) { set({ view: v }); },
    toggleTheme() {
      const t = get().theme === 'dark' ? 'light' : 'dark';
      writePref('theme', t);
      set({ theme: t });
    },
    toggleLane(side) {
      const c = new Set(get().collapsed);
      if (c.has(side)) c.delete(side);
      else c.add(side);
      set({ collapsed: c });
    },
    toggleRole(r) {
      const c = new Set(get().roleFilter);
      if (c.has(r)) c.delete(r);
      else c.add(r);
      set({ roleFilter: c });
    },
    setDialog(d) { set({ dialog: d }); },
    setPalette(v) { set({ palette: v }); },
    setPath(from, to) { set({ pathFrom: from, pathTo: to }); },
    notify(msg, kind = 'ok') {
      set({ toast: { msg, kind } });
      setTimeout(() => { if (get().toast?.msg === msg) set({ toast: null }); }, 3500);
    },
  };
});

