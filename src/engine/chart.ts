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
  /** Pre-routed orthogonal lines (line id → points), valid while no card has been moved by hand. */
  routes: Map<string, { x: number; y: number }[]>;
}

const SIDE_RANK: Record<string, number> = { paternal: 0, self: 1, core: 1, maternal: 2, inlaw: 3, associate: 4, unlinked: 5 };

function orderUnit(members: Person[]): Person[] {
  // male on the left, female on the right; stable by creation otherwise
  const rank = (p: Person) => (p.gender === 'male' ? 0 : p.gender === 'female' ? 2 : 1);
  return [...members].sort((a, b) => rank(a) - rank(b) || a.createdAt - b.createdAt);
}

/** Small deterministic PRNG so a given seed always gives the same layout. */
function rng(seed: number) {
  let t = seed * 2654435761 >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Lays out the chart. `seed` 0 uses the natural order (father's side left, in-laws right);
 * other seeds shuffle the order dagre starts from, which `layoutChartBest` uses to search for
 * the arrangement with the fewest crossing lines.
 */
export function layoutChart(cf: CaseFile, rel: Map<string, RelationInfo>, size: CardSize, seed = 0, rowGap?: number): ChartLayout {
  const { w: W, h: H } = CARD_SIZES[size];
  const rand = seed ? rng(seed) : null;
  const ids = Object.keys(cf.persons);
  const edges = Object.values(cf.edges).filter((e) => cf.persons[e.from] && cf.persons[e.to]);
  if (rand) {
    const tie = new Map(edges.map((e) => [e.id, rand()]));
    edges.sort((a, b) => tie.get(a.id)! - tie.get(b.id)!);
  }

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
  const tieBreak = new Map([...ordered.keys()].map((u) => [u, rand ? rand() : 0]));
  const unitIds = [...ordered.keys()].sort((a, b) => {
    const ma = ordered.get(a)!;
    const mb = ordered.get(b)!;
    if (rand) return tieBreak.get(a)! - tieBreak.get(b)!;
    return unitRank(ma) - unitRank(mb) || unitDist(ma) - unitDist(mb);
  });

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: size === 'compact' ? 26 : 40, ranksep: rowGap ?? (size === 'compact' ? 72 : 88), marginx: 0, marginy: 0 });
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

  // ---- ranks (rows) from the unit centres
  const rankYs = [...new Set([...ordered.keys()].map((u) => Math.round(g.node(u).y)))].sort((a, b) => a - b);
  const rankOfY = (y: number) => {
    let best = 0;
    rankYs.forEach((ry, i) => { if (Math.abs(ry - y) < Math.abs(rankYs[best] - y)) best = i; });
    return best;
  };
  const rankOf = (id: string) => rankOfY(positions.get(id)!.y + H / 2);

  // ---- face each spouse towards their own parents so parent lines do not cross the couple
  const parentsOf = new Map<string, string[]>();
  for (const e of edges) if (e.kind === 'parent') (parentsOf.get(e.to) ?? parentsOf.set(e.to, []).get(e.to)!).push(e.from);
  const parentX = (id: string) => {
    const ps = parentsOf.get(id);
    if (!ps?.length) return null;
    return ps.reduce((sum, q) => sum + positions.get(q)!.x + W / 2, 0) / ps.length;
  };
  const unitsTopDown = [...ordered.entries()].sort((a, b) => positions.get(a[1][0].id)!.y - positions.get(b[1][0].id)!.y);
  for (const [u, members] of unitsTopDown) {
    if (members.length !== 2) continue;
    const [a, b] = members;
    const ka = parentX(a.id);
    const kb = parentX(b.id);
    const pa = positions.get(a.id)!;
    const pb = positions.get(b.id)!;
    const centre = (pa.x + pb.x + W) / 2;
    const swap = ka != null && kb != null ? ka > kb : ka != null ? ka > centre : kb != null ? kb < centre : false;
    if (swap) {
      positions.set(a.id, pb);
      positions.set(b.id, pa);
      ordered.set(u, [b, a]);
    }
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

  // ---- route every line between rows through free lanes, each family on its own track
  interface Spec { id: string; key: string; from: string; to: string; start: Pt; end: Pt; r1: number; r2: number; mids: number[] }
  const specs: Spec[] = [];
  const top = (id: string): Pt => { const p = positions.get(id)!; return { x: p.x + W / 2, y: p.y }; };
  const bottom = (id: string): Pt => { const p = positions.get(id)!; return { x: p.x + W / 2, y: p.y + H }; };
  const midsFor = (ua: string, ub: string, r1: number, r2: number, x1: number, x2: number) => {
    const ge = g.edge(ua, ub) ?? g.edge(ub, ua);
    const pts: Pt[] = (ge?.points as Pt[] | undefined) ?? [];
    const out: number[] = [];
    for (let r = r1 + 1; r < r2; r++) {
      const hit = pts.find((q) => Math.abs(q.y - rankYs[r]) < 2);
      out.push(hit ? hit.x : x1 + ((x2 - x1) * (r - r1)) / (r2 - r1));
    }
    return out;
  };
  for (const [child, sources] of childSource) {
    for (const src of sources) {
      const j = junctions.get(src);
      const start = j ? { x: j.x, y: j.y } : bottom(src);
      const r1 = j ? rankOf(j.parents[0]) : rankOf(src);
      const r2 = rankOf(child);
      if (r2 <= r1) continue;
      const end = top(child);
      const pu = unitOf.get(j ? j.parents[0] : src)!;
      const id = j ? `${src}>${child}` : edges.find((e) => e.kind === 'parent' && e.from === src && e.to === child)!.id;
      specs.push({ id, key: src, from: src, to: child, start, end, r1, r2, mids: midsFor(pu, unitOf.get(child)!, r1, r2, start.x, end.x) });
    }
  }
  for (const e of edges) {
    if (e.kind !== 'social' && e.kind !== 'sibling') continue;
    const ra = rankOf(e.from);
    const rb = rankOf(e.to);
    if (ra === rb) continue;
    const [u, l] = ra < rb ? [e.from, e.to] : [e.to, e.from];
    const start = bottom(u);
    const end = top(l);
    const r1 = Math.min(ra, rb);
    const r2 = Math.max(ra, rb);
    specs.push({ id: e.id, key: `${u}:link`, from: u, to: l, start, end, r1, r2, mids: midsFor(unitOf.get(u)!, unitOf.get(l)!, r1, r2, start.x, end.x) });
  }

  // ---- every line gets its own port: lines leaving / entering one card (or one marriage line)
  // are spread along its edge, ordered by where they go so they do not cross each other there.
  const spread = (list: Spec[], which: 'start' | 'end', width: number, maxStep: number, other: (s: Spec) => number) => {
    if (list.length < 2) return;
    list.sort((a, b) => other(a) - other(b));
    const step = Math.min(maxStep, width / (list.length - 1));
    const centre = list[0][which].x;
    list.forEach((s, i) => { s[which] = { ...s[which], x: centre + (i - (list.length - 1) / 2) * step }; });
  };
  const byFrom = new Map<string, Spec[]>();
  const byTo = new Map<string, Spec[]>();
  for (const s of specs) {
    (byFrom.get(s.from) ?? byFrom.set(s.from, []).get(s.from)!).push(s);
    (byTo.get(s.to) ?? byTo.set(s.to, []).get(s.to)!).push(s);
  }
  const nextX = (s: Spec) => (s.mids.length ? s.mids[0] : s.end.x);
  const prevX = (s: Spec) => (s.mids.length ? s.mids[s.mids.length - 1] : s.start.x);
  for (const [from, list] of byFrom) {
    if (from.startsWith('j:')) spread(list, 'start', COUPLE_GAP - 8, 6, nextX);
    else spread(list, 'start', W * 0.6, 16, nextX);
  }
  for (const [, list] of byTo) spread(list, 'end', W * 0.6, 16, prevX);

  // horizontal runs per gap, grouped so lines from one source share a bus (tree look)
  const xAt = (s: Spec, r: number) => (r === s.r1 ? s.start.x : r === s.r2 ? s.end.x : s.mids[r - s.r1 - 1]);
  // each line has its own horizontal run, so no two lines are ever drawn on top of each other
  const groupKey = (s: Spec, _gap: number) => s.id;
  const gapGroups = new Map<number, Map<string, { min: number; max: number }>>();
  for (const s of specs) {
    for (let gap = s.r1; gap < s.r2; gap++) {
      const a = xAt(s, gap);
      const b = xAt(s, gap + 1);
      const groups = gapGroups.get(gap) ?? gapGroups.set(gap, new Map()).get(gap)!;
      const k = groupKey(s, gap);
      const cur = groups.get(k) ?? { min: Infinity, max: -Infinity };
      groups.set(k, { min: Math.min(cur.min, a, b), max: Math.max(cur.max, a, b) });
    }
  }
  // where each group's lines enter (top) and leave (bottom) the gap
  const gapStems = new Map<string, { tops: number[]; bots: number[] }>();
  for (const s of specs) {
    for (let gap = s.r1; gap < s.r2; gap++) {
      const k = `${gap}|${groupKey(s, gap)}`;
      const st = gapStems.get(k) ?? gapStems.set(k, { tops: [], bots: [] }).get(k)!;
      st.tops.push(xAt(s, gap));
      st.bots.push(xAt(s, gap + 1));
    }
  }
  // Interval colouring: groups whose runs do not overlap share a track. Then try every order of the
  // tracks (few per gap) and keep the one where the fewest stems cut through another group's bus.
  const trackOf = new Map<string, { t: number; n: number }>();
  for (const [gap, groups] of gapGroups) {
    const list = [...groups.entries()].sort((a, b) => a[1].min - b[1].min);
    const tracksEnd: number[] = [];
    const assigned: [string, number][] = [];
    for (const [k, iv] of list) {
      if (iv.max - iv.min < 1) { assigned.push([k, -1]); continue; }
      let t = tracksEnd.findIndex((end) => end + 10 < iv.min);
      if (t < 0) { t = tracksEnd.length; tracksEnd.push(iv.max); } else tracksEnd[t] = iv.max;
      assigned.push([k, t]);
    }
    const n = Math.max(1, tracksEnd.length);
    const cost = (level: number[]) => {
      let c = 0;
      for (const [kp, tp] of assigned) {
        if (tp < 0) continue;
        const iv = groups.get(kp)!;
        for (const [kq, tq] of assigned) {
          if (kq === kp) continue;
          const st = gapStems.get(`${gap}|${kq}`)!;
          const lp = level[tp];
          const lq = tq < 0 ? n : level[tq]; // a straight drop crosses every bus it passes
          // q's stem from the top reaches down to its bus: it cuts p's bus if p's bus is higher
          if (lp < lq || tq < 0) c += st.tops.filter((x) => x > iv.min + 1 && x < iv.max - 1).length;
          // q's stem to the bottom starts at its bus: it cuts p's bus if p's bus is lower
          if (lp > lq && tq >= 0) c += st.bots.filter((x) => x > iv.min + 1 && x < iv.max - 1).length;
        }
      }
      return c;
    };
    let best = Array.from({ length: n }, (_, i) => i);
    if (n > 1 && n <= 6) {
      let bestCost = cost(best);
      const perm = (arr: number[], k: number) => {
        if (k === arr.length) {
          const c = cost(arr);
          if (c < bestCost) { bestCost = c; best = [...arr]; }
          return;
        }
        for (let i = k; i < arr.length; i++) {
          [arr[k], arr[i]] = [arr[i], arr[k]];
          perm(arr, k + 1);
          [arr[k], arr[i]] = [arr[i], arr[k]];
        }
      };
      perm([...best], 0);
    }
    for (const [k, t] of assigned) trackOf.set(`${gap}|${k}`, { t: t < 0 ? 0 : best[t], n });
  }
  const busY = (gap: number, k: string) => {
    const { t, n } = trackOf.get(`${gap}|${k}`) ?? { t: 0, n: 1 };
    const gTop = rankYs[gap] + H / 2;
    const gBot = rankYs[gap + 1] - H / 2;
    return gTop + ((t + 1) * (gBot - gTop)) / (n + 1);
  };
  const routes = new Map<string, Pt[]>();
  for (const s of specs) {
    const pts: Pt[] = [s.start];
    let x = s.start.x;
    for (let gap = s.r1; gap < s.r2; gap++) {
      const y = busY(gap, groupKey(s, gap));
      const nx = xAt(s, gap + 1);
      pts.push({ x, y }, { x: nx, y });
      x = nx;
    }
    pts.push(s.end);
    routes.set(s.id, pts);
  }

  // Not enough room between two rows for all the separate runs? Lay out again with wider rows.
  const TRACK = size === 'compact' ? 11 : 13;
  let maxTracks = 0;
  for (const v of trackOf.values()) maxTracks = Math.max(maxTracks, v.n);
  const needed = (maxTracks + 1) * TRACK;
  const current = rowGap ?? (size === 'compact' ? 72 : 88);
  if (needed > current && rowGap == null) return layoutChart(cf, rel, size, seed, Math.min(needed, 260));

  return { positions, junctions: [...junctions.values()], childSource, unitOf, side: null, routes };
}

type Pt = { x: number; y: number };

/** Middle of the line between two parent cards (works after either card is dragged too). */
export function junctionPoint(a: { x: number; y: number }, b: { x: number; y: number }, W: number, H: number) {
  const [l, r] = a.x < b.x ? [a, b] : [b, a];
  const gapMid = (l.x + W + r.x) / 2;
  return { x: r.x > l.x + W ? gapMid : (l.x + r.x + W) / 2, y: (l.y + r.y) / 2 + H / 2 };
}
