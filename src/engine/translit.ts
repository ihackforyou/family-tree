/**
 * Very small Devanagari -> Roman transliteration, only for search:
 * "राहुल" should be found by typing "rahul", "Rahul", "rahool".
 * We compare consonant skeletons, so vowel spelling differences do not matter.
 */
const CONS: Record<string, string> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n',
  ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n', त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n',
  प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l', व: 'v', श: 'sh',
  ष: 'sh', स: 's', ह: 'h', ळ: 'l',
};
const NUKTA: Record<string, string> = { क: 'q', ख: 'kh', ग: 'g', ज: 'z', फ: 'f', ड: 'r', ढ: 'rh' };
const VOWELS: Record<string, string> = {
  अ: 'a', आ: 'aa', इ: 'i', ई: 'ee', उ: 'u', ऊ: 'oo', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऋ: 'ri',
};
const MATRAS: Record<string, string> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ृ': 'ri',
  'ं': 'n', 'ँ': 'n', 'ः': 'h',
};

export function devToRoman(s: string): string {
  const chars = [...s.normalize('NFC')];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (CONS[c]) {
      let base = CONS[c];
      if (chars[i + 1] === '़') { base = NUKTA[c] ?? base; i++; }
      const next = chars[i + 1];
      out += base;
      if (next === '्') { i++; continue; } // virama: no vowel
      if (next && MATRAS[next] !== undefined && !'ंँः'.includes(next)) continue; // matra follows
      out += 'a';
    } else if (MATRAS[c] !== undefined) {
      out += MATRAS[c];
    } else if (VOWELS[c]) {
      out += VOWELS[c];
    } else if (c === '़' || c === '्') {
      continue;
    } else {
      out += c;
    }
  }
  return out;
}

/** Consonant skeleton used for fuzzy name matching. */
export function skeleton(s: string): string {
  return devToRoman(s.toLowerCase())
    .replace(/ph/g, 'f')
    .replace(/sh/g, 's')
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/q/g, 'k')
    .replace(/(.)h/g, '$1') // aspirates: kh -> k, bh -> b
    .replace(/[aeiouy\s.'’-]/g, '')
    .replace(/(.)\1+/g, '$1');
}
