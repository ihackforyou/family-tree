import type { CaseFile, Person, SocialType } from './types';
import { addEdge, addPerson, applyTemplate, newPerson } from './engine/ops';
import { TEMPLATES } from './engine/templates';
import { emptyCase } from './demo';
import { addDemoAvatars } from './demoAvatar';

const tpl = (id: string) => TEMPLATES.find((t) => t.id === id)!;
const FIR = '0312/2026';

/**
 * Fictional demo matching the Evidence Board demo "Zenith Capital" ₹5 crore fraud:
 * 10 accused across three families (Rathore, Saini, Yadav) and their gang links.
 * All names, numbers and accounts are made up; numbers are masked.
 */
export function zenithDemoCase(): CaseFile {
  const cf = emptyCase('Demo: Zenith Capital ₹5 Cr fraud — accused network', FIR);
  cf.policeStation = 'Cyber Crime PS, Nagarpur (demo)';
  const src = 'Investigation (demo)';

  const accused = (p: Partial<Person> & { name: string }): Partial<Person> & { name: string } => ({
    gender: 'male', role: 'accused', firs: [FIR], ...p,
  });
  const rel = (anchor: string, t: string, p: Partial<Person> & { name: string }, confidence: 'confirmed' | 'probable' | 'suspected' = 'confirmed') =>
    applyTemplate(cf, anchor, tpl(t), { person: p }, { confidence, source: src });
  const social = (from: string, to: string, subtype: SocialType, source: string, confidence: 'confirmed' | 'probable' | 'suspected' = 'confirmed') =>
    addEdge(cf, 'social', from, to, { subtype, confidence, source });
  const person = (p: Partial<Person> & { name: string }) => addPerson(cf, newPerson(p)).id;

  // ---- A-1 and the Rathore / Mehta family
  const deepak = person(accused({
    name: 'Deepak Rathore', role: 'suspect', status: 'absconding', approxAge: 38, aliases: ['DR', 'Boss'],
    mobiles: ['99XXX X7701'], address: 'Shanti Nagar, Nagarpur (demo)',
    source: 'USDT wallet TQx…9fA2 withdrawn from the broadband line at his house; money from Pooja’s and RK Traders’ accounts ends with him.',
    evidence: 'Wallet IP logs; L2 bank statements; UPI reimbursement to Faizal for the three domains.',
    notes: 'A-1, kingpin. Absconding.',
  }));
  cf.focusId = deepak;
  rel(deepak, 'father', { name: 'Mahendra Rathore', approxAge: 66, notes: 'Retired; not accused.' });
  rel(deepak, 'mother', { name: 'Kamla Rathore', approxAge: 61 });
  const arjun = rel(deepak, 'younger-brother', accused({
    name: 'Arjun Rathore', status: 'arrested', approxAge: 33, mobiles: ['88XXX X6650'],
    source: 'Proprietor of RK Traders, the current account that received ₹95 L (L1-03); "Zenith support" number in his name.',
    evidence: 'Bank KYC + statement; CDR of 88XXX X6650; ATM CCTV of ₹18 L cash withdrawals.',
    notes: 'A-2. Recruited the mule accounts.',
  }));
  const pooja = rel(deepak, 'wife', accused({
    name: 'Pooja Rathore', gender: 'female', approxAge: 34,
    source: 'Holder of L1-10 (₹37 L) and of the L2 account XXXX9081 (₹1.4 Cr).',
    evidence: 'Bank statements of both accounts; debit card used at Deepak’s address.',
    notes: 'A-3.',
  }));
  rel(pooja, 'father', { name: 'Ramesh Mehta', approxAge: 63, notes: 'Not accused.' });
  rel(deepak, 'sala', accused({
    name: 'Kunal Mehta', approxAge: 30, mobiles: ['97XXX X3390'],
    source: 'Proprietor of Shree Balaji Enterprises (L1-06, ₹72 L); bought USDT with ₹1.1 Cr from L2 XXXX4402.',
    evidence: 'P2P exchange trade logs; wallet transfers to TQx…9fA2.',
    notes: 'A-4. Pooja’s brother.',
  }));
  rel(deepak, 'son', { name: 'Vivaan Rathore', approxAge: 9, notes: 'Minor.' });

  // ---- callers and the Yadav family
  const sameer = person(accused({
    name: 'Sameer Khan', role: 'suspect', status: 'absconding', approxAge: 29, aliases: ['"Riya Kapoor"', '"IT officer"'],
    mobiles: ['98XXX X4521', '62XXX X9034'],
    source: 'Both fraud SIMs (WhatsApp "Riya Kapoor" and the "Income Tax officer" number) ran in one handset, IMEI …1203.',
    evidence: 'CDR, IPDR and IMEI analysis; WhatsApp group admin records.',
    notes: 'A-5. Works for Deepak.',
  }));
  const manish = person(accused({
    name: 'Manish Yadav', role: 'suspect', status: 'absconding', approxAge: 31, aliases: ['"CBI Inspector Vikram Rao"'],
    mobiles: ['70XXX X1187'],
    source: 'Made the WhatsApp video call as "CBI Inspector" and held the victim in a 48-hour "digital arrest".',
    evidence: 'WhatsApp subscriber info and login IPs; screenshot of the video call.',
    notes: 'A-6.',
  }));
  rel(manish, 'father', accused({
    name: 'Suresh Yadav', approxAge: 58, status: 'arrested',
    source: 'Holder of L1-02, which received ₹48 L.',
    evidence: 'Bank KYC + statement; statement that he gave the account to Arjun for a commission.',
    notes: 'A-7.',
  }));

  // ---- SIM provider and the Saini cousins
  const nitin = person(accused({
    name: 'Nitin Saini', approxAge: 27, status: 'arrested', mobiles: ['96XXX X2214'],
    source: 'CAF of both fraud SIMs shows the PoS ID of his shop, Saini Mobile Point, activated on forged KYC.',
    evidence: 'CAF, PoS activation logs, forged KYC documents.',
    notes: 'A-8. SIM provider.',
  }));
  rel(nitin, 'father', { name: 'Rakesh Saini', approxAge: 55 });
  const mahesh = rel(nitin, 'chacha', { name: 'Mahesh Saini', approxAge: 51 });
  const ravi = rel(mahesh, 'son', accused({
    name: 'Ravi Saini', approxAge: 24, status: 'arrested', mobiles: ['93XXX X5108'],
    source: 'Holder of L1-01, which received ₹62 L; cash withdrawn at ATMs.',
    evidence: 'Bank statement; ATM CCTV; his statement naming Arjun.',
    notes: 'A-9. Nitin’s cousin.',
  }));

  // ---- web developer
  const faizal = person(accused({
    name: 'Faizal Ansari', approxAge: 26, mobiles: ['91XXX X8842'],
    source: 'Registrant e-mail fz.devworks@mail.example on all three fake domains; author "FZ-DEV" in the fake FIR / warrant PDFs.',
    evidence: 'WHOIS records; PDF metadata; UPI payment for the domains, reimbursed by Deepak.',
    notes: 'A-10.',
  }));

  // ---- other mules and the victim
  const ankit = person({ name: 'Ankit Sharma', gender: 'male', role: 'associate', approxAge: 23, source: 'Holder of L1-08 (₹29 L).', evidence: 'Bank statement.', notes: 'Mule; Ravi’s friend.' });
  const victim = person({ name: 'Harish Chandra Bansal', gender: 'male', role: 'victim', approxAge: 66, source: 'Complainant, NCRP 31209260004127.', evidence: 'WhatsApp chats, call logs, e-mails, PDFs, bank statements.' });

  social(deepak, sameer, 'employer', 'Salary payments + statement of Ravi');
  social(deepak, faizal, 'business', 'UPI reimbursement for domains');
  social(sameer, manish, 'gang', 'Same handler, CDR common contacts', 'probable');
  social(sameer, nitin, 'sim-provider', 'CAF / PoS records');
  social(manish, nitin, 'sim-provider', 'CAF / PoS records', 'probable');
  social(arjun, ravi, 'account-provider', 'Statement of Ravi; transfers');
  social(arjun, manish, 'co-accused', 'Common case');
  social(arjun, ankit, 'account-provider', 'Bank records');
  social(ravi, ankit, 'friend', 'Statement of Ankit');
  social(sameer, victim, 'cdr-contact', 'Victim call log / WhatsApp');
  social(manish, victim, 'cdr-contact', 'WhatsApp video call');
  void pooja;

  // mules recruited by Arjun whose family is not yet known
  for (const [name, acc] of [['Mohd. Aslam', 'L1-04 ₹38 L'], ['Sunita Devi', 'L1-05 ₹41 L'], ['Vikas Kumar', 'L1-07 ₹33 L'], ['Gulshan (full name unknown)', 'L1-09 ₹45 L']] as const) {
    const id = person({ name, gender: name === 'Sunita Devi' ? 'female' : 'male', role: 'associate', source: `Holder of ${acc}.`, evidence: 'Bank KYC + statement.', notes: 'Mule account.' });
    social(arjun, id, 'account-provider', 'Bank records', 'probable');
  }

  cf.audit.push({ ts: Date.now(), user: 'system', action: 'demo', detail: 'Demo case: Zenith Capital fraud' });
  return addDemoAvatars(cf);
}
