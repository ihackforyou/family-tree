import type { Lang } from '../types';

/**
 * Label packs: path code -> [Hindi, English, Urdu (roman), Punjabi (roman)].
 *
 * Path code letters (relative to the focus person, read left to right):
 *   F father, M mother, B brother, Z sister, S son, D daughter, H husband, W wife.
 *   e / y in front of B or Z = elder / younger sibling of the previous person.
 * Example: "F.eB" = father's elder brother = ताऊ.
 *
 * Add a new language by adding a column here. Add a new relation by adding a row.
 */
type Row = [hi: string, en: string, ur: string, pa: string];

const T: Record<string, Row> = {
  // अपना परिवार
  F: ['पिता', 'Father', 'Walid (Abbu)', 'Pita ji (Bapu)'],
  M: ['माता', 'Mother', 'Walida (Ammi)', 'Maa (Bebe)'],
  B: ['भाई', 'Brother', 'Bhai', 'Bhra'],
  eB: ['बड़ा भाई', 'Elder brother', 'Bade Bhai', 'Vadda Bhra'],
  yB: ['छोटा भाई', 'Younger brother', 'Chhote Bhai', 'Chhota Bhra'],
  Z: ['बहन', 'Sister', 'Behan', 'Bhain'],
  eZ: ['बड़ी बहन', 'Elder sister', 'Badi Aapa', 'Vaddi Bhain'],
  yZ: ['छोटी बहन', 'Younger sister', 'Chhoti Behan', 'Chhoti Bhain'],
  H: ['पति', 'Husband', 'Shohar', 'Pati (Gharwala)'],
  W: ['पत्नी', 'Wife', 'Biwi (Ahliya)', 'Patni (Gharwali)'],
  S: ['बेटा', 'Son', 'Beta', 'Putt'],
  D: ['बेटी', 'Daughter', 'Beti', 'Dhee'],
  'B.W': ['भाभी', "Brother's wife", 'Bhabhi', 'Bharjai'],
  'eB.W': ['भाभी', "Elder brother's wife", 'Bhabhi', 'Bharjai'],
  'yB.W': ['भाभी (छोटी)', "Younger brother's wife", 'Bhabhi', 'Bharjai'],
  'Z.H': ['जीजा / बहनोई', "Sister's husband", 'Behnoi', 'Jija'],
  'eZ.H': ['जीजा', "Elder sister's husband", 'Behnoi', 'Jija'],
  'yZ.H': ['बहनोई', "Younger sister's husband", 'Behnoi', 'Jija'],
  'S.W': ['बहू', "Son's wife", 'Bahu', 'Nooh'],
  'D.H': ['दामाद', "Daughter's husband", 'Damad', 'Jawai'],
  'B.S': ['भतीजा', "Brother's son", 'Bhateeja', 'Bhateeja'],
  'B.D': ['भतीजी', "Brother's daughter", 'Bhateeji', 'Bhateeji'],
  'Z.S': ['भांजा', "Sister's son", 'Bhanja', 'Bhanja'],
  'Z.D': ['भांजी', "Sister's daughter", 'Bhanji', 'Bhanji'],
  'S.S': ['पोता', "Son's son", 'Pota', 'Pota'],
  'S.D': ['पोती', "Son's daughter", 'Poti', 'Poti'],
  'D.S': ['नाती', "Daughter's son", 'Nawasa', 'Dohta'],
  'D.D': ['नातिन', "Daughter's daughter", 'Nawasi', 'Dohti'],
  'S.S.S': ['परपोता', 'Great-grandson', 'Parpota', 'Parpota'],
  'S.S.D': ['परपोती', 'Great-granddaughter', 'Parpoti', 'Parpoti'],
  'F.W': ['सौतेली माँ', 'Stepmother', 'Sauteli Walida', 'Matrei Maa'],
  'M.H': ['सौतेला पिता', 'Stepfather', 'Sautela Walid', 'Matrea Pita'],
  'W.S': ['सौतेला बेटा', 'Stepson', 'Sautela Beta', 'Matrea Putt'],
  'W.D': ['सौतेली बेटी', 'Stepdaughter', 'Sauteli Beti', 'Matrei Dhee'],
  'H.S': ['सौतेला बेटा', 'Stepson', 'Sautela Beta', 'Matrea Putt'],
  'H.D': ['सौतेली बेटी', 'Stepdaughter', 'Sauteli Beti', 'Matrei Dhee'],

  // पितृ पक्ष
  'F.F': ['दादा', 'Paternal grandfather', 'Dada', 'Dada (Baba ji)'],
  'F.M': ['दादी', 'Paternal grandmother', 'Dadi', 'Dadi'],
  'F.F.F': ['परदादा', 'Paternal great-grandfather', 'Pardada', 'Pardada'],
  'F.F.M': ['परदादी', 'Paternal great-grandmother', 'Pardadi', 'Pardadi'],
  'F.eB': ['ताऊ', "Father's elder brother", 'Taya', 'Taya'],
  'F.eB.W': ['ताई', "Father's elder brother's wife", 'Tai', 'Tayi'],
  'F.yB': ['चाचा', "Father's younger brother", 'Chacha', 'Chacha'],
  'F.yB.W': ['चाची', "Father's younger brother's wife", 'Chachi', 'Chachi'],
  'F.B': ['चाचा / ताऊ', "Father's brother", 'Chacha / Taya', 'Chacha / Taya'],
  'F.B.W': ['चाची / ताई', "Father's brother's wife", 'Chachi / Tai', 'Chachi / Tayi'],
  'F.Z': ['बुआ', "Father's sister", 'Phuphi', 'Bhua'],
  'F.Z.H': ['फूफा', "Father's sister's husband", 'Phupha', 'Phuphar'],
  'F.B.S': ['चचेरा भाई', 'Paternal cousin (uncle\'s son)', 'Chachazad Bhai', 'Chachera Bhra'],
  'F.B.D': ['चचेरी बहन', 'Paternal cousin (uncle\'s daughter)', 'Chachazad Behan', 'Chacheri Bhain'],
  'F.Z.S': ['फुफेरा भाई', 'Paternal cousin (aunt\'s son)', 'Phuphizad Bhai', 'Bhuera Bhra'],
  'F.Z.D': ['फुफेरी बहन', 'Paternal cousin (aunt\'s daughter)', 'Phuphizad Behan', 'Bhueri Bhain'],

  // मातृ पक्ष
  'M.F': ['नाना', 'Maternal grandfather', 'Nana', 'Nana'],
  'M.M': ['नानी', 'Maternal grandmother', 'Nani', 'Nani'],
  'M.F.F': ['परनाना', 'Maternal great-grandfather', 'Parnana', 'Parnana'],
  'M.F.M': ['परनानी', 'Maternal great-grandmother', 'Parnani', 'Parnani'],
  'M.B': ['मामा', "Mother's brother", 'Mamu', 'Mama'],
  'M.B.W': ['मामी', "Mother's brother's wife", 'Mumani', 'Mami'],
  'M.Z': ['मौसी', "Mother's sister", 'Khala', 'Massi'],
  'M.Z.H': ['मौसा', "Mother's sister's husband", 'Khalu', 'Massar'],
  'M.B.S': ['ममेरा भाई', 'Maternal cousin (uncle\'s son)', 'Mamuzad Bhai', 'Mamera Bhra'],
  'M.B.D': ['ममेरी बहन', 'Maternal cousin (uncle\'s daughter)', 'Mamuzad Behan', 'Mameri Bhain'],
  'M.Z.S': ['मौसेरा भाई', 'Maternal cousin (aunt\'s son)', 'Khalazad Bhai', 'Masera Bhra'],
  'M.Z.D': ['मौसेरी बहन', 'Maternal cousin (aunt\'s daughter)', 'Khalazad Behan', 'Maseri Bhain'],

  // पत्नी पक्ष
  'W.F': ['ससुर', 'Father-in-law', 'Sasur (Khusar)', 'Sohra'],
  'W.M': ['सास', 'Mother-in-law', 'Saas (Khushdaman)', 'Sass'],
  'W.F.F': ['दादा ससुर', "Wife's grandfather", 'Dada Sasur', 'Dada Sohra'],
  'W.F.M': ['दादी सास', "Wife's grandmother", 'Dadi Saas', 'Dadi Sass'],
  'W.B': ['साला', "Wife's brother", 'Sala (Biradar-e-nisbati)', 'Sala'],
  'W.eB': ['साला (बड़ा)', "Wife's elder brother", 'Sala', 'Sala'],
  'W.yB': ['साला (छोटा)', "Wife's younger brother", 'Sala', 'Sala'],
  'W.B.W': ['सलहज', "Wife's brother's wife", 'Salhaj', 'Salehar'],
  'W.Z': ['साली', "Wife's sister", 'Sali', 'Saali'],
  'W.Z.H': ['साढ़ू', "Wife's sister's husband", 'Hum-zulf', 'Saandhu'],

  // पति पक्ष
  'H.F': ['ससुर', 'Father-in-law', 'Sasur', 'Sohra'],
  'H.M': ['सास', 'Mother-in-law', 'Saas', 'Sass'],
  'H.eB': ['जेठ', "Husband's elder brother", 'Jeth', 'Jeth'],
  'H.eB.W': ['जेठानी', "Husband's elder brother's wife", 'Jethani', 'Jethani'],
  'H.yB': ['देवर', "Husband's younger brother", 'Devar', 'Diyor'],
  'H.yB.W': ['देवरानी', "Husband's younger brother's wife", 'Devrani', 'Darani'],
  'H.B': ['जेठ / देवर', "Husband's brother", 'Jeth / Devar', 'Jeth / Diyor'],
  'H.B.W': ['जेठानी / देवरानी', "Husband's brother's wife", 'Jethani / Devrani', 'Jethani / Darani'],
  'H.Z': ['ननद', "Husband's sister", 'Nand', 'Nanaan'],
  'H.Z.H': ['ननदोई', "Husband's sister's husband", 'Nandoi', 'Nandoya'],

  // संतान की ससुराल
  'S.W.F': ['समधी', "Son's father-in-law", 'Samdhi', 'Kurham'],
  'S.W.M': ['समधन', "Son's mother-in-law", 'Samdhan', 'Kurmani'],
  'D.H.F': ['समधी', "Daughter's father-in-law", 'Samdhi', 'Kurham'],
  'D.H.M': ['समधन', "Daughter's mother-in-law", 'Samdhan', 'Kurmani'],
};

const LANG_INDEX: Record<Lang, number> = { hi: 0, en: 1, ur: 2, pa: 3 };

export function lookupLabel(code: string, lang: Lang): string | undefined {
  const row = T[code];
  return row ? row[LANG_INDEX[lang]] : undefined;
}

export function hasLabel(code: string): boolean {
  return code in T;
}

export const ALL_CODES = Object.keys(T);
