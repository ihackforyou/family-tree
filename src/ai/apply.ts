import type { CaseFile, Person } from '../types';
import type { RelationTemplate } from '../engine/templates';
import { addEdge, addPerson, applyTemplate, linkStep, newPerson, type EdgeMeta } from '../engine/ops';
import type { FamilyAction } from './types';

type WithPerson = Extract<FamilyAction, { name: string }>;

/** Only defined fields are returned, so an unknown gender does not override the gender implied by the kinship step. */
const personOf = (a: WithPerson, fallbackRole: Person['role']): Partial<Person> & { name: string } => {
  const p: Partial<Person> & { name: string } = {
    name: a.name.trim(),
    role: a.role ?? fallbackRole,
    mobiles: a.mobile ? [a.mobile.trim()] : [],
  };
  if (a.gender && a.gender !== 'unknown') p.gender = a.gender;
  if (a.approxAge != null) p.approxAge = a.approxAge;
  if (a.address) p.address = a.address;
  if (a.notes) p.notes = a.notes;
  return p;
};

/** applyTemplate only reads `steps`; wrap the AI's path as an anonymous template. */
const pathTemplate = (steps: RelationTemplate['steps']): RelationTemplate => ({
  id: 'ai-path', hi: '', en: '', keywords: [], group: 'own', steps,
});

/**
 * Applies AI-proposed family actions to a draft case, in order. New people get real ids and
 * later actions can refer to them by their `ref`. An action the engine rejects (for example a
 * third biological parent) is skipped and reported; the rest still apply.
 */
export function applyFamilyActions(d: CaseFile, actions: FamilyAction[]): { applied: number; errors: string[] } {
  const idOf = new Map<string, string>();
  const resolve = (x: string) => idOf.get(x) ?? x;
  const errors: string[] = [];
  let applied = 0;

  for (const a of actions) {
    const meta: EdgeMeta = { confidence: a.confidence, source: 'AI assistant' };
    try {
      switch (a.op) {
        case 'addPerson': {
          idOf.set(a.ref, addPerson(d, newPerson(personOf(a, 'relative'))).id);
          break;
        }
        case 'addRelative': {
          const anchor = resolve(a.anchor);
          if (!d.persons[anchor]) throw new Error(`unknown person ${a.anchor}`);
          idOf.set(a.ref, applyTemplate(d, anchor, pathTemplate(a.steps), { person: personOf(a, 'relative') }, meta));
          break;
        }
        case 'addAssociate': {
          const anchor = resolve(a.anchor);
          if (!d.persons[anchor]) throw new Error(`unknown person ${a.anchor}`);
          const p = addPerson(d, newPerson(personOf(a, 'associate')));
          addEdge(d, 'social', anchor, p.id, { ...meta, subtype: a.socialType });
          idOf.set(a.ref, p.id);
          break;
        }
        case 'relate': {
          const from = resolve(a.a);
          const to = resolve(a.b);
          if (!d.persons[from] || !d.persons[to]) throw new Error('unknown person');
          if (a.socialType) addEdge(d, 'social', from, to, { ...meta, subtype: a.socialType });
          else if (a.steps?.length === 1) linkStep(d, from, to, a.steps[0], meta);
          else if (a.steps?.length) applyTemplate(d, from, pathTemplate(a.steps), { existingId: to }, meta);
          else throw new Error('no relation given');
          break;
        }
      }
      applied++;
    } catch (e) {
      const who = 'name' in a ? a.name : a.op;
      errors.push(`${who}: ${(e as Error).message}`);
    }
  }
  return { applied, errors };
}
