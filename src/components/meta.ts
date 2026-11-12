import type { Confidence, Role, Status } from '../types';
import type { Side } from '../engine/relations';
import type { PrimitiveRel } from '../engine/ops';
import { translate, type TKey, type UiLang } from '../i18n';

export const ROLE_META: Record<Role, { hi: string; en: string; color: string }> = {
  suspect: { hi: 'संदिग्ध', en: 'Suspect', color: 'var(--role-suspect)' },
  accused: { hi: 'अभियुक्त', en: 'Accused', color: 'var(--role-accused)' },
  witness: { hi: 'गवाह', en: 'Witness', color: 'var(--role-witness)' },
  victim: { hi: 'पीड़ित', en: 'Victim', color: 'var(--role-victim)' },
  relative: { hi: 'रिश्तेदार', en: 'Relative', color: 'var(--role-relative)' },
  associate: { hi: 'सहयोगी', en: 'Associate', color: 'var(--role-associate)' },
  unknown: { hi: 'अज्ञात', en: 'Unknown', color: 'var(--role-relative)' },
};

export const STATUS_META: Record<Status, { hi: string; en: string }> = {
  alive: { hi: 'जीवित', en: 'Alive' },
  deceased: { hi: 'मृत', en: 'Deceased' },
  absconding: { hi: 'फ़रार', en: 'Absconding' },
  arrested: { hi: 'गिरफ़्तार', en: 'Arrested' },
  renounced: { hi: 'संन्यास / त्याग', en: 'Renounced' },
};

export const CONF_META: Record<Confidence, { hi: string; en: string }> = {
  confirmed: { hi: 'पक्का', en: 'Confirmed' },
  probable: { hi: 'संभावित', en: 'Probable' },
  suspected: { hi: 'शक', en: 'Suspected' },
};

export const SIDE_META: Record<Side, { hi: string; en: string }> = {
  self: { hi: 'Focus', en: 'Focus' },
  paternal: { hi: 'पितृ पक्ष', en: "Father's side" },
  maternal: { hi: 'मातृ पक्ष', en: "Mother's side" },
  core: { hi: 'अपना परिवार', en: 'Own family' },
  inlaw: { hi: 'ससुराल पक्ष', en: "Spouse's side" },
  associate: { hi: 'मित्र / सहयोगी', en: 'Friends & associates' },
  unlinked: { hi: 'जुड़े नहीं', en: 'Not linked' },
};

const PALETTE = ['#3a6ea5', '#2f7d74', '#6f58a8', '#a4623a', '#a34d73', '#5a7a3a', '#2f6f9a', '#8a7330'];

export function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{M}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = [...parts[0]][0] ?? '';
  const second = parts.length > 1 ? [...parts[parts.length - 1]][0] ?? '' : '';
  return (first + second).toUpperCase();
}

export function genLabel(g: number): string {
  return g === 0 ? 'G0' : g > 0 ? `G+${g}` : `G${g}`;
}

/** Row names of the generation lanes (tree view), in the UI language. */
export function genName(g: number, lang: UiLang): string {
  return g >= -3 && g <= 3 ? translate(lang, `gen.${g}` as TKey) : '';
}

/** "A is the <rel> of B" choices for linking two people directly. */
export const PRIM_META: { rel: PrimitiveRel; hi: string; en: string }[] = [
  { rel: 'father', hi: 'पिता', en: 'Father' },
  { rel: 'mother', hi: 'माता', en: 'Mother' },
  { rel: 'son', hi: 'बेटा', en: 'Son' },
  { rel: 'daughter', hi: 'बेटी', en: 'Daughter' },
  { rel: 'husband', hi: 'पति', en: 'Husband' },
  { rel: 'wife', hi: 'पत्नी', en: 'Wife' },
  { rel: 'brother', hi: 'भाई', en: 'Brother' },
  { rel: 'sister', hi: 'बहन', en: 'Sister' },
];

export function ageText(dob: string | undefined, approx: number | undefined, lang: UiLang): string {
  if (dob) {
    const y = parseInt(dob.slice(0, 4), 10);
    if (!Number.isNaN(y)) return translate(lang, 'common.yrs', { n: new Date().getFullYear() - y });
  }
  if (approx != null) return `~${translate(lang, 'common.yrs', { n: approx })}`;
  return '';
}
