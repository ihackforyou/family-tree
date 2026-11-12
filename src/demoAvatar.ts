import type { CaseFile, Gender } from './types';

/**
 * Illustrated portraits for the fictional demo people, from the DiceBear avatar API.
 * Deliberately not real photos: a demo marks people as accused, and a stock photo is always
 * somebody's real face. The seed is the person's name, so a name always gets the same face.
 */
const BG = 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf';

export function demoAvatar(name: string, gender: Gender, age?: number): string {
  const p = new URLSearchParams({ seed: name, backgroundColor: BG, radius: '50' });
  if (gender === 'female') {
    p.set('hair', age && age > 55 ? 'straightBun,curlyBun' : 'long,extraLong,curlyBun,straightBun,bobCut');
    p.set('facialHairProbability', '0');
  } else if (gender === 'male') {
    p.set('hair', age && age > 55 ? 'balding,bald,shortCombover' : age && age < 14 ? 'buzzcut,fade' : 'shortCombover,shortComboverChops,fade,buzzcut,sideShave');
    p.set('facialHairProbability', age && age < 18 ? '0' : '45');
  }
  return `https://api.dicebear.com/9.x/personas/svg?${p.toString()}`;
}

/** Gives every real (non-placeholder) person in a demo case a portrait that matches their gender. */
export function addDemoAvatars(cf: CaseFile): CaseFile {
  for (const p of Object.values(cf.persons)) {
    if (p.isGhost || p.photo) continue;
    const age = p.approxAge ?? (p.dob ? new Date().getFullYear() - Number(String(p.dob).slice(0, 4)) : undefined);
    cf.persons[p.id] = { ...p, photo: demoAvatar(p.name, p.gender, Number.isFinite(age) ? age : undefined) };
  }
  return cf;
}
