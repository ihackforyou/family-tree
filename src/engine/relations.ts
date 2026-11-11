import type { CaseFile, Edge, Gender, Lang, Person, SocialType } from '../types';
import { lookupLabel } from './labels';
import { socialLabel } from './social';

/**
 * Relation engine.
 *
 * Only primitive edges are stored (parent, spouse, explicit sibling, social).
 * Every named relation (चाचा, मामा, साढ़ू, ननदोई ...) is computed here from the
 * shortest path between the focus person and the target, so the same data can be
 * viewed from anyone's point of view and inverse relations come for free.
 */

export type StepKind = 'up' | 'down' | 'spouse' | 'sibling' | 'social';

export interface Step {
  kind: StepKind;
  from: string;
  to: string;
  /** F M B Z S D H W, or P / C / G / X when gender is unknown, or "A" for associates. */
  letter: string;
  seniority?: 'e' | 'y';
  half?: boolean;
  socialType?: SocialType;
  edgeId?: string;
}

export type Side = 'self' | 'paternal' | 'maternal' | 'core' | 'inlaw' | 'associate' | 'unlinked';

export interface RelationInfo {
  personId: string;
  steps: Step[];
  generation: number;
  side: Side;
  /** e.g. "F.eB" */
  code: string;
  /** true when the path goes only through family edges */
  kinship: boolean;
}

interface Neighbour {
  id: string;
  kind: StepKind;
  edgeId?: string;
  half?: boolean;
  socialType?: SocialType;
}

export interface GraphIndex {
  parents: Map<string, { id: string; edgeId: string }[]>;
  children: Map<string, { id: string; edgeId: string }[]>;
  spouses: Map<string, { id: string; edgeId: string }[]>;
  siblings: Map<string, { id: string; edgeId: string }[]>;
  social: Map<string, { id: string; edgeId: string; type?: SocialType }[]>;
}

function push<T>(m: Map<string, T[]>, k: string, v: T) {
  const a = m.get(k);
  if (a) a.push(v);
  else m.set(k, [v]);
}

export function buildIndex(edges: Edge[]): GraphIndex {
  const idx: GraphIndex = {
    parents: new Map(), children: new Map(), spouses: new Map(), siblings: new Map(), social: new Map(),
  };
  for (const e of edges) {
    if (e.from === e.to) continue;
    switch (e.kind) {
      case 'parent':
        push(idx.parents, e.to, { id: e.from, edgeId: e.id });
        push(idx.children, e.from, { id: e.to, edgeId: e.id });
        break;
      case 'spouse':
        push(idx.spouses, e.from, { id: e.to, edgeId: e.id });
        push(idx.spouses, e.to, { id: e.from, edgeId: e.id });
        break;
      case 'sibling':
        push(idx.siblings, e.from, { id: e.to, edgeId: e.id });
        push(idx.siblings, e.to, { id: e.from, edgeId: e.id });
        break;
      case 'social':
        push(idx.social, e.from, { id: e.to, edgeId: e.id, type: e.subtype as SocialType });
        push(idx.social, e.to, { id: e.from, edgeId: e.id, type: e.subtype as SocialType });
        break;
    }
  }
  return idx;
}

/** Siblings = other children of my parents (derived) + explicit sibling edges. */
export function siblingsOf(idx: GraphIndex, id: string): { id: string; half: boolean; edgeId?: string }[] {
  const myParents = new Set((idx.parents.get(id) ?? []).map((p) => p.id));
  const out = new Map<string, { id: string; half: boolean; edgeId?: string }>();
  for (const p of myParents) {
    for (const c of idx.children.get(p) ?? []) {
      if (c.id === id || out.has(c.id)) continue;
      const theirParents = new Set((idx.parents.get(c.id) ?? []).map((x) => x.id));
      const shared = [...myParents].filter((x) => theirParents.has(x)).length;
      const half = shared < Math.max(myParents.size, theirParents.size);
      out.set(c.id, { id: c.id, half });
    }
  }
  for (const s of idx.siblings.get(id) ?? []) {
    if (!out.has(s.id)) out.set(s.id, { id: s.id, half: false, edgeId: s.edgeId });
  }
  return [...out.values()];
}

function kinNeighbours(idx: GraphIndex, id: string): Neighbour[] {
  const n: Neighbour[] = [];
  for (const p of idx.parents.get(id) ?? []) n.push({ id: p.id, kind: 'up', edgeId: p.edgeId });
  for (const s of siblingsOf(idx, id)) n.push({ id: s.id, kind: 'sibling', half: s.half, edgeId: s.edgeId });
  for (const s of idx.spouses.get(id) ?? []) n.push({ id: s.id, kind: 'spouse', edgeId: s.edgeId });
  for (const c of idx.children.get(id) ?? []) n.push({ id: c.id, kind: 'down', edgeId: c.edgeId });
  return n;
}

function yearOf(p: Person): number | undefined {
  if (p.dob) {
    const y = parseInt(p.dob.slice(0, 4), 10);
    if (!Number.isNaN(y)) {
      // keep month/day precision when available
      const t = Date.parse(p.dob.length > 4 ? p.dob : `${p.dob}-07-01`);
      return Number.isNaN(t) ? y : t / (365.25 * 864e5) + 1970;
    }
  }
  if (p.approxAge != null) return new Date().getFullYear() - p.approxAge;
  return undefined;
}

/** Is b elder than a? undefined when unknown. */
export function isElder(a: Person, b: Person): boolean | undefined {
  const ya = yearOf(a);
  const yb = yearOf(b);
  if (ya != null && yb != null && ya !== yb) return yb < ya;
  if (b.seniority?.ref === a.id) return b.seniority.elder;
  if (a.seniority?.ref === b.id) return !a.seniority.elder;
  return undefined;
}

function letterFor(kind: StepKind, g: Gender): string {
  const male = g === 'male';
  const female = g === 'female';
  switch (kind) {
    case 'up': return male ? 'F' : female ? 'M' : 'P';
    case 'down': return male ? 'S' : female ? 'D' : 'C';
    case 'spouse': return male ? 'H' : female ? 'W' : 'X';
    case 'sibling': return male ? 'B' : female ? 'Z' : 'G';
    case 'social': return 'A';
  }
}

function makeStep(persons: Record<string, Person>, from: string, nb: Neighbour): Step {
  const to = persons[nb.id];
  const step: Step = { kind: nb.kind, from, to: nb.id, letter: letterFor(nb.kind, to?.gender ?? 'unknown'), edgeId: nb.edgeId };
  if (nb.kind === 'sibling') {
    step.half = nb.half;
    const a = persons[from];
    if (a && to) {
      const elder = isElder(a, to);
      if (elder != null) step.seniority = elder ? 'e' : 'y';
    }
  }
  if (nb.kind === 'social') step.socialType = nb.socialType;
  return step;
}

export function codeOf(steps: Step[]): string {
  return steps.map((s) => (s.seniority ?? '') + s.letter).join('.');
}

function sideOf(steps: Step[]): Side {
  if (steps.length === 0) return 'self';
  if (steps.some((s) => s.kind === 'social')) return 'associate';
  const first = steps[0];
  switch (first.kind) {
    case 'up': return first.letter === 'M' ? 'maternal' : 'paternal';
    case 'spouse': return 'inlaw';
    default: return 'core';
  }
}

function generationOf(steps: Step[]): number {
  let g = 0;
  for (const s of steps) {
    if (s.kind === 'up') g += 1;
    else if (s.kind === 'down') g -= 1;
  }
  return g;
}

/**
 * Shortest-path relations from `focusId` to everybody in the case.
 * Family paths always win over paths that go through a friend / associate.
 */
export function computeRelations(cf: Pick<CaseFile, 'persons' | 'edges'>, focusId: string): Map<string, RelationInfo> {
  const persons = cf.persons;
  const idx = buildIndex(Object.values(cf.edges));
  const result = new Map<string, RelationInfo>();
  if (!persons[focusId]) return result;

  const prev = new Map<string, Step[]>();
  prev.set(focusId, []);
  const order: string[] = [focusId];

  // Phase 1: family only
  const q: string[] = [focusId];
  while (q.length) {
    const cur = q.shift()!;
    const path = prev.get(cur)!;
    for (const nb of kinNeighbours(idx, cur)) {
      if (prev.has(nb.id) || !persons[nb.id]) continue;
      prev.set(nb.id, [...path, makeStep(persons, cur, nb)]);
      order.push(nb.id);
      q.push(nb.id);
    }
  }

  // Phase 2: allow associate (social) edges, starting from everyone already reached
  const q2 = [...order];
  while (q2.length) {
    const cur = q2.shift()!;
    const path = prev.get(cur)!;
    const nbs: Neighbour[] = [
      ...(idx.social.get(cur) ?? []).map((s) => ({ id: s.id, kind: 'social' as const, edgeId: s.edgeId, socialType: s.type })),
      ...kinNeighbours(idx, cur),
    ];
    for (const nb of nbs) {
      if (prev.has(nb.id) || !persons[nb.id]) continue;
      prev.set(nb.id, [...path, makeStep(persons, cur, nb)]);
      q2.push(nb.id);
    }
  }

  for (const [id, steps] of prev) {
    result.set(id, {
      personId: id,
      steps,
      generation: generationOf(steps),
      side: sideOf(steps),
      code: codeOf(steps),
      kinship: !steps.some((s) => s.kind === 'social'),
    });
  }
  for (const id of Object.keys(persons)) {
    if (!result.has(id)) {
      result.set(id, { personId: id, steps: [], generation: 0, side: 'unlinked', code: '', kinship: false });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Labels

const NOUN_HI: Record<string, [string, 'm' | 'f']> = {
  F: ['पिता', 'm'], M: ['माता', 'f'], B: ['भाई', 'm'], Z: ['बहन', 'f'], S: ['बेटा', 'm'], D: ['बेटी', 'f'],
  H: ['पति', 'm'], W: ['पत्नी', 'f'], P: ['माता-पिता', 'm'], C: ['संतान', 'f'], G: ['भाई-बहन', 'm'], X: ['जीवनसाथी', 'm'],
};
const NOUN_EN: Record<string, string> = {
  F: 'father', M: 'mother', B: 'brother', Z: 'sister', S: 'son', D: 'daughter', H: 'husband', W: 'wife',
  P: 'parent', C: 'child', G: 'sibling', X: 'spouse',
};

function stepNoun(step: Step, lang: Lang): { word: string; fem: boolean } {
  if (step.kind === 'social') {
    const w = socialLabel(step.socialType ?? 'other', lang === 'hi' ? 'hi' : 'en');
    return { word: w, fem: false };
  }
  if (lang === 'hi') {
    const [w, g] = NOUN_HI[step.letter] ?? ['?', 'm'];
    return { word: w, fem: g === 'f' };
  }
  return { word: NOUN_EN[step.letter] ?? '?', fem: false };
}

const OBLIQUE: Record<string, string> = {
  बेटा: 'बेटे', साला: 'साले', भतीजा: 'भतीजे', भांजा: 'भांजे', पोता: 'पोते', परपोता: 'परपोते',
  चचेरा: 'चचेरे', ममेरा: 'ममेरे', फुफेरा: 'फुफेरे', मौसेरा: 'मौसेरे', बड़ा: 'बड़े', छोटा: 'छोटे', सौतेला: 'सौतेले',
};

/** Oblique form of the last noun phrase in `s` (only the trailing words change). */
function oblique(s: string): string {
  // only the final noun phrase (after the last postposition) is affected
  const m = s.match(/^(.*\s(?:का|की|के)\s)?(.+)$/);
  const head = m?.[1] ?? '';
  const tail = (m?.[2] ?? s).split(' ').map((w) => OBLIQUE[w] ?? w).join(' ');
  return head + tail;
}

function stripSeniority(code: string): string {
  return code.split('.').map((p) => p.replace(/^[ey]/, '')).join('.');
}

function labelForCode(code: string, lang: Lang): string | undefined {
  return lookupLabel(code, lang) ?? lookupLabel(stripSeniority(code), lang);
}

/** Human label for "target is the ___ of focus". */
export function relationLabel(info: RelationInfo | undefined, lang: Lang): string {
  if (!info) return '';
  if (info.side === 'self') return lang === 'hi' ? 'स्वयं (focus)' : 'Self (focus)';
  if (info.side === 'unlinked') return lang === 'hi' ? 'जुड़ा नहीं' : 'Not linked';
  const steps = info.steps;

  // Whole path has a name
  if (info.kinship) {
    const whole = labelForCode(info.code, lang);
    if (whole) {
      if (steps.length === 1 && steps[0].kind === 'sibling' && steps[0].half) {
        return `${whole} (${lang === 'hi' ? 'सौतेला' : 'half'})`;
      }
      return whole;
    }
  }

  // Longest named prefix + descriptive rest
  let base = '';
  let start = 0;
  for (let k = steps.length - 1; k >= 1; k--) {
    const pre = steps.slice(0, k);
    if (pre.some((s) => s.kind === 'social')) continue;
    const l = labelForCode(codeOf(pre), lang);
    if (l) { base = l; start = k; break; }
  }
  const rest = steps.slice(start);
  const nouns = rest.map((s) => stepNoun(s, lang));
  if (lang === 'hi') {
    // A noun followed by का/की/के takes the oblique form: साला → साले, बेटा → बेटे
    let out = base;
    nouns.forEach((n, i) => {
      if (!out) { out = n.word; return; }
      const last = i === nouns.length - 1;
      const post = n.fem ? 'की' : last ? 'का' : 'के';
      out = `${oblique(out)} ${post} ${n.word}`;
    });
    return out;
  }
  let out = base;
  nouns.forEach((n) => {
    out = out ? `${out}'s ${n.word}` : n.word.charAt(0).toUpperCase() + n.word.slice(1);
  });
  return out;
}

/** Both Hindi and English, e.g. "मामा · Mother's brother" */
export function dualLabel(info: RelationInfo | undefined, lang: Lang): { primary: string; secondary: string } {
  const primary = relationLabel(info, lang);
  const secondary = lang === 'en' ? relationLabel(info, 'hi') : relationLabel(info, 'en');
  return { primary, secondary: secondary === primary ? '' : secondary };
}
