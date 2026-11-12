import { Fragment, createElement, type ReactNode } from 'react';
import { en } from './en';
import { hi } from './hi';

/** Language of the interface (buttons, dialogs, toasts). Separate from the relation-name language (`lang` in the store). */
export type UiLang = 'en' | 'hi';
export type TKey = keyof typeof en;
export type TVars = Record<string, string | number>;
export type T = (key: TKey, vars?: TVars) => string;

const DICTS: Record<UiLang, Record<TKey, string>> = { en, hi };

let current: UiLang = 'en';

export const isUiLang = (v: unknown): v is UiLang => v === 'en' || v === 'hi';

/** Called by the store whenever the UI language changes; also sets <html lang>. */
export function setRuntimeUiLang(l: UiLang): void {
  current = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

export const getUiLang = (): UiLang => current;

export function translate(lang: UiLang, key: TKey, vars?: TVars): string {
  const s = (DICTS[lang] ?? en)[key] ?? en[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** For non-React code (store toasts, engine errors): uses the current UI language. */
export const t: T = (key, vars) => translate(current, key, vars);

/** Like translate(), but placeholders may be React nodes (e.g. bold names). */
export function translateRich(lang: UiLang, key: TKey, vars: Record<string, ReactNode>): ReactNode {
  const parts = translate(lang, key).split(/\{(\w+)\}/);
  return parts.map((p, i) => createElement(Fragment, { key: i }, i % 2 ? (vars[p] ?? `{${p}}`) : p));
}

/** Pick the `hi` / `en` field of a label pair (ROLE_META, SOCIAL_TYPES, templates …). */
export const pick = (o: { hi: string; en: string }, lang: UiLang = current): string => (lang === 'hi' ? o.hi : o.en);

/** Label in the UI language; in Hindi also show the English term ("संदिग्ध · Suspect"). */
export const pickBoth = (o: { hi: string; en: string }, lang: UiLang = current): string =>
  lang === 'hi' ? `${o.hi} · ${o.en}` : o.en;

/** Pick the other language of a pair (shown small, as a hint). */
export const pickOther = (o: { hi: string; en: string }, lang: UiLang = current): string => (lang === 'hi' ? o.en : o.hi);

export const localeOf = (lang: UiLang = current): string => (lang === 'hi' ? 'hi-IN' : 'en-IN');
