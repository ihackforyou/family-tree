import { create } from 'zustand';
import { toast } from 'sonner';
import type { CaseFile, Lang } from './types';
import type { Side } from './engine/relations';
import { draftOf } from './engine/ops';
import { createAdapter, getConfig, metaOf, type CaseMeta } from './storage';
import { demoCase, emptyCase } from './demo';
import { zenithDemoCase } from './demoZenith';
import { isUiLang, setRuntimeUiLang, t, type UiLang } from './i18n';

let cfg = getConfig();
let adapter = createAdapter(cfg);
const MAX_HISTORY = 100;

/** chart = compact family chart (couples + children); tree = generation × side lanes; network = radial. */
export type View = 'chart' | 'tree' | 'network' | 'table';
export type { CardSize } from './engine/chart';

export type Dialog =
  | { type: 'add'; anchorId: string; preset?: 'up' | 'down' | 'sibling' | 'spouse' | 'social'; tplId?: string }
  | { type: 'link'; aId: string; bId: string }
  | { type: 'cases' }
  | { type: 'newCase' }
  | { type: 'ai' }
  | null;

interface State {
  user: { id: string; name: string };
  cases: CaseMeta[];
  cf: CaseFile | null;
  past: CaseFile[];
  future: CaseFile[];
  /** Language of computed relation names (मामा / Mother's brother …). */
  lang: Lang;
  /** Language of the interface (buttons, dialogs, toasts). */
  uiLang: UiLang;
  view: View;
  theme: 'dark' | 'light';
  collapsed: Set<Side>;
  selectedId: string | null;
  pathFrom: string | null;
  pathTo: string | null;
  dialog: Dialog;
  palette: boolean;
  saving: boolean;
  roleFilter: Set<string>;
  ready: boolean;

  init(): Promise<void>;
  openCase(id: string): Promise<void>;
  newCase(title: string, firNo?: string): Promise<void>;
  /** basic = small family demo; zenith = ₹5 Cr fraud accused network (matches the Evidence Board demo). */
  loadDemo(kind?: 'basic' | 'zenith'): Promise<void>;
  deleteCase(id: string): Promise<void>;
  importCase(cf: CaseFile): Promise<void>;
  mutate(action: string, detail: string, fn: (d: CaseFile) => void): boolean;
  undo(): void;
  redo(): void;
  setFocus(id: string): void;
  select(id: string | null): void;
  setLang(l: Lang): void;
  /** Switch the interface language; relation names follow (Urdu / Punjabi can still be picked afterwards). */
  setUiLang(l: UiLang): void;
  setView(v: View): void;
  cardSize: import('./engine/chart').CardSize;
  toggleCardSize(): void;
  /** Save a card the user dragged (kept per view, not part of undo history). */
  moveCard(view: 'chart' | 'tree' | 'network', id: string, pos: { x: number; y: number }): void;
  resetLayout(view: 'chart' | 'tree' | 'network'): void;
  lineStyle: 'step' | 'curve' | 'straight';
  cycleLineStyle(): void;
  /** Show every line's label, or only those touching the selected person. */
  allLabels: boolean;
  toggleLabels(): void;
  toggleTheme(): void;
  toggleLane(s: Side): void;
  toggleRole(r: string): void;
  setDialog(d: Dialog): void;
  setPalette(v: boolean): void;
  setPath(from: string | null, to: string | null): void;
  /** Sonner toast; pass `action` for an inline button such as Undo. */
  notify(msg: string, kind?: 'ok' | 'err', action?: { label: string; onClick: () => void }): void;
  /** Side-panel tab; rails open a tab in one click. */
  panelTab: PanelTab;
  openPanel(id: string, tab: PanelTab): void;
  setPanelTab(t: PanelTab): void;
  minimap: boolean;
  legend: boolean;
  toggleMinimap(): void;
  toggleLegend(): void;
}

export type PanelTab = 'details' | 'relations' | 'path' | 'history';

let saveTimer: ReturnType<typeof setTimeout> | undefined;

function readPref<T extends string>(k: string, fallback: T): T {
  try { return (localStorage.getItem(`sft:${cfg.userId}:pref:${k}`) as T) || fallback; } catch { return fallback; }
}
function writePref(k: string, v: string) {
  try { localStorage.setItem(`sft:${cfg.userId}:pref:${k}`, v); } catch { /* ignore */ }
}

/** UI language and relation language from saved prefs. English by default; relation names follow the UI language until changed. */
function readLangs(): { uiLang: UiLang; lang: Lang } {
  const stored = readPref('uiLang', 'en');
  const uiLang: UiLang = isUiLang(stored) ? stored : 'en';
  setRuntimeUiLang(uiLang);
  return { uiLang, lang: readPref<Lang>('lang', uiLang) };
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
        get().notify(t('toast.saveFailed', { msg: (e as Error).message }), 'err');
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
    ...readLangs(),
    view: readPref<View>('view', 'chart'),
    cardSize: readPref<'normal' | 'compact'>('cardSize', 'compact'),
    theme: readPref<'dark' | 'light'>('theme', 'dark'),
    collapsed: new Set(),
    selectedId: null,
    pathFrom: null,
    pathTo: null,
    dialog: null,
    palette: false,
    saving: false,
    roleFilter: new Set(),
    ready: false,

    async init() {
      // the host page may set window.SFT_CONFIG (or call mount with a config) after this module loaded
      cfg = getConfig();
      adapter = createAdapter(cfg);
      set({ user: { id: cfg.userId, name: cfg.userName }, ...readLangs(), theme: readPref<'dark' | 'light'>('theme', 'dark') });
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
        get().notify(t('toast.loadFailed', { msg: (e as Error).message }), 'err');
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
      cf.audit.push({ ts: Date.now(), user: cfg.userName, action: 'case', detail: t('audit.newCase') });
      await adapter.saveCase(cf);
      set((s) => ({ cases: [metaOf(cf), ...s.cases], dialog: null }));
      openFile(cf);
    },

    async loadDemo(kind = 'basic') {
      const cf = kind === 'zenith' ? zenithDemoCase() : demoCase();
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
      if (!cf || typeof cf !== 'object' || !cf.persons || !cf.edges) throw new Error(t('err.notFamilyJson'));
      cf.audit = [...(cf.audit ?? []), { ts: Date.now(), user: cfg.userName, action: 'import', detail: t('audit.import') }];
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
    setUiLang(l) {
      writePref('uiLang', l);
      writePref('lang', l);
      setRuntimeUiLang(l);
      set({ uiLang: l, lang: l });
    },
    setView(v) { writePref('view', v); set({ view: v }); },
    moveCard(view, id, pos) {
      const cf = get().cf;
      if (!cf) return;
      const layout = { ...(cf.layout ?? {}) };
      layout[view] = { ...(layout[view] ?? {}), [id]: { x: Math.round(pos.x), y: Math.round(pos.y) } };
      const d = { ...cf, layout };
      set({ cf: d });
      persist(d);
    },
    resetLayout(view) {
      const cf = get().cf;
      if (!cf?.layout?.[view]) return;
      const layout = { ...cf.layout };
      delete layout[view];
      const d = { ...cf, layout };
      set({ cf: d });
      persist(d);
    },
    lineStyle: readPref<'step' | 'curve' | 'straight'>('lineStyle', 'step'),
    cycleLineStyle() {
      const order = ['step', 'curve', 'straight'] as const;
      const next = order[(order.indexOf(get().lineStyle) + 1) % order.length];
      writePref('lineStyle', next);
      set({ lineStyle: next });
    },
    allLabels: false,
    toggleLabels() { set({ allLabels: !get().allLabels }); },
    toggleCardSize() {
      const c = get().cardSize === 'compact' ? 'normal' : 'compact';
      writePref('cardSize', c);
      set({ cardSize: c });
    },
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
    notify(msg, kind = 'ok', action) {
      if (kind === 'err') toast.error(msg, { duration: 6000, action });
      else toast(msg, { action });
    },
    panelTab: 'details',
    openPanel(id, tab) { set({ selectedId: id, panelTab: tab }); },
    setPanelTab(t) { set({ panelTab: t }); },
    minimap: true,
    legend: false,
    toggleMinimap() { set({ minimap: !get().minimap }); },
    toggleLegend() { set({ legend: !get().legend }); },
  };
});

