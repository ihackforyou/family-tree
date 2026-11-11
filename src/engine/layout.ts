import type { RelationInfo, Side } from './relations';

export const CARD_W = 220;
export const CARD_H = 92;
const GAP_X = 20;
export const ROW_H = 168;
const LANE_PAD = 20;
const LANE_GAP = 28;
const TOP = 56; // room for the lane header
const MIN_LANE_W = 240;
const COLLAPSED_W = 120;

export const LANE_ORDER: Side[] = ['paternal', 'maternal', 'core', 'inlaw', 'associate', 'unlinked'];

export interface LaneBox {
  side: Side;
  x: number;
  y: number;
  w: number;
  h: number;
  count: number;
  collapsed: boolean;
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  lanes: LaneBox[];
  rows: { gen: number; y: number }[];
  rowSpan: { x0: number; x1: number };
}

function laneOf(info: RelationInfo): Side {
  return info.side === 'self' ? 'core' : info.side;
}

/**
 * Generation rows x family lanes.
 *  - every generation is one row (G+n on top, G-n below), focus person at G0
 *  - lanes: पितृ पक्ष | मातृ पक्ष | focus का घर | ससुराल | सहयोगी | जुड़े नहीं
 *  - father is placed at the right edge of the paternal lane and mother at the left
 *    edge of the maternal lane, so the parents sit next to each other.
 */
export function layoutTree(rel: Map<string, RelationInfo>, collapsed: Set<Side>): LayoutResult {
  const byLane = new Map<Side, RelationInfo[]>();
  for (const info of rel.values()) {
    const l = laneOf(info);
    const arr = byLane.get(l);
    if (arr) arr.push(info);
    else byLane.set(l, [info]);
  }

  const family = [...rel.values()].filter((i) => i.side !== 'associate' && i.side !== 'unlinked');
  const gens = family.map((i) => i.generation);
  const maxGen = gens.length ? Math.max(...gens) : 0;
  const minGen = gens.length ? Math.min(...gens) : 0;
  const rowY = (g: number) => TOP + (maxGen - g) * ROW_H;
  const familyHeight = (maxGen - minGen + 1) * ROW_H;

  const positions = new Map<string, { x: number; y: number }>();
  const lanes: LaneBox[] = [];
  let x = 0;

  for (const side of LANE_ORDER) {
    const members = byLane.get(side) ?? [];
    if (!members.length && side !== 'core') continue;
    const isCollapsed = collapsed.has(side) && side !== 'core';

    if (side === 'associate' || side === 'unlinked') {
      const cols = members.length > 6 ? 2 : 1;
      const w = isCollapsed ? COLLAPSED_W : cols * (CARD_W + GAP_X) - GAP_X + 2 * LANE_PAD;
      const sorted = [...members].sort((a, b) => a.steps.length - b.steps.length || a.code.localeCompare(b.code));
      const rowsNeeded = Math.ceil(sorted.length / cols);
      const h = Math.max(familyHeight, rowsNeeded * (CARD_H + 24) + 24);
      if (!isCollapsed) {
        sorted.forEach((info, i) => {
          positions.set(info.personId, {
            x: x + LANE_PAD + (i % cols) * (CARD_W + GAP_X),
            y: TOP + 24 + Math.floor(i / cols) * (CARD_H + 24),
          });
        });
      }
      lanes.push({ side, x, y: TOP - 44, w, h: h + 44, count: members.length, collapsed: isCollapsed });
      x += w + LANE_GAP;
      continue;
    }

    const byGen = new Map<number, RelationInfo[]>();
    for (const m of members) {
      const a = byGen.get(m.generation);
      if (a) a.push(m);
      else byGen.set(m.generation, [m]);
    }
    const maxCount = Math.max(1, ...[...byGen.values()].map((a) => a.length));
    const w = isCollapsed ? COLLAPSED_W : Math.max(MIN_LANE_W, maxCount * (CARD_W + GAP_X) - GAP_X + 2 * LANE_PAD);

    if (!isCollapsed) {
      const rightAligned = side === 'paternal' || side === 'core';
      for (const [g, arr] of byGen) {
        const sorted = [...arr].sort((a, b) => {
          if (a.side === 'self') return 1;
          if (b.side === 'self') return -1;
          return side === 'paternal' ? b.code.localeCompare(a.code) : a.code.localeCompare(b.code);
        });
        const rowW = sorted.length * (CARD_W + GAP_X) - GAP_X;
        const x0 = rightAligned ? x + w - LANE_PAD - rowW : x + LANE_PAD;
        sorted.forEach((info, i) => {
          positions.set(info.personId, { x: x0 + i * (CARD_W + GAP_X), y: rowY(g) + (ROW_H - CARD_H) / 2 });
        });
      }
    }
    lanes.push({ side, x, y: TOP - 44, w, h: familyHeight + 44, count: members.length, collapsed: isCollapsed });
    x += w + LANE_GAP;
  }

  const rows: { gen: number; y: number }[] = [];
  for (let g = maxGen; g >= minGen; g--) rows.push({ gen: g, y: rowY(g) });
  return { positions, lanes, rows, rowSpan: { x0: 0, x1: x - LANE_GAP } };
}

/** Simple radial layout for the network view: focus in the middle, rings by distance. */
export function layoutNetwork(rel: Map<string, RelationInfo>): Map<string, { x: number; y: number }> {
  const rings = new Map<number, RelationInfo[]>();
  for (const info of rel.values()) {
    const d = info.side === 'unlinked' ? -1 : info.steps.length;
    const a = rings.get(d);
    if (a) a.push(info);
    else rings.set(d, [info]);
  }
  const pos = new Map<string, { x: number; y: number }>();
  const maxD = Math.max(0, ...[...rings.keys()]);
  for (const [d, arr] of rings) {
    const ring = d === -1 ? maxD + 1 : d;
    const sorted = [...arr].sort((a, b) => a.side.localeCompare(b.side) || a.code.localeCompare(b.code));
    if (ring === 0) {
      pos.set(sorted[0].personId, { x: -CARD_W / 2, y: -CARD_H / 2 });
      continue;
    }
    const radius = Math.max(ring * 300, (sorted.length * (CARD_W + 30)) / (2 * Math.PI));
    sorted.forEach((info, i) => {
      const a = (i / sorted.length) * Math.PI * 2 - Math.PI / 2 + ring * 0.35;
      pos.set(info.personId, { x: Math.cos(a) * radius - CARD_W / 2, y: Math.sin(a) * radius - CARD_H / 2 });
    });
  }
  return pos;
}
