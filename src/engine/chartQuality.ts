import type { CaseFile } from '../types';
import { CARD_SIZES, junctionPoint, type CardSize, type ChartLayout } from './chart';

/**
 * Measures how readable a family chart is: approximates every drawn line the way the canvas draws
 * it (right-angle "step" routing between facing card sides) and counts proper crossings between
 * lines that do not share an end. Used by tests to keep the layout from regressing.
 */

type Pt = { x: number; y: number };
type Seg = [Pt, Pt];
interface Line { id: string; ends: string[]; segs: Seg[] }

function stepRoute(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): Seg[] {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
  const gapY = b.y > a.y + a.h ? b.y - (a.y + a.h) : a.y > b.y + b.h ? a.y - (b.y + b.h) : 0;
  const vertical = gapY > 12 && (overlapX || Math.abs(bc.y - ac.y) > Math.abs(bc.x - ac.x) * 0.45);
  if (vertical) {
    const down = bc.y > ac.y;
    const s = { x: ac.x, y: down ? a.y + a.h : a.y };
    const t = { x: bc.x, y: down ? b.y : b.y + b.h };
    const my = (s.y + t.y) / 2;
    return [[s, { x: s.x, y: my }], [{ x: s.x, y: my }, { x: t.x, y: my }], [{ x: t.x, y: my }, t]];
  }
  const right = bc.x > ac.x;
  const s = { x: right ? a.x + a.w : a.x, y: ac.y };
  const t = { x: right ? b.x : b.x + b.w, y: bc.y };
  const mx = (s.x + t.x) / 2;
  return [[s, { x: mx, y: s.y }], [{ x: mx, y: s.y }, { x: mx, y: t.y }], [{ x: mx, y: t.y }, t]];
}

/** The lines the canvas draws for this layout (junction → child, parent → child, spouse, social, sibling). */
export function chartLines(cf: CaseFile, lay: ChartLayout, size: CardSize): Line[] {
  const { w: W, h: H } = CARD_SIZES[size];
  const box = (id: string) => {
    const p = lay.positions.get(id)!;
    return { x: p.x, y: p.y, w: W, h: H };
  };
  const routed = (id: string): Seg[] | null => {
    const pts = lay.routes.get(id);
    if (!pts) return null;
    const segs: Seg[] = [];
    for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1], pts[i]]);
    return segs;
  };
  const lines: Line[] = [];
  const doneJ = new Set<string>();
  for (const e of Object.values(cf.edges)) {
    if (!lay.positions.has(e.from) || !lay.positions.has(e.to)) continue;
    if (e.kind === 'parent') {
      const j = (lay.childSource.get(e.to) ?? []).find((s) => s.startsWith('j:') && s.split(':').includes(e.from));
      if (j) {
        const key = `${j}>${e.to}`;
        if (doneJ.has(key)) continue;
        doneJ.add(key);
        const [, a, b] = j.split(':');
        const pt = junctionPoint(lay.positions.get(a)!, lay.positions.get(b)!, W, H);
        lines.push({ id: key, ends: [a, b, e.to], segs: routed(key) ?? stepRoute({ x: pt.x - 1, y: pt.y - 1, w: 2, h: 2 }, box(e.to)) });
        continue;
      }
    }
    lines.push({ id: e.id, ends: [e.from, e.to], segs: routed(e.id) ?? stepRoute(box(e.from), box(e.to)) });
  }
  return lines;
}

function cross(p: Seg, q: Seg): boolean {
  const [a, b] = p;
  const [c, d] = q;
  const o = (u: Pt, v: Pt, w: Pt) => Math.sign((v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x));
  const o1 = o(a, b, c);
  const o2 = o(a, b, d);
  const o3 = o(c, d, a);
  const o4 = o(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/** Length two lines run on top of each other (collinear, overlapping), for lines that share no person. */
export function countOverlaps(lines: Line[]): { count: number; pairs: [string, string][] } {
  const pairs: [string, string][] = [];
  const ov = (s: Seg, t: Seg) => {
    const hz = (g: Seg) => Math.abs(g[0].y - g[1].y) < 0.5;
    const vt = (g: Seg) => Math.abs(g[0].x - g[1].x) < 0.5;
    if (hz(s) && hz(t) && Math.abs(s[0].y - t[0].y) < 2) {
      const [a1, a2] = [Math.min(s[0].x, s[1].x), Math.max(s[0].x, s[1].x)];
      const [b1, b2] = [Math.min(t[0].x, t[1].x), Math.max(t[0].x, t[1].x)];
      return Math.min(a2, b2) - Math.max(a1, b1) > 4;
    }
    if (vt(s) && vt(t) && Math.abs(s[0].x - t[0].x) < 2) {
      const [a1, a2] = [Math.min(s[0].y, s[1].y), Math.max(s[0].y, s[1].y)];
      const [b1, b2] = [Math.min(t[0].y, t[1].y), Math.max(t[0].y, t[1].y)];
      return Math.min(a2, b2) - Math.max(a1, b1) > 4;
    }
    return false;
  };
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];
      if (a.ends.some((x) => b.ends.includes(x))) continue;
      if (a.segs.some((s) => b.segs.some((t) => ov(s, t)))) pairs.push([a.id, b.id]);
    }
  }
  return { count: pairs.length, pairs };
}

/** Lines that pass through the body of a card that is not one of their ends. */
export function countCardHits(cf: CaseFile, lay: ChartLayout, size: CardSize, lines: Line[]): { count: number; hits: [string, string][] } {
  const { w: W, h: H } = CARD_SIZES[size];
  const hits: [string, string][] = [];
  for (const l of lines) {
    for (const [id, p] of lay.positions) {
      if (l.ends.includes(id)) continue;
      const x1 = p.x + 3, x2 = p.x + W - 3, y1 = p.y + 3, y2 = p.y + H - 3;
      const through = l.segs.some(([a, b]) => {
        const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x), minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
        return maxX > x1 && minX < x2 && maxY > y1 && minY < y2;
      });
      if (through) hits.push([l.id, cf.persons[id]?.name ?? id]);
    }
  }
  return { count: hits.length, hits };
}

/** Pairs of lines that cross; lines sharing a person are not counted (they meet there anyway). */
export function countCrossings(lines: Line[]): { count: number; pairs: [string, string][] } {
  const pairs: [string, string][] = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];
      if (a.ends.some((x) => b.ends.includes(x))) continue;
      if (a.segs.some((s) => b.segs.some((t) => cross(s, t)))) pairs.push([a.id, b.id]);
    }
  }
  return { count: pairs.length, pairs };
}
