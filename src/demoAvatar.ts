import type { CaseFile, Gender } from './types';

/**
 * Illustrated portraits for the fictional demo people, from the DiceBear "avataaars" API.
 * Deliberately not real photos: a demo marks people as accused, and a stock photo is always
 * somebody's real face. Look follows gender and age group (child, young, middle-aged, elder);
 * the seed is the name, so a name always gets the same face.
 */
const SKIN = 'd08b5b,ae5d29,edb98a,614335';
const BG = 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf';

type AgeGroup = 'child' | 'young' | 'middle' | 'elder';
export const ageGroup = (age?: number): AgeGroup =>
  age == null ? 'middle' : age < 14 ? 'child' : age < 30 ? 'young' : age < 55 ? 'middle' : 'elder';

const LOOK: Record<'male' | 'female', Record<AgeGroup, Record<string, string>>> = {
  male: {
    child: { top: 'shortRound,shortFlat,shortCurly', clothing: 'hoodie,overall', mouth: 'smile,twinkle', eyes: 'happy,default', hairColor: '2c1b18,4a312c', facialHairProbability: '0', accessoriesProbability: '0' },
    young: { top: 'shortWaved,shortCurly,theCaesarAndSidePart,sides,shortRound', clothing: 'hoodie,shirtCrewNeck,shirtVNeck', mouth: 'default,smile,serious', eyes: 'default', hairColor: '2c1b18,4a312c,724133', facialHair: 'beardLight', facialHairProbability: '40', accessoriesProbability: '5' },
    middle: { top: 'shortFlat,theCaesar,shortRound,theCaesarAndSidePart', clothing: 'blazerAndShirt,collarAndSweater,shirtCrewNeck', mouth: 'default,serious', eyes: 'default', hairColor: '2c1b18,4a312c', facialHair: 'beardMedium,moustacheMagnum,beardLight', facialHairProbability: '65', accessories: 'prescription01,prescription02', accessoriesProbability: '20' },
    elder: { top: 'sides,shortFlat,theCaesar', clothing: 'collarAndSweater,blazerAndSweater', mouth: 'serious,default', eyes: 'default,squint', hairColor: 'e8e1e1,ecdcbf', facialHair: 'beardMedium,moustacheFancy,moustacheMagnum', facialHairProbability: '70', accessories: 'prescription01,prescription02,round', accessoriesProbability: '70' },
  },
  female: {
    child: { top: 'bun,curly,straight01,bob', clothing: 'overall,hoodie', mouth: 'smile,twinkle', eyes: 'happy,default', hairColor: '2c1b18,4a312c', facialHairProbability: '0', accessoriesProbability: '0' },
    young: { top: 'straight01,longButNotTooLong,curvy,bigHair,straightAndStrand', clothing: 'shirtScoopNeck,shirtVNeck,hoodie', mouth: 'default,smile', eyes: 'default', hairColor: '2c1b18,4a312c,724133', facialHairProbability: '0', accessoriesProbability: '5' },
    middle: { top: 'bun,bob,straight02,longButNotTooLong', clothing: 'blazerAndSweater,collarAndSweater,shirtScoopNeck', mouth: 'default,serious', eyes: 'default', hairColor: '2c1b18,4a312c', facialHairProbability: '0', accessories: 'prescription01,prescription02', accessoriesProbability: '20' },
    elder: { top: 'bun,bob', clothing: 'collarAndSweater,blazerAndSweater', mouth: 'serious,default', eyes: 'default', hairColor: 'e8e1e1,ecdcbf', facialHairProbability: '0', accessories: 'prescription01,prescription02,round', accessoriesProbability: '65' },
  },
};

export function demoAvatar(name: string, gender: Gender, age?: number): string {
  const look = LOOK[gender === 'female' ? 'female' : 'male'][ageGroup(age)];
  // facial hair takes the hair colour (grey beard with grey hair), shirts carry no slogans
  const p = new URLSearchParams({ seed: name, skinColor: SKIN, backgroundColor: BG, eyebrows: 'defaultNatural,flatNatural', facialHairColor: look.hairColor, ...look });
  return `https://api.dicebear.com/9.x/avataaars/svg?${p.toString()}`;
}

/** Gives every real (non-placeholder) person in a demo case a portrait matching gender and age. */
export function addDemoAvatars(cf: CaseFile): CaseFile {
  for (const p of Object.values(cf.persons)) {
    if (p.isGhost || p.photo) continue;
    const fromDob = p.dob ? new Date().getFullYear() - Number(String(p.dob).slice(0, 4)) : undefined;
    const age = p.approxAge ?? (Number.isFinite(fromDob) ? fromDob : undefined);
    cf.persons[p.id] = { ...p, photo: demoAvatar(p.name, p.gender, age) };
  }
  return cf;
}
