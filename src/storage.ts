import type { CaseFile } from './types';

/**
 * Host configuration.
 *
 * The app runs on its own (data in this browser, per user) or inside the
 * Investigation Camp PHP site. The PHP page sets `window.SFT_CONFIG` before
 * loading the bundle:
 *
 *   <script>
 *     window.SFT_CONFIG = {
 *       userId: "<?= $user['id'] ?>",
 *       userName: "<?= htmlspecialchars($user['name']) ?>",
 *       apiBase: "/api/family-tree",          // optional: store on the server
 *       token: "<?= $jwt ?>"                  // optional: sent as Bearer token
 *     };
 *   </script>
 *
 * Every user only ever sees their own cases: the local store is keyed by
 * userId and the server API is expected to scope by the logged-in user.
 */
export interface HostConfig {
  userId: string;
  userName: string;
  apiBase?: string;
  token?: string;
  getToken?: () => string | Promise<string>;
  /** Called when the API answers 401, e.g. to redirect to the PHP login page. */
  onUnauthorized?: () => void;
}

declare global {
  interface Window {
    SFT_CONFIG?: Partial<HostConfig>;
  }
}

export function getConfig(): HostConfig {
  const c = (typeof window !== 'undefined' && window.SFT_CONFIG) || {};
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  return {
    userId: c.userId || params.get('user') || 'local-user',
    userName: c.userName || params.get('name') || 'Investigator',
    apiBase: c.apiBase,
    token: c.token,
    getToken: c.getToken,
    onUnauthorized: c.onUnauthorized,
  };
}

export interface CaseMeta {
  id: string;
  title: string;
  firNo?: string;
  updatedAt: number;
  personCount: number;
}

export interface StorageAdapter {
  listCases(): Promise<CaseMeta[]>;
  loadCase(id: string): Promise<CaseFile | null>;
  saveCase(cf: CaseFile): Promise<void>;
  deleteCase(id: string): Promise<void>;
}

export function metaOf(cf: CaseFile): CaseMeta {
  return { id: cf.id, title: cf.title, firNo: cf.firNo, updatedAt: cf.updatedAt, personCount: Object.keys(cf.persons).length };
}

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, val: string) {
  try { localStorage.setItem(key, val); } catch { /* storage full or blocked */ }
}
function safeDel(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/** Browser storage, one namespace per user. */
export class LocalAdapter implements StorageAdapter {
  private prefix: string;
  constructor(userId: string) {
    this.prefix = `sft:${userId}:`;
  }
  private readIndex(): CaseMeta[] {
    try { return JSON.parse(safeGet(this.prefix + 'index') || '[]'); } catch { return []; }
  }
  async listCases() {
    return this.readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async loadCase(id: string) {
    const raw = safeGet(this.prefix + 'case:' + id);
    if (!raw) return null;
    try { return JSON.parse(raw) as CaseFile; } catch { return null; }
  }
  async saveCase(cf: CaseFile) {
    safeSet(this.prefix + 'case:' + cf.id, JSON.stringify(cf));
    const idx = this.readIndex().filter((m) => m.id !== cf.id);
    idx.push(metaOf(cf));
    safeSet(this.prefix + 'index', JSON.stringify(idx));
  }
  async deleteCase(id: string) {
    safeDel(this.prefix + 'case:' + id);
    safeSet(this.prefix + 'index', JSON.stringify(this.readIndex().filter((m) => m.id !== id)));
  }
}

/**
 * Server storage for the PHP backend. Endpoints (all scoped to the logged-in user):
 *   GET    {apiBase}/cases          -> CaseMeta[]
 *   GET    {apiBase}/cases/{id}     -> CaseFile
 *   PUT    {apiBase}/cases/{id}     <- CaseFile
 *   DELETE {apiBase}/cases/{id}
 * Cookies are sent (PHP session) and, if configured, an Authorization: Bearer header.
 */
export class ApiAdapter implements StorageAdapter {
  private cfg: HostConfig;
  constructor(cfg: HostConfig) {
    this.cfg = cfg;
  }
  private async req(path: string, init: RequestInit = {}) {
    const token = this.cfg.getToken ? await this.cfg.getToken() : this.cfg.token;
    const res = await fetch(this.cfg.apiBase!.replace(/\/$/, '') + path, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });
    if (res.status === 401) {
      this.cfg.onUnauthorized?.();
      throw new Error('Login ज़रूरी है (401)');
    }
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    return res.status === 204 ? null : res.json();
  }
  async listCases() { return (await this.req('/cases')) as CaseMeta[]; }
  async loadCase(id: string) { return (await this.req(`/cases/${encodeURIComponent(id)}`)) as CaseFile; }
  async saveCase(cf: CaseFile) { await this.req(`/cases/${encodeURIComponent(cf.id)}`, { method: 'PUT', body: JSON.stringify(cf) }); }
  async deleteCase(id: string) { await this.req(`/cases/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
}

export function createAdapter(cfg: HostConfig): StorageAdapter {
  return cfg.apiBase ? new ApiAdapter(cfg) : new LocalAdapter(cfg.userId);
}
