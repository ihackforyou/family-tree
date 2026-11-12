import { describe, expect, it } from 'vitest';
import { demoCase } from '../../demo';
import { computeRelations } from '../relations';
import { CARD_SIZES, layoutChart } from '../chart';

describe('family chart layout', () => {
  for (const size of ['compact', 'normal'] as const) {
    it(`places the demo family without overlaps (${size})`, () => {
      const cf = demoCase();
      const rel = computeRelations(cf, cf.focusId!);
      const { w, h } = CARD_SIZES[size];
      const lay = layoutChart(cf, rel, size);
      const pos = [...lay.positions.entries()];
      expect(pos).toHaveLength(Object.keys(cf.persons).length);

      for (let i = 0; i < pos.length; i++) {
        for (let j = i + 1; j < pos.length; j++) {
          const a = pos[i][1];
          const b = pos[j][1];
          const overlap = a.x < b.x + w && b.x < a.x + w && a.y < b.y + h && b.y < a.y + h;
          expect(overlap, `${pos[i][0]} overlaps ${pos[j][0]}`).toBe(false);
        }
      }

      const edges = Object.values(cf.edges);
      for (const e of edges) {
        const a = lay.positions.get(e.from);
        const b = lay.positions.get(e.to);
        if (!a || !b || !lay.unitOf.has(e.from) || !lay.unitOf.has(e.to)) continue;
        // spouses share a row; children sit below their parents
        if (e.kind === 'spouse') expect(a.y).toBe(b.y);
        if (e.kind === 'parent') expect(b.y).toBeGreaterThan(a.y);
      }
    });
  }

  it('starts a shared child line at the parents marriage line', () => {
    const cf = demoCase();
    const lay = layoutChart(cf, computeRelations(cf, cf.focusId!), 'compact');
    expect(lay.junctions.length).toBeGreaterThan(0);
    const focusSources = lay.childSource.get(cf.focusId!) ?? [];
    expect(focusSources.some((s) => s.startsWith('j:'))).toBe(true);
  });
});
