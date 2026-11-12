import { describe, expect, it } from 'vitest';
import { zenithDemoCase } from '../../demoZenith';
import { computeRelations, relationLabel } from '../relations';
import { layoutChart } from '../chart';

describe('Zenith fraud demo case', () => {
  const cf = zenithDemoCase();
  const byName = (n: string) => Object.values(cf.persons).find((p) => p.name === n)!;
  const label = (from: string, to: string, lang: 'hi' | 'en' = 'hi') =>
    relationLabel(computeRelations(cf, byName(from).id).get(byName(to).id), lang);

  it('has ten accused with how they came into the case and the evidence', () => {
    const accused = Object.values(cf.persons).filter((p) => p.firs.includes('0312/2026'));
    expect(accused).toHaveLength(10);
    for (const p of accused) {
      expect(p.source, p.name).toBeTruthy();
      expect(p.evidence, p.name).toBeTruthy();
    }
  });

  it('derives the family relations', () => {
    expect(label('Deepak Rathore', 'Kunal Mehta')).toMatch(/^साला/);
    expect(label('Deepak Rathore', 'Arjun Rathore')).toMatch(/छोटा भाई/);
    expect(label('Manish Yadav', 'Suresh Yadav')).toMatch(/^पिता/);
    expect(label('Nitin Saini', 'Ravi Saini')).toMatch(/चचेरा/);
  });

  it('lays out without errors', () => {
    const lay = layoutChart(cf, computeRelations(cf, cf.focusId!), 'compact');
    expect(lay.positions.size).toBe(Object.keys(cf.persons).length);
  });
});
