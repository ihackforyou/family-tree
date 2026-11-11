import type { CaseFile, Confidence, Edge, EdgeKind, Gender, Person } from '../types';
import { buildIndex, siblingsOf } from './relations';
import type { RelationTemplate, TStep } from './templates';

/**
 * Pure-ish mutations on a CaseFile draft. Callers pass a shallow copy
 * (see `draftOf`) and these functions replace objects instead of mutating them.
 */

export function uid(prefix = ''): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return prefix + r;
}

export function draftOf(cf: CaseFile): CaseFile {
  return { ...cf, persons: { ...cf.persons }, edges: { ...cf.edges }, audit: [...cf.audit] };
}

export function newPerson(partial: Partial<Person> & { name: string }): Person {
  return {
    id: uid('p_'),
    aliases: [],
    gender: 'unknown',
    role: 'relative',
    status: 'alive',
    mobiles: [],
    firs: [],
    createdAt: Date.now(),
    ...partial,
  };
}

export interface EdgeMeta {
  confidence?: Confidence;
  source?: string;
  subtype?: Edge['subtype'];
}

export class RelationError extends Error {}

function sameEdge(e: Edge, kind: EdgeKind, a: string, b: string): boolean {
  if (e.kind !== kind) return false;
  if (kind === 'parent') return e.from === a && e.to === b;
  return (e.from === a && e.to === b) || (e.from === b && e.to === a);
}

/** Is `ancestor` already an ancestor of `id`? */
function isAncestor(cf: CaseFile, ancestor: string, id: string): boolean {
  const idx = buildIndex(Object.values(cf.edges));
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const p of idx.parents.get(cur) ?? []) {
      if (p.id === ancestor) return true;
      if (!seen.has(p.id)) { seen.add(p.id); stack.push(p.id); }
    }
  }
  return false;
}

export function addEdge(cf: CaseFile, kind: EdgeKind, from: string, to: string, meta: EdgeMeta = {}): Edge {
  if (from === to) throw new RelationError('कोई व्यक्ति खुद से रिश्ता नहीं रख सकता।');
  const existing = Object.values(cf.edges).find((e) => sameEdge(e, kind, from, to));
  if (existing) return existing;
  if (kind === 'parent') {
    if (isAncestor(cf, to, from)) {
      throw new RelationError('एक व्यक्ति अपना ही पूर्वज नहीं हो सकता (cycle)।');
    }
    const subtype = meta.subtype ?? 'biological';
    if (subtype === 'biological') {
      const bio = Object.values(cf.edges).filter(
        (e) => e.kind === 'parent' && e.to === to && (e.subtype ?? 'biological') === 'biological',
      );
      const parentGender = cf.persons[from]?.gender;
      if (bio.length >= 2) {
        throw new RelationError("Biological माता-पिता 2 से ज़्यादा नहीं हो सकते। Step-parent के लिए 'सौतेला' चुनें।");
      }
      if (parentGender && parentGender !== 'unknown' && bio.some((e) => cf.persons[e.from]?.gender === parentGender)) {
        throw new RelationError(parentGender === 'male' ? 'इस व्यक्ति के पिता पहले से जुड़े हैं।' : 'इस व्यक्ति की माता पहले से जुड़ी हैं।');
      }
    }
  }
  const e: Edge = {
    id: uid('e_'),
    kind,
    from,
    to,
    subtype: meta.subtype ?? (kind === 'parent' ? 'biological' : kind === 'spouse' ? 'married' : kind === 'sibling' ? 'full' : 'other'),
    confidence: meta.confidence ?? 'probable',
    source: meta.source,
    createdAt: Date.now(),
  };
  cf.edges[e.id] = e;
  return e;
}

export function addPerson(cf: CaseFile, p: Person): Person {
  cf.persons[p.id] = p;
  return p;
}

function parentsOf(cf: CaseFile, id: string): Person[] {
  return Object.values(cf.edges)
    .filter((e) => e.kind === 'parent' && e.to === id)
    .map((e) => cf.persons[e.from])
    .filter(Boolean);
}

function spousesOf(cf: CaseFile, id: string): Person[] {
  return Object.values(cf.edges)
    .filter((e) => e.kind === 'spouse' && (e.from === id || e.to === id))
    .map((e) => cf.persons[e.from === id ? e.to : e.from])
    .filter(Boolean);
}

function childrenOf(cf: CaseFile, id: string): Person[] {
  return Object.values(cf.edges)
    .filter((e) => e.kind === 'parent' && e.from === id)
    .map((e) => cf.persons[e.to])
    .filter(Boolean);
}

/**
 * Connect `newId` to `anchorId` with one primitive step and the helpful extras:
 *  - a new parent is married to the other existing parent,
 *  - a new child gets the anchor's only spouse as second parent,
 *  - a new sibling becomes a child of the anchor's parents (so it is derived, not stored).
 */
export function linkStep(cf: CaseFile, anchorId: string, newId: string, step: TStep, meta: EdgeMeta = {}): void {
  const em: EdgeMeta = { confidence: meta.confidence, source: meta.source };
  switch (step.kind) {
    case 'up': {
      addEdge(cf, 'parent', newId, anchorId, { ...em, subtype: meta.subtype });
      const other = parentsOf(cf, anchorId).find((p) => p.id !== newId);
      if (other && !spousesOf(cf, newId).some((s) => s.id === other.id)) {
        addEdge(cf, 'spouse', newId, other.id, em);
      }
      break;
    }
    case 'down': {
      addEdge(cf, 'parent', anchorId, newId, { ...em, subtype: meta.subtype });
      const sp = spousesOf(cf, anchorId);
      if (sp.length === 1 && parentsOf(cf, newId).length < 2) {
        try { addEdge(cf, 'parent', sp[0].id, newId, em); } catch { /* ignore */ }
      }
      break;
    }
    case 'spouse':
      addEdge(cf, 'spouse', anchorId, newId, { ...em, subtype: meta.subtype });
      break;
    case 'sibling': {
      const ps = parentsOf(cf, anchorId);
      if (ps.length) {
        for (const p of ps) addEdge(cf, 'parent', p.id, newId, em);
      } else {
        addEdge(cf, 'sibling', anchorId, newId, { ...em, subtype: meta.subtype });
      }
      if (step.seniority) {
        cf.persons[newId] = { ...cf.persons[newId], seniority: { ref: anchorId, elder: step.seniority === 'e' } };
      }
      break;
    }
  }
}

/** Find an existing person one step away that matches the step. */
export function findByStep(cf: CaseFile, anchorId: string, step: TStep): Person | undefined {
  const match = (p: Person) => step.gender === 'unknown' || p.gender === step.gender;
  switch (step.kind) {
    case 'up': return parentsOf(cf, anchorId).find(match);
    case 'down': return undefined; // children are never assumed: there can be many
    case 'spouse': return spousesOf(cf, anchorId).find(match);
    case 'sibling': {
      const idx = buildIndex(Object.values(cf.edges));
      const sibs = siblingsOf(idx, anchorId).map((s) => cf.persons[s.id]).filter(Boolean).filter(match);
      if (!step.seniority) return sibs.length === 1 ? sibs[0] : undefined;
      return sibs.find((s) => s.seniority?.ref === anchorId && s.seniority.elder === (step.seniority === 'e'));
    }
  }
}

export interface ApplyTarget {
  existingId?: string;
  person?: Partial<Person> & { name: string };
}

/**
 * Add a relative through a named template (e.g. मामा = mother → her brother).
 * Missing people in between become ghost nodes, existing ones are reused.
 * Returns the target person id.
 */
export function applyTemplate(cf: CaseFile, anchorId: string, tpl: RelationTemplate, target: ApplyTarget, meta: EdgeMeta = {}): string {
  let cur = anchorId;
  tpl.steps.forEach((step, i) => {
    const last = i === tpl.steps.length - 1;
    if (!last) {
      const found = findByStep(cf, cur, step);
      if (found) { cur = found.id; return; }
      const ghost = addPerson(cf, newPerson({ name: 'अज्ञात', gender: step.gender, isGhost: true, role: 'relative' }));
      linkStep(cf, cur, ghost.id, step, { ...meta, confidence: 'suspected' });
      cur = ghost.id;
      return;
    }
    let tid: string;
    if (target.existingId) {
      tid = target.existingId;
      if (step.gender !== 'unknown' && cf.persons[tid].gender === 'unknown') {
        cf.persons[tid] = { ...cf.persons[tid], gender: step.gender };
      }
    } else {
      const p = addPerson(cf, newPerson({ gender: step.gender, ...target.person! }));
      tid = p.id;
    }
    linkStep(cf, cur, tid, step, meta);
    cur = tid;
  });
  return cur;
}

/** Primitive link between two existing people (drag-to-link). */
export type PrimitiveRel = 'father' | 'mother' | 'parent' | 'son' | 'daughter' | 'child' | 'husband' | 'wife' | 'spouse' | 'brother' | 'sister' | 'sibling';

/** "A is the <rel> of B" */
export function linkPrimitive(cf: CaseFile, aId: string, rel: PrimitiveRel, bId: string, meta: EdgeMeta = {}): void {
  const g: Record<PrimitiveRel, Gender> = {
    father: 'male', mother: 'female', parent: 'unknown', son: 'male', daughter: 'female', child: 'unknown',
    husband: 'male', wife: 'female', spouse: 'unknown', brother: 'male', sister: 'female', sibling: 'unknown',
  };
  const kind: Record<PrimitiveRel, TStep['kind']> = {
    father: 'up', mother: 'up', parent: 'up', son: 'down', daughter: 'down', child: 'down',
    husband: 'spouse', wife: 'spouse', spouse: 'spouse', brother: 'sibling', sister: 'sibling', sibling: 'sibling',
  };
  const gender = g[rel];
  if (gender !== 'unknown' && cf.persons[aId].gender === 'unknown') {
    cf.persons[aId] = { ...cf.persons[aId], gender };
  }
  linkStep(cf, bId, aId, { kind: kind[rel], gender }, meta);
}

export function removePerson(cf: CaseFile, id: string): void {
  delete cf.persons[id];
  for (const e of Object.values(cf.edges)) {
    if (e.from === id || e.to === id) delete cf.edges[e.id];
  }
  if (cf.focusId === id) cf.focusId = Object.keys(cf.persons)[0];
}

/** Merge `dropId` into `keepId`: edges move over, empty fields are filled. */
export function mergePersons(cf: CaseFile, keepId: string, dropId: string): void {
  const keep = cf.persons[keepId];
  const drop = cf.persons[dropId];
  if (!keep || !drop || keepId === dropId) return;
  const merged: Person = { ...keep };
  for (const k of Object.keys(drop) as (keyof Person)[]) {
    const kv = merged[k];
    const empty = kv == null || kv === '' || (Array.isArray(kv) && kv.length === 0) || (k === 'gender' && kv === 'unknown');
    if (empty) (merged as unknown as Record<string, unknown>)[k] = drop[k];
  }
  merged.aliases = [...new Set([...keep.aliases, ...drop.aliases, ...(drop.isGhost ? [] : [drop.name])])].filter((a) => a !== merged.name);
  merged.mobiles = [...new Set([...keep.mobiles, ...drop.mobiles])];
  merged.firs = [...new Set([...keep.firs, ...drop.firs])];
  if (keep.isGhost && !drop.isGhost) merged.name = drop.name;
  merged.isGhost = keep.isGhost && drop.isGhost;
  cf.persons[keepId] = merged;
  for (const e of Object.values(cf.edges)) {
    if (e.from !== dropId && e.to !== dropId) continue;
    const from = e.from === dropId ? keepId : e.from;
    const to = e.to === dropId ? keepId : e.to;
    delete cf.edges[e.id];
    if (from === to) continue;
    if (Object.values(cf.edges).some((x) => sameEdge(x, e.kind, from, to))) continue;
    cf.edges[e.id] = { ...e, from, to };
  }
  delete cf.persons[dropId];
  if (cf.focusId === dropId) cf.focusId = keepId;
}

export function childrenCount(cf: CaseFile, id: string): number {
  return childrenOf(cf, id).length;
}

/** Possible duplicates: same mobile, or same normalised name. */
export function findDuplicates(cf: CaseFile, p: Pick<Person, 'name' | 'mobiles'>, excludeId?: string): Person[] {
  const n = p.name.trim().toLowerCase();
  const mobs = new Set(p.mobiles.map((m) => m.replace(/\D/g, '').slice(-10)).filter(Boolean));
  return Object.values(cf.persons).filter((x) => {
    if (x.id === excludeId || x.isGhost) return false;
    if (n && x.name.trim().toLowerCase() === n) return true;
    return x.mobiles.some((m) => mobs.has(m.replace(/\D/g, '').slice(-10)));
  });
}
