import type { AiResult, AiStatus } from './types';
import { t } from '../i18n';

/**
 * Talks to the Evidence Board server's AI assistant. The Family Tree keeps its own sign-in
 * (per browser tab, like the Evidence Board), so its refresh-token chain never races the board's.
 */
const KEY = 'sft:server-auth';

interface Session {
  accessToken: string;
  refreshToken: string;
  user: { name: string; email: string };
}

export class AiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const base = () => {
  const c = (typeof window !== 'undefined' && (window as unknown as { SFT_CONFIG?: { aiBase?: string } }).SFT_CONFIG) || {};
  return (c.aiBase ?? '/api/v1').replace(/\/$/, '');
};

export const session = {
  get(): Session | null {
    try {
      const raw = sessionStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  },
  set(s: Session | null) {
    try {
      if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
      else sessionStorage.removeItem(KEY);
    } catch { /* storage blocked */ }
  },
};

async function raw<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${base()}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new AiError('NETWORK', t('err.network'), 0);
  }
  if (!res.ok) {
    let code = 'HTTP_ERROR';
    let message = `Server returned ${res.status}`;
    try {
      const j = await res.json();
      code = j?.error?.code ?? code;
      message = j?.error?.message ?? message;
      const first = Array.isArray(j?.error?.details) ? j.error.details[0] : null;
      if (first?.message) message = first.path ? `${first.path}: ${first.message}` : first.message;
    } catch { /* not JSON */ }
    throw new AiError(code, message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

let refreshing: Promise<boolean> | null = null;
function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    const s = session.get();
    if (!s) return false;
    try {
      const r = await raw<{ accessToken: string; refreshToken: string }>('POST', '/auth/refresh', { refreshToken: s.refreshToken });
      session.set({ ...s, accessToken: r.accessToken, refreshToken: r.refreshToken });
      return true;
    } catch (e) {
      if (e instanceof AiError && e.status === 401) session.set(null);
      return false;
    }
  })().finally(() => { refreshing = null; });
  return refreshing;
}

async function authed<T>(method: string, path: string, body?: unknown): Promise<T> {
  const s = session.get();
  if (!s) throw new AiError('SIGN_IN', t('ai.signInTitle'), 401);
  try {
    return await raw<T>(method, path, body, s.accessToken);
  } catch (e) {
    if (e instanceof AiError && e.status === 401 && (await refresh())) {
      return raw<T>(method, path, body, session.get()!.accessToken);
    }
    if (e instanceof AiError && e.status === 401) session.set(null);
    throw e;
  }
}

export async function signIn(email: string, password: string) {
  const r = await raw<Session>('POST', '/auth/login', { email, password });
  session.set({ accessToken: r.accessToken, refreshToken: r.refreshToken, user: { name: r.user.name, email: r.user.email } });
}

export async function signOut() {
  const s = session.get();
  session.set(null);
  if (s) await raw('POST', '/auth/logout', { refreshToken: s.refreshToken }).catch(() => undefined);
}

export const aiStatus = () => authed<AiStatus>('GET', '/ai/status');

export const aiCommand = (body: {
  mode: 'command' | 'extract';
  model: 'default' | 'lite';
  text: string;
  family: { persons: { id: string; name: string; gender?: string; role?: string; aliases?: string[] }[]; focusId?: string; selectedId?: string };
}) => authed<AiResult>('POST', '/ai/command', { app: 'family', ...body });
