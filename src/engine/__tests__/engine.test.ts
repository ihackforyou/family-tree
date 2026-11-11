import { describe, it, expect } from 'vitest';
import type { CaseFile, Gender } from '../../types';
import { computeRelations, relationLabel } from '../relations';
import { TEMPLATES, searchTemplates } from '../templates';
import { addEdge, addPerson, applyTemplate, mergePersons, newPerson, RelationError } from '../ops';

function emptyCase(): CaseFile {
  return { id: 'c', title: 't', persons: {}, edges: {}, audit: [], createdAt: 0, updatedAt: 0 };
}

function tpl(id: string) {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`no template ${id}`);
  return t;
}

function setup(gender: Gender = 'male') {
  const cf = emptyCase();
  const suspect = addPerson(cf, newPerson({ name: 'Suspect', gender, role: 'suspect' }));
  const add = (anchor: string, tplId: string, name: string) => applyTemplate(cf, anchor, tpl(tplId), { person: { name } });
  const info = (focus: string, id: string) => computeRelations(cf, focus).get(id)!;
  const hi = (focus: string, id: string) => relationLabel(info(focus, id), 'hi');
  const en = (focus: string, id: string) => relationLabel(info(focus, id), 'en');
  return { cf, s: suspect.id, add, info, hi, en };
}

const ghosts = (cf: CaseFile) => Object.values(cf.persons).filter((p) => p.isGhost);

describe('male suspect: full tree via templates', () => {
  const { cf, s, add, info, hi, en } = setup('male');
  const ids: Record<string, string> = {};
  // order matters a little: parents and grandparents first
  const plan: [string, string][] = [
    ['father', 'पिता'], ['mother', 'माता'], ['dada', 'दादा'], ['nani', 'नानी'],
    ['tau', 'ताऊ'], ['chacha', 'चाचा'], ['bua', 'बुआ'], ['phupha', 'फूफा'],
    ['mama', 'मामा'], ['mausi', 'मौसी'], ['mausa', 'मौसा'],
    ['chachera-bhai', 'चचेरा भाई'], ['mamera-bhai', 'ममेरा भाई'],
    ['wife', 'पत्नी'], ['sasur-w', 'ससुर'], ['sala', 'साला'], ['sali', 'साली'],
    ['sadhu', 'साढ़ू'], ['salhaj', 'सलहज'],
    ['bhabhi', 'भाभी'], ['jija', 'जीजा / बहनोई'], ['bhatija', 'भतीजा'], ['bhanja', 'भांजा'],
    ['bahu', 'बहू'], ['damad', 'दामाद'], ['pota', 'पोता'], ['nati', 'नाती'],
  ];
  for (const [tid] of plan) ids[tid] = add(s, tid, `P-${tid}`);

  it.each(plan)('%s → %s', (tid, label) => {
    expect(hi(s, ids[tid])).toBe(label);
  });

  it('English labels', () => {
    expect(en(s, ids.father)).toBe('Father');
    expect(en(s, ids.mama)).toBe("Mother's brother");
    expect(en(s, ids.tau)).toBe("Father's elder brother");
    expect(en(s, ids.chacha)).toBe("Father's younger brother");
    expect(en(s, ids.sadhu)).toBe("Wife's sister's husband");
    expect(en(s, ids.nati)).toBe("Daughter's son");
  });

  it('seniority codes', () => {
    expect(info(s, ids.chacha).code).toBe('F.yB');
    expect(info(s, ids.tau).code).toBe('F.eB');
  });

  it('generation numbers', () => {
    expect(info(s, s).generation).toBe(0);
    expect(info(s, ids.father).generation).toBe(1);
    expect(info(s, ids.chacha).generation).toBe(1);
    expect(info(s, ids.dada).generation).toBe(2);
    expect(info(s, ids.nani).generation).toBe(2);
    expect(info(s, ids.wife).generation).toBe(0);
    expect(info(s, ids['sasur-w']).generation).toBe(1);
    expect(info(s, ids.bhatija).generation).toBe(-1);
    expect(info(s, ids.pota).generation).toBe(-2);
    expect(info(s, ids['mamera-bhai']).generation).toBe(0);
  });

  it('sides', () => {
    expect(info(s, s).side).toBe('self');
    expect(info(s, ids.father).side).toBe('paternal');
    expect(info(s, ids.bua).side).toBe('paternal');
    expect(info(s, ids.mother).side).toBe('maternal');
    expect(info(s, ids.mama).side).toBe('maternal');
    expect(info(s, ids.wife).side).toBe('inlaw');
    expect(info(s, ids.sala).side).toBe('inlaw');
    expect(info(s, ids.bhabhi).side).toBe('core');
    expect(info(s, ids.pota).side).toBe('core');
    const loner = addPerson(cf, newPerson({ name: 'Loner' }));
    expect(info(s, loner.id).side).toBe('unlinked');
    expect(hi(s, loner.id)).toBe('जुड़ा नहीं');
  });
});

describe('female suspect: husband side', () => {
  const { s, add, hi, en, info } = setup('female');
  const husband = add(s, 'husband', 'H');
  const jeth = add(s, 'jeth', 'J');
  const devar = add(s, 'devar', 'D');
  const nanad = add(s, 'nanad', 'N');
  const nandoi = add(s, 'nandoi', 'NN');
  const devrani = add(s, 'devrani', 'DR');

  it('labels', () => {
    expect(hi(s, husband)).toBe('पति');
    expect(hi(s, jeth)).toBe('जेठ');
    expect(hi(s, devar)).toBe('देवर');
    expect(hi(s, nanad)).toBe('ननद');
    expect(hi(s, nandoi)).toBe('ननदोई');
    expect(hi(s, devrani)).toBe('देवरानी');
    expect(en(s, devrani)).toBe("Husband's younger brother's wife");
  });
  it('reuses nanad for nandoi and devar for devrani', () => {
    expect(info(s, nandoi).steps.map((x) => x.to)).toContain(nanad);
    expect(info(s, devrani).steps.map((x) => x.to)).toContain(devar);
  });
});

describe('ghost nodes', () => {
  it('मामा with missing mother creates one ghost mother; मौसी reuses it', () => {
    const { cf, s, add, info, hi } = setup('male');
    const mama = add(s, 'mama', 'Mama');
    expect(ghosts(cf)).toHaveLength(1);
    const g = ghosts(cf)[0];
    expect(g.gender).toBe('female');
    expect(info(s, g.id).code).toBe('M');
    expect(hi(s, mama)).toBe('मामा');
    const mausi = add(s, 'mausi', 'Mausi');
    expect(ghosts(cf)).toHaveLength(1);
    expect(hi(s, mausi)).toBe('मौसी');
    expect(info(s, mausi).steps[0].to).toBe(g.id);
  });

  it('ताऊ then चाचा reuse the same (ghost) father', () => {
    const { cf, s, add, info, hi } = setup('male');
    const tau = add(s, 'tau', 'Tau');
    const chacha = add(s, 'chacha', 'Chacha');
    expect(ghosts(cf)).toHaveLength(1);
    expect(info(s, tau).steps[0].to).toBe(info(s, chacha).steps[0].to);
    expect(hi(s, tau)).toBe('ताऊ');
    expect(hi(s, chacha)).toBe('चाचा');
  });
});

describe('inverse relations', () => {
  it('from मामा, a male suspect is भांजा', () => {
    const { s, add, hi } = setup('male');
    const mama = add(s, 'mama', 'Mama');
    expect(hi(mama, s)).toBe('भांजा');
  });
  it('from मामा, a female suspect is भांजी', () => {
    const { s, add, hi } = setup('female');
    const mama = add(s, 'mama', 'Mama');
    expect(hi(mama, s)).toBe('भांजी');
  });
});

describe('descriptive fallback', () => {
  it('wife → brother → son', () => {
    const { s, add, hi, en, info } = setup('male');
    add(s, 'wife', 'W');
    const sala = add(s, 'sala', 'Sala');
    const son = add(sala, 'son', 'SalaSon');
    expect(info(s, son).code).toBe('W.B.S');
    const h = hi(s, son);
    expect(h.length).toBeGreaterThan(0);
    expect(h).toContain('साले');
    expect(/का|की/.test(h)).toBe(true);
    expect(h).toBe('साले का बेटा');
    const e = en(s, son);
    expect(e).toContain("'s");
    expect(e).toBe("Wife's brother's son");
  });
});

describe('social edges', () => {
  it('money-mule is an associate', () => {
    const { cf, s, info, hi, en } = setup('male');
    const mule = addPerson(cf, newPerson({ name: 'Mule', gender: 'male', role: 'associate' }));
    addEdge(cf, 'social', s, mule.id, { subtype: 'money-mule' });
    const i = info(s, mule.id);
    expect(i.side).toBe('associate');
    expect(i.kinship).toBe(false);
    expect(hi(s, mule.id)).toBe('मनी म्यूल');
    expect(en(s, mule.id)).toBe('Money mule');
  });

  it('family path beats a shorter social path', () => {
    const { cf, s, add, info, hi } = setup('male');
    const dada = add(s, 'dada', 'Dada');
    addEdge(cf, 'social', s, dada, { subtype: 'money-mule' });
    const i = info(s, dada);
    expect(i.kinship).toBe(true);
    expect(i.side).toBe('paternal');
    expect(i.code).toBe('F.F');
    expect(hi(s, dada)).toBe('दादा');
  });

  it('relative of an associate is reached via the associate', () => {
    const { cf, s, info, hi } = setup('male');
    const mule = addPerson(cf, newPerson({ name: 'Mule', gender: 'male' }));
    addEdge(cf, 'social', s, mule.id, { subtype: 'money-mule' });
    const muleSon = applyTemplate(cf, mule.id, tpl('son'), { person: { name: 'MS' } });
    const i = info(s, muleSon);
    expect(i.side).toBe('associate');
    expect(hi(s, muleSon)).toContain('मनी म्यूल');
  });
});

describe('errors', () => {
  it('cycle throws RelationError', () => {
    const { cf, s, add } = setup('male');
    const father = add(s, 'father', 'F');
    const dada = add(s, 'dada', 'D');
    expect(() => addEdge(cf, 'parent', s, father)).toThrow(RelationError);
    expect(() => addEdge(cf, 'parent', s, dada)).toThrow(RelationError);
  });
  it('third biological parent throws', () => {
    const { cf, s, add } = setup('male');
    add(s, 'father', 'F');
    add(s, 'mother', 'M');
    const x = addPerson(cf, newPerson({ name: 'X', gender: 'unknown' }));
    expect(() => addEdge(cf, 'parent', x.id, s)).toThrow(RelationError);
    // step parent is allowed
    expect(() => addEdge(cf, 'parent', x.id, s, { subtype: 'step' })).not.toThrow();
  });
  it('second father throws', () => {
    const { cf, s, add } = setup('male');
    add(s, 'father', 'F');
    const x = addPerson(cf, newPerson({ name: 'X', gender: 'male' }));
    expect(() => addEdge(cf, 'parent', x.id, s)).toThrow(RelationError);
  });
  it('self edge throws', () => {
    const { cf, s } = setup('male');
    expect(() => addEdge(cf, 'spouse', s, s)).toThrow(RelationError);
  });
});

describe('mergePersons', () => {
  it('merges a ghost mother into a real person and moves edges', () => {
    const { cf, s, add, hi, info } = setup('male');
    const mama = add(s, 'mama', 'Mama');
    const ghost = ghosts(cf)[0];
    const real = addPerson(cf, newPerson({ name: 'Sunita', gender: 'female', mobiles: ['9876543210'] }));
    mergePersons(cf, real.id, ghost.id);
    expect(cf.persons[ghost.id]).toBeUndefined();
    expect(ghosts(cf)).toHaveLength(0);
    expect(cf.persons[real.id].name).toBe('Sunita');
    expect(cf.persons[real.id].isGhost).toBeFalsy();
    expect(Object.values(cf.edges).some((e) => e.from === ghost.id || e.to === ghost.id)).toBe(false);
    expect(hi(s, real.id)).toBe('माता');
    expect(hi(s, mama)).toBe('मामा');
    expect(info(s, mama).steps[0].to).toBe(real.id);
  });
  it('keeping the ghost id takes the real name', () => {
    const { cf, s, add, hi } = setup('male');
    add(s, 'mama', 'Mama');
    const ghost = ghosts(cf)[0];
    const real = addPerson(cf, newPerson({ name: 'Sunita', gender: 'female' }));
    mergePersons(cf, ghost.id, real.id);
    expect(cf.persons[ghost.id].name).toBe('Sunita');
    expect(cf.persons[ghost.id].isGhost).toBeFalsy();
    expect(cf.persons[real.id]).toBeUndefined();
    expect(hi(s, ghost.id)).toBe('माता');
  });
});

describe('searchTemplates', () => {
  it.each([
    ['mama', 'mama'],
    ['मामा', 'mama'],
    ["mother's brother", 'mama'],
    ['khala', 'mausi'],
    ['tau', 'tau'],
    ['साढ़ू', 'sadhu'],
  ])('%s → %s first', (q, id) => {
    expect(searchTemplates(q)[0]?.id).toBe(id);
  });
  it('empty query returns all templates', () => {
    expect(searchTemplates('  ')).toHaveLength(TEMPLATES.length);
  });
});
