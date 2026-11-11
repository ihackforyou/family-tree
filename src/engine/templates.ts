import type { Gender } from '../types';

export type TStepKind = 'up' | 'down' | 'sibling' | 'spouse';

export interface TStep {
  kind: TStepKind;
  gender: Gender;
  seniority?: 'e' | 'y';
}

export interface RelationTemplate {
  id: string;
  hi: string;
  en: string;
  keywords: string[];
  /** Steps from the anchor person. Intermediate people are reused if they exist, else created as ghost nodes. */
  steps: TStep[];
  group: 'own' | 'paternal' | 'maternal' | 'wife' | 'husband' | 'descendants';
}

const m: Gender = 'male';
const f: Gender = 'female';
const up = (g: Gender): TStep => ({ kind: 'up', gender: g });
const down = (g: Gender): TStep => ({ kind: 'down', gender: g });
const sib = (g: Gender, s?: 'e' | 'y'): TStep => ({ kind: 'sibling', gender: g, seniority: s });
const sp = (g: Gender): TStep => ({ kind: 'spouse', gender: g });

const t = (
  id: string, hi: string, en: string, group: RelationTemplate['group'], steps: TStep[], keywords: string[] = [],
): RelationTemplate => ({ id, hi, en, group, steps, keywords });

export const TEMPLATES: RelationTemplate[] = [
  // अपना परिवार
  t('father', 'पिता', 'Father', 'own', [up(m)], ['pita', 'papa', 'baap', 'abbu', 'walid', 'bapu', 'father', 'dad']),
  t('mother', 'माता', 'Mother', 'own', [up(f)], ['mata', 'maa', 'mummy', 'ammi', 'walida', 'bebe', 'mother', 'mom']),
  t('brother', 'भाई', 'Brother', 'own', [sib(m)], ['bhai', 'bhaiya', 'bhra', 'brother']),
  t('elder-brother', 'बड़ा भाई', 'Elder brother', 'own', [sib(m, 'e')], ['bada bhai', 'bhaiya', 'elder brother']),
  t('younger-brother', 'छोटा भाई', 'Younger brother', 'own', [sib(m, 'y')], ['chhota bhai', 'younger brother']),
  t('sister', 'बहन', 'Sister', 'own', [sib(f)], ['behan', 'bahan', 'didi', 'bhain', 'sister']),
  t('elder-sister', 'बड़ी बहन', 'Elder sister', 'own', [sib(f, 'e')], ['didi', 'aapa', 'badi behan', 'elder sister']),
  t('younger-sister', 'छोटी बहन', 'Younger sister', 'own', [sib(f, 'y')], ['chhoti behan', 'younger sister']),
  t('husband', 'पति', 'Husband', 'own', [sp(m)], ['pati', 'shohar', 'gharwala', 'husband']),
  t('wife', 'पत्नी', 'Wife', 'own', [sp(f)], ['patni', 'biwi', 'gharwali', 'wife', 'begum']),
  t('son', 'बेटा', 'Son', 'own', [down(m)], ['beta', 'putra', 'ladka', 'putt', 'son']),
  t('daughter', 'बेटी', 'Daughter', 'own', [down(f)], ['beti', 'putri', 'ladki', 'dhee', 'daughter']),
  t('bhabhi', 'भाभी', "Brother's wife", 'own', [sib(m), sp(f)], ['bhabhi', 'bharjai', 'sister in law']),
  t('jija', 'जीजा / बहनोई', "Sister's husband", 'own', [sib(f), sp(m)], ['jija', 'jijaji', 'behnoi', 'brother in law']),
  t('bhatija', 'भतीजा', "Brother's son", 'own', [sib(m), down(m)], ['bhatija', 'bhateeja', 'nephew']),
  t('bhatiji', 'भतीजी', "Brother's daughter", 'own', [sib(m), down(f)], ['bhatiji', 'bhateeji', 'niece']),
  t('bhanja', 'भांजा', "Sister's son", 'own', [sib(f), down(m)], ['bhanja', 'bhanja', 'nephew']),
  t('bhanji', 'भांजी', "Sister's daughter", 'own', [sib(f), down(f)], ['bhanji', 'niece']),

  // संतान
  t('bahu', 'बहू', "Son's wife", 'descendants', [down(m), sp(f)], ['bahu', 'nooh', 'daughter in law']),
  t('damad', 'दामाद', "Daughter's husband", 'descendants', [down(f), sp(m)], ['damad', 'jawai', 'son in law']),
  t('pota', 'पोता', "Son's son", 'descendants', [down(m), down(m)], ['pota', 'grandson']),
  t('poti', 'पोती', "Son's daughter", 'descendants', [down(m), down(f)], ['poti', 'granddaughter']),
  t('nati', 'नाती', "Daughter's son", 'descendants', [down(f), down(m)], ['nati', 'nawasa', 'dohta', 'grandson']),
  t('natin', 'नातिन', "Daughter's daughter", 'descendants', [down(f), down(f)], ['natin', 'nawasi', 'dohti', 'granddaughter']),

  // पितृ पक्ष
  t('dada', 'दादा', 'Paternal grandfather', 'paternal', [up(m), up(m)], ['dada', 'baba', 'grandfather', 'grandpa']),
  t('dadi', 'दादी', 'Paternal grandmother', 'paternal', [up(m), up(f)], ['dadi', 'grandmother', 'grandma']),
  t('pardada', 'परदादा', 'Paternal great-grandfather', 'paternal', [up(m), up(m), up(m)], ['pardada', 'great grandfather']),
  t('tau', 'ताऊ', "Father's elder brother", 'paternal', [up(m), sib(m, 'e')], ['tau', 'taya', 'tauji', 'bade papa', 'bade abba', 'uncle']),
  t('tai', 'ताई', "Father's elder brother's wife", 'paternal', [up(m), sib(m, 'e'), sp(f)], ['tai', 'tayi', 'badi mummy', 'aunty']),
  t('chacha', 'चाचा', "Father's younger brother", 'paternal', [up(m), sib(m, 'y')], ['chacha', 'chachu', 'kaka', 'uncle']),
  t('chachi', 'चाची', "Father's younger brother's wife", 'paternal', [up(m), sib(m, 'y'), sp(f)], ['chachi', 'kaki', 'aunty']),
  t('bua', 'बुआ', "Father's sister", 'paternal', [up(m), sib(f)], ['bua', 'bhua', 'phuphi', 'phuppo', 'pishi', 'aunty']),
  t('phupha', 'फूफा', "Father's sister's husband", 'paternal', [up(m), sib(f), sp(m)], ['phupha', 'fufa', 'phuphar', 'uncle']),
  t('chachera-bhai', 'चचेरा भाई', "Father's brother's son", 'paternal', [up(m), sib(m), down(m)], ['chachera', 'chachazad', 'cousin']),
  t('chacheri-behan', 'चचेरी बहन', "Father's brother's daughter", 'paternal', [up(m), sib(m), down(f)], ['chacheri', 'cousin']),
  t('phuphera-bhai', 'फुफेरा भाई', "Father's sister's son", 'paternal', [up(m), sib(f), down(m)], ['phuphera', 'fufera', 'phuphizad', 'cousin']),
  t('phupheri-behan', 'फुफेरी बहन', "Father's sister's daughter", 'paternal', [up(m), sib(f), down(f)], ['phupheri', 'fuferi', 'cousin']),

  // मातृ पक्ष
  t('nana', 'नाना', 'Maternal grandfather', 'maternal', [up(f), up(m)], ['nana', 'grandfather']),
  t('nani', 'नानी', 'Maternal grandmother', 'maternal', [up(f), up(f)], ['nani', 'grandmother']),
  t('mama', 'मामा', "Mother's brother", 'maternal', [up(f), sib(m)], ['mama', 'mamu', 'mamaji', 'mamoon', 'uncle']),
  t('mami', 'मामी', "Mother's brother's wife", 'maternal', [up(f), sib(m), sp(f)], ['mami', 'mumani', 'aunty']),
  t('mausi', 'मौसी', "Mother's sister", 'maternal', [up(f), sib(f)], ['mausi', 'masi', 'massi', 'khala', 'mashi', 'aunty']),
  t('mausa', 'मौसा', "Mother's sister's husband", 'maternal', [up(f), sib(f), sp(m)], ['mausa', 'masa', 'massar', 'khalu', 'uncle']),
  t('mamera-bhai', 'ममेरा भाई', "Mother's brother's son", 'maternal', [up(f), sib(m), down(m)], ['mamera', 'mamuzad', 'cousin']),
  t('mameri-behan', 'ममेरी बहन', "Mother's brother's daughter", 'maternal', [up(f), sib(m), down(f)], ['mameri', 'cousin']),
  t('mausera-bhai', 'मौसेरा भाई', "Mother's sister's son", 'maternal', [up(f), sib(f), down(m)], ['mausera', 'khalazad', 'cousin']),
  t('mauseri-behan', 'मौसेरी बहन', "Mother's sister's daughter", 'maternal', [up(f), sib(f), down(f)], ['mauseri', 'cousin']),

  // पत्नी पक्ष
  t('sasur-w', 'ससुर (पत्नी के पिता)', "Wife's father", 'wife', [sp(f), up(m)], ['sasur', 'sohra', 'khusar', 'father in law']),
  t('saas-w', 'सास (पत्नी की माँ)', "Wife's mother", 'wife', [sp(f), up(f)], ['saas', 'sass', 'mother in law']),
  t('sala', 'साला', "Wife's brother", 'wife', [sp(f), sib(m)], ['sala', 'saala', 'brother in law']),
  t('salhaj', 'सलहज', "Wife's brother's wife", 'wife', [sp(f), sib(m), sp(f)], ['salhaj', 'sarhaj']),
  t('sali', 'साली', "Wife's sister", 'wife', [sp(f), sib(f)], ['sali', 'saali', 'sister in law']),
  t('sadhu', 'साढ़ू', "Wife's sister's husband", 'wife', [sp(f), sib(f), sp(m)], ['sadhu', 'saandhu', 'sandu', 'hum zulf', 'co brother']),

  // पति पक्ष
  t('sasur-h', 'ससुर (पति के पिता)', "Husband's father", 'husband', [sp(m), up(m)], ['sasur', 'father in law']),
  t('saas-h', 'सास (पति की माँ)', "Husband's mother", 'husband', [sp(m), up(f)], ['saas', 'mother in law']),
  t('jeth', 'जेठ', "Husband's elder brother", 'husband', [sp(m), sib(m, 'e')], ['jeth', 'jethji']),
  t('jethani', 'जेठानी', "Husband's elder brother's wife", 'husband', [sp(m), sib(m, 'e'), sp(f)], ['jethani']),
  t('devar', 'देवर', "Husband's younger brother", 'husband', [sp(m), sib(m, 'y')], ['devar', 'dewar', 'diyor']),
  t('devrani', 'देवरानी', "Husband's younger brother's wife", 'husband', [sp(m), sib(m, 'y'), sp(f)], ['devrani', 'darani']),
  t('nanad', 'ननद', "Husband's sister", 'husband', [sp(m), sib(f)], ['nanad', 'nand', 'nanaan']),
  t('nandoi', 'ननदोई', "Husband's sister's husband", 'husband', [sp(m), sib(f), sp(m)], ['nandoi', 'nandoya']),
];

/** Lower-case, strip matras-insensitive spacing for fuzzy Hinglish matching. */
function norm(s: string): string {
  return s.toLowerCase().replace(/['’]/g, '').replace(/\s+/g, ' ').trim();
}

export function searchTemplates(q: string): RelationTemplate[] {
  const n = norm(q);
  if (!n) return TEMPLATES;
  const scored: { tpl: RelationTemplate; score: number }[] = [];
  for (const tpl of TEMPLATES) {
    const fields = [tpl.hi, tpl.en, tpl.id.replace(/-/g, ' '), ...tpl.keywords].map(norm);
    let score = 0;
    for (const fld of fields) {
      if (fld === n) score = Math.max(score, 100);
      else if (fld.startsWith(n)) score = Math.max(score, 60);
      else if (fld.includes(n)) score = Math.max(score, 30);
    }
    if (score) scored.push({ tpl, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.tpl);
}

export const GROUP_LABEL: Record<RelationTemplate['group'], string> = {
  own: 'अपना परिवार',
  descendants: 'संतान',
  paternal: 'पितृ पक्ष',
  maternal: 'मातृ पक्ष',
  wife: 'पत्नी पक्ष (ससुराल)',
  husband: 'पति पक्ष (ससुराल)',
};
