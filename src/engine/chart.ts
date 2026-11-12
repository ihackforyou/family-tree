import dagre from '@dagrejs/dagre';
import type { CaseFile, Person } from '../types';
import type { RelationInfo } from './relations';

/**
 * "Family chart" layout: one compact genealogy / org-chart for everybody in the case.
 *  - husband and wife (and any other spouses) sit side by side as one family unit;
 *  - children hang below their parents' unit, one generation per row;
 *  - associates (friends, gang, SIM / account providers …) hang below the person they are linked to,
 *    so their lines stay short instead of crossing the whole chart;
 *  - units are placed with dagre (layered graph layout) to keep lines short and uncrossed.
 */

export type CardSize = 'normal' | 'compact';
export const CARD_SIZES: Record<CardSize, { w: number; h: number }> = {
  normal: { w: 220, h: 92 },
  compact: { w: 156, h: 46 },
};
const COUPLE_GAP = 26;

export interface Junction {
  id: string;
  /** centre of the marriage line between two parents */
  x: number;
  y: number;
  parents: [string, string];
}

export interface ChartLayout {
  positions: Map<string, { x: number; y: number }>;
  junctions: Junction[];
  /** child id → junction id (both parents in one unit) and/or single parent ids */
  childSource: Map<string, string[]>;
  /** person id → unit id */
  unitOf: Map<string, string>;
  /** kept for compatibility; associates are now part of the chart */
  side: null;
}

const SIDE_RANK: Record<string, number> = { paternal: 0, self: 1, core: 1, maternal: 2, inlaw: 3, associate: 4, unlinked: 5 };

function orderUnit(members: Person[]): Person[] {
  // male on the left, female on the right; stable by creation otherwise
  const rank = (p: Person) => (p.gender === 'male' ? 0 : p.gender === 'female' ? 2 : 1);
  return [...members].sort((a, b) => rank(a) - rank(b) || a.createdAt - b.createdAt);
}

export function layoutChart(cf: CaseFile, rel: Map<string, RelationInfo>, size: CardSize): ChartLayout {
  const { w: W, h: H } = CARD_SIZES[size];
  const ids = Object.keys(cf.persons);
  const edges = Object.values(cf.edges).filter((e) => cf.persons[e.from] && cf.persons[e.to]);

  // ---- family units: people joined by spouse edges
  const parent = new Map<string, string>(ids.map((id) => [id, id]));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== r) { const n = parent.get(c)!; parent.set(c, r); c = n; }
    return r;
  };
  for (const e of edges) if (e.kind === 'spouse') parent.set(find(e.from), find(e.to));
  const units = new Map<string, Person[]>();
  for (const id of ids) {
    const r = find(id);
    const arr = units.get(r);
    if (arr) arr.push(cf.persons[id]);
    else units.set(r, [cf.persons[id]]);
  }
  const unitOf = new Map<string, string>();
  const ordered = new Map<string, Person[]>();
  for (const [u, members] of units) {
    const o = orderUnit(members);
    ordered.set(u, o);
    for (const p of o) unitOf.set(p.id, u);
  }

  // ---- layered layout of units; insertion order seeds dagre's left-to-right order
  const unitRank = (members: Person[]) => Math.min(...members.map((p) => SIDE_RANK[rel.get(p.id)?.side ?? 'unlinked'] ?? 5));
  const unitDist = (members: Person[]) => Math.min(...members.map((p) => rel.get(p.id)?.steps.length ?? 99));
  const unitIds = [...ordered.keys()].sort((a, b) => {
    const ma = ordered.get(a)!;
    const mb = ordered.get(b)!;
    return unitRank(ma) - unitRank(mb) || unitDist(ma) - unitDist(mb);
  });

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: size === 'compact' ? 26 : 40, ranksep: size === 'compact' ? 64 : 80, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const u of unitIds) {
    const members = ordered.get(u)!;
    g.setNode(u, { width: members.length * W + (members.length - 1) * COUPLE_GAP, height: H });
  }
  const childParents = new Map<string, string[]>();
  for (const e of edges) {
    if (e.kind !== 'parent') continue;
    const pu = unitOf.get(e.from)!;
    const cu = unitOf.get(e.to)!;
    if (pu !== cu && !g.hasEdge(pu, cu)) g.setEdge(pu, cu, { weight: 12, minlen: 1 });
    const list = childParents.get(e.to);
    if (list) list.push(e.from);
    else childParents.set(e.to, [e.from]);
  }
  // Associates hang below whoever brought them into the case (the person nearer the focus).
  const dist = (id: string) => rel.get(id)?.steps.length ?? 99;
  for (const e of edges) {
    if (e.kind !== 'social' && e.kind !== 'sibling') continue;
    const [a, b] = dist(e.from) <= dist(e.to) ? [e.from, e.to] : [e.to, e.from];
    const ua = unitOf.get(a)!;
    const ub = unitOf.get(b)!;
    if (ua === ub || g.hasEdge(ua, ub) || g.hasEdge(ub, ua)) continue;
    if (e.kind === 'sibling') {
      // siblings without recorded parents: an invisible shared parent keeps them on one row
      const vp = `vp:${e.id}`;
      g.setNode(vp, { width: 1, height: 1 });
      g.setEdge(vp, ua, { weight: 12, minlen: 1 });
      g.setEdge(vp, ub, { weight: 12, minlen: 1 });
    } else {
      g.setEdge(ua, ub, { weight: 1, minlen: 1 });
    }
  }
  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const [u, members] of ordered) {
    const n = g.node(u);
    if (!n) continue;
    const x0 = n.x - n.width / 2;
    const y = n.y - H / 2;
    members.forEach((p, i) => positions.set(p.id, { x: x0 + i * (W + COUPLE_GAP), y }));
  }

  // ---- where each child's line starts: the parents' marriage line, or the single parent
  const junctions = new Map<string, Junction>();
  const childSource = new Map<string, string[]>();
  for (const [child, parents] of childParents) {
    const sources: string[] = [];
    const used = new Set<string>();
    for (const a of parents) {
      if (used.has(a)) continue;
      const partner = parents.find((b) => b !== a && !used.has(b) && unitOf.get(b) === unitOf.get(a));
      if (partner) {
        const pair = [a, partner].sort() as [string, string];
        const id = `j:${pair.join(':')}`;
        if (!junctions.has(id)) junctions.set(id, { id, ...junctionPoint(positions.get(pair[0])!, positions.get(pair[1])!, W, H), parents: pair });
        sources.push(id);
        used.add(a).add(partner);
      } else {
        sources.push(a);
        used.add(a);
      }
    }
    childSource.set(child, sources);
  }

  return { positions, junctions: [...junctions.values()], childSource, unitOf, side: null };
}

/** Middle of the line between two parent cards (works after either card is dragged too). */
export function junctionPoint(a: { x: number; y: number }, b: { x: number; y: number }, W: number, H: number) {
  const [l, r] = a.x < b.x ? [a, b] : [b, a];
  const gapMid = (l.x + W + r.x) / 2;
  return { x: r.x > l.x + W ? gapMid : (l.x + r.x + W) / 2, y: (l.y + r.y) / 2 + H / 2 };
}
