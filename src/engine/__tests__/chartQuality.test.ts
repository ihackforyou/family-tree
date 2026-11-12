import { describe, expect, it } from 'vitest';
import { demoCase } from '../../demo';
import { zenithDemoCase } from '../../demoZenith';
import { computeRelations } from '../relations';
import { layoutChartBest } from '../chartBest';
import { chartLines, countCardHits, countCrossings, countOverlaps } from '../chartQuality';

describe('family chart readability', () => {
  for (const [name, make, maxCrossings] of [['small family demo', demoCase, 0], ['Zenith fraud demo', zenithDemoCase, 1]] as const) {
    for (const size of ['compact', 'normal'] as const) {
      it(`${name} (${size}): no line through a card, no lines on top of each other, few crossings`, () => {
        const cf = make();
        const lay = layoutChartBest(cf, computeRelations(cf, cf.focusId!), size);
        const lines = chartLines(cf, lay, size);
        expect(countCardHits(cf, lay, size, lines).hits).toEqual([]);
        expect(countOverlaps(lines).pairs).toEqual([]);
        expect(countCrossings(lines).count).toBeLessThanOrEqual(maxCrossings);
      });
    }
  }

  it('is deterministic', () => {
    const cf = zenithDemoCase();
    const rel = computeRelations(cf, cf.focusId!);
    const a = layoutChartBest(cf, rel, 'compact');
    const b = layoutChartBest(cf, rel, 'compact');
    expect([...a.positions.entries()]).toEqual([...b.positions.entries()]);
  });
});
