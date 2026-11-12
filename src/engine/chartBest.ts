import type { CaseFile } from '../types';
import type { RelationInfo } from './relations';
import { layoutChart, type CardSize, type ChartLayout } from './chart';
import { chartLines, countCardHits, countCrossings, countOverlaps } from './chartQuality';

/** Lower is better: crossings matter most, then lines through cards, then overlaps, then width. */
export function chartScore(cf: CaseFile, lay: ChartLayout, size: CardSize) {
  const lines = chartLines(cf, lay, size);
  const xs = [...lay.positions.values()].map((p) => p.x);
  const width = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
  return countCrossings(lines).count * 100 + countCardHits(cf, lay, size, lines).count * 60 + countOverlaps(lines).count * 30 + width / 200;
}

/**
 * Tries the natural order plus a number of shuffled starting orders and keeps the layout whose
 * lines cross least. Deterministic: the same case always gives the same chart.
 */
export function layoutChartBest(cf: CaseFile, rel: Map<string, RelationInfo>, size: CardSize): ChartLayout {
  const n = Object.keys(cf.persons).length;
  const tries = n > 200 ? 1 : n > 80 ? 6 : 16;
  let best = layoutChart(cf, rel, size, 0);
  let bestScore = chartScore(cf, best, size);
  for (let seed = 1; seed < tries && bestScore >= 1; seed++) {
    const lay = layoutChart(cf, rel, size, seed);
    const sc = chartScore(cf, lay, size);
    if (sc < bestScore - 0.5) {
      best = lay;
      bestScore = sc;
    }
  }
  return best;
}
