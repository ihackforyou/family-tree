import type { CaseFile, Person } from './types';
import { addEdge, addPerson, applyTemplate, newPerson, uid } from './engine/ops';
import { TEMPLATES } from './engine/templates';
import { addDemoAvatars } from './demoAvatar';

const tpl = (id: string) => TEMPLATES.find((t) => t.id === id)!;

export function emptyCase(title: string, firNo?: string): CaseFile {
  return { id: uid('c_'), title, firNo, persons: {}, edges: {}, audit: [], createdAt: Date.now(), updatedAt: Date.now() };
}

/** Fictional sample case so a new user sees how the tree works. All names are made up. */
export function demoCase(): CaseFile {
  const cf = emptyCase('Demo: Online fraud (काल्पनिक केस)', '000/2026');
  cf.policeStation = 'Cyber Cell (demo)';
  const s = addPerson(cf, newPerson({
    name: 'राहुल वर्मा', gender: 'male', dob: '1992', role: 'suspect', status: 'absconding',
    aliases: ['Rahul V', 'RV_King'], mobiles: ['98xxxxxx01'], firs: ['000/2026'], address: 'ग्राम रामपुर (demo)',
  }));
  cf.focusId = s.id;
  const add = (anchor: string, t: string, p: Partial<Person> & { name: string }, conf: 'confirmed' | 'probable' | 'suspected' = 'confirmed') =>
    applyTemplate(cf, anchor, tpl(t), { person: p }, { confidence: conf, source: 'पूछताछ (demo)' });

  const father = add(s.id, 'father', { name: 'राजेश वर्मा', dob: '1965' });
  add(s.id, 'mother', { name: 'सुनीता देवी', dob: '1969' });
  add(s.id, 'dada', { name: 'रामप्रसाद वर्मा', status: 'deceased' });
  add(s.id, 'dadi', { name: 'कमला देवी' });
  add(s.id, 'nana', { name: 'हरिओम शर्मा' }, 'probable');
  const tau = add(s.id, 'tau', { name: 'महेश वर्मा', dob: '1960' });
  add(tau, 'wife', { name: 'सरला वर्मा' });
  const chachaId = add(s.id, 'chacha', { name: 'दिनेश वर्मा', dob: '1972' });
  add(chachaId, 'son', { name: 'मोनू वर्मा', role: 'accused', status: 'arrested', firs: ['000/2026'], dob: '1998' });
  const bua = add(s.id, 'bua', { name: 'कविता' });
  add(bua, 'husband', { name: 'सुरेश कुमार' }, 'probable');
  const mama = add(s.id, 'mama', { name: 'अनिल शर्मा' });
  add(mama, 'son', { name: 'गौरव शर्मा' }, 'probable');
  add(s.id, 'mausi', { name: 'रेखा' }, 'suspected');
  add(s.id, 'younger-brother', { name: 'अमित वर्मा', dob: '1996' });
  const sister = add(s.id, 'elder-sister', { name: 'नेहा', dob: '1989' });
  add(sister, 'husband', { name: 'विनोद सिंह', mobiles: ['97xxxxxx22'] });
  const wife = add(s.id, 'wife', { name: 'प्रिया वर्मा', dob: '1994' });
  add(wife, 'father', { name: 'ओमप्रकाश गुप्ता' });
  add(wife, 'mother', { name: 'मीना गुप्ता' });
  const sala = add(s.id, 'sala', { name: 'विकास गुप्ता', role: 'suspect', mobiles: ['99xxxxxx33'], notes: 'इसके खाते में fraud का पैसा आया (demo)' });
  add(s.id, 'sali', { name: 'पूजा गुप्ता' }, 'probable');
  add(s.id, 'son', { name: 'आरव वर्मा', dob: '2019' });
  void father;

  const friend = addPerson(cf, newPerson({ name: 'सोनू उर्फ़ टाइगर', gender: 'male', role: 'associate', aliases: ['Tiger'], mobiles: ['96xxxxxx44'] }));
  addEdge(cf, 'social', s.id, friend.id, { subtype: 'gang', confidence: 'probable', source: 'CDR (demo)' });
  const mule = addPerson(cf, newPerson({ name: 'पप्पू यादव', gender: 'male', role: 'associate' }));
  addEdge(cf, 'social', sala, mule.id, { subtype: 'money-mule', confidence: 'confirmed', source: 'Bank statement (demo)' });
  const sim = addPerson(cf, newPerson({ name: 'मोबाइल शॉप वाला (नाम अज्ञात)', gender: 'male', role: 'associate', isGhost: false }));
  addEdge(cf, 'social', friend.id, sim.id, { subtype: 'sim-provider', confidence: 'suspected', source: 'CAF (demo)' });
  const victim = addPerson(cf, newPerson({ name: 'शिकायतकर्ता (demo)', gender: 'female', role: 'victim' }));
  addEdge(cf, 'social', s.id, victim.id, { subtype: 'upi-counterparty', confidence: 'confirmed', source: 'NCRP complaint (demo)' });

  cf.audit.push({ ts: Date.now(), user: 'system', action: 'demo', detail: 'Demo case बनाया गया' });
  return addDemoAvatars(cf);
}
