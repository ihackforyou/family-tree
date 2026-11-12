import { describe, expect, it } from 'vitest';
import { emptyCase } from '../../demo';
import { addPerson, draftOf, newPerson } from '../../engine/ops';
import { computeRelations } from '../../engine/relations';
import { applyFamilyActions } from '../apply';

function base() {
  const d = draftOf(emptyCase('AI test'));
  const rahul = addPerson(d, newPerson({ name: 'Rahul', gender: 'male', role: 'suspect' }));
  d.focusId = rahul.id;
  return { d, rahul };
}

describe('applyFamilyActions', () => {
  it('adds a mama through a ghost mother and an associate of the new person', () => {
    const { d, rahul } = base();
    const r = applyFamilyActions(d, [
      { op: 'addRelative', ref: 'r1', anchor: rahul.id, steps: [{ kind: 'up', gender: 'female' }, { kind: 'sibling', gender: 'male' }], name: 'Suresh', gender: 'unknown', confidence: 'probable', mobile: '98xxxxxx12' },
      { op: 'addAssociate', ref: 'r2', anchor: 'r1', socialType: 'money-mule', name: 'Imran', gender: 'male', confidence: 'suspected' },
    ]);
    expect(r).toEqual({ applied: 2, errors: [] });
    const people = Object.values(d.persons);
    const suresh = people.find((p) => p.name === 'Suresh')!;
    expect(suresh.gender).toBe('male');
    expect(suresh.mobiles).toEqual(['98xxxxxx12']);
    expect(people.some((p) => p.isGhost && p.gender === 'female')).toBe(true);
    const rel = computeRelations(d, rahul.id).get(suresh.id);
    expect(rel?.code).toBe('M.B');
    const imran = people.find((p) => p.name === 'Imran')!;
    expect(imran.role).toBe('associate');
    expect(Object.values(d.edges).some((e) => e.kind === 'social' && e.from === suresh.id && e.to === imran.id && e.subtype === 'money-mule')).toBe(true);
  });

  it('relates two existing people and reports engine errors without stopping', () => {
    const { d, rahul } = base();
    const r = applyFamilyActions(d, [
      { op: 'addPerson', ref: 'r1', name: 'Vikas', gender: 'male', confidence: 'probable' },
      { op: 'relate', a: rahul.id, b: 'r1', steps: [{ kind: 'sibling', gender: 'male' }], confidence: 'confirmed' },
      { op: 'relate', a: rahul.id, b: rahul.id, socialType: 'friend', confidence: 'probable' },
      { op: 'addRelative', ref: 'r2', anchor: 'nobody', steps: [{ kind: 'up', gender: 'male' }], name: 'X', gender: 'male', confidence: 'probable' },
    ]);
    expect(r.applied).toBe(2);
    expect(r.errors).toHaveLength(2);
    const vikas = Object.values(d.persons).find((p) => p.name === 'Vikas')!;
    expect(computeRelations(d, rahul.id).get(vikas.id)?.code).toMatch(/^B/);
  });
});
