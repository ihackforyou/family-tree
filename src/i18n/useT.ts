import { useMemo, type ReactNode } from 'react';
import { useStore } from '../store';
import { translate, translateRich, type T, type TKey, type UiLang } from './index';

/** Current UI language; components re-render when it changes. */
export const useUiLang = (): UiLang => useStore((s) => s.uiLang);

/** Translator bound to the current UI language. */
export function useT(): T {
  const lang = useUiLang();
  return useMemo<T>(() => (key, vars) => translate(lang, key, vars), [lang]);
}

/** Translator whose placeholders can be React nodes. */
export function useTRich() {
  const lang = useUiLang();
  return useMemo(() => (key: TKey, vars: Record<string, ReactNode>) => translateRich(lang, key, vars), [lang]);
}
