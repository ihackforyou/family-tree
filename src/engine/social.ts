import type { SocialType } from '../types';

export interface SocialDef {
  type: SocialType;
  hi: string;
  en: string;
  group: 'personal' | 'professional' | 'criminal' | 'digital';
  /** criminal links are drawn in red */
  criminal?: boolean;
  keywords: string[];
}

export const SOCIAL_TYPES: SocialDef[] = [
  { type: 'friend', hi: 'दोस्त', en: 'Friend', group: 'personal', keywords: ['dost', 'mitra', 'yaar', 'friend'] },
  { type: 'neighbour', hi: 'पड़ोसी', en: 'Neighbour', group: 'personal', keywords: ['padosi', 'neighbor'] },
  { type: 'partner', hi: 'प्रेमी / प्रेमिका', en: 'Girlfriend / boyfriend', group: 'personal', keywords: ['gf', 'bf', 'premi', 'premika', 'lover'] },
  { type: 'colleague', hi: 'सहकर्मी', en: 'Colleague', group: 'professional', keywords: ['sahkarmi', 'office'] },
  { type: 'employer', hi: 'मालिक / कर्मचारी', en: 'Employer / employee', group: 'professional', keywords: ['malik', 'naukar', 'boss', 'employee'] },
  { type: 'business', hi: 'व्यापार साझेदार', en: 'Business partner', group: 'professional', keywords: ['partner', 'sajhedar', 'business'] },
  { type: 'landlord', hi: 'मकान मालिक / किरायेदार', en: 'Landlord / tenant', group: 'professional', keywords: ['kirayedar', 'tenant', 'landlord'] },
  { type: 'co-accused', hi: 'सह-अभियुक्त', en: 'Co-accused', group: 'criminal', criminal: true, keywords: ['co accused', 'sah abhiyukt'] },
  { type: 'gang', hi: 'गिरोह सदस्य', en: 'Gang member', group: 'criminal', criminal: true, keywords: ['gang', 'giroh'] },
  { type: 'handler', hi: 'सरगना / संचालक', en: 'Handler / kingpin', group: 'criminal', criminal: true, keywords: ['sargana', 'kingpin', 'boss'] },
  { type: 'money-mule', hi: 'मनी म्यूल', en: 'Money mule', group: 'criminal', criminal: true, keywords: ['mule', 'khata'] },
  { type: 'sim-provider', hi: 'सिम देने वाला', en: 'SIM provider', group: 'criminal', criminal: true, keywords: ['sim'] },
  { type: 'account-provider', hi: 'खाता देने वाला', en: 'Bank-account provider', group: 'criminal', criminal: true, keywords: ['account', 'khata', 'bank'] },
  { type: 'harbourer', hi: 'शरण देने वाला', en: 'Harbourer', group: 'criminal', criminal: true, keywords: ['sharan', 'harbour'] },
  { type: 'carrier', hi: 'कैरियर', en: 'Carrier', group: 'criminal', criminal: true, keywords: ['carrier', 'courier'] },
  { type: 'surety', hi: 'जमानतदार', en: 'Surety', group: 'criminal', keywords: ['jamanat', 'bail'] },
  { type: 'cdr-contact', hi: 'CDR संपर्क', en: 'Frequent CDR contact', group: 'digital', keywords: ['cdr', 'call'] },
  { type: 'social-media', hi: 'सोशल मीडिया मित्र', en: 'Social media contact', group: 'digital', keywords: ['instagram', 'facebook', 'whatsapp', 'social'] },
  { type: 'upi-counterparty', hi: 'लेन-देन पक्षकार', en: 'UPI / bank counterparty', group: 'digital', keywords: ['upi', 'transaction', 'len den'] },
  { type: 'shared-device', hi: 'एक ही डिवाइस / IMEI', en: 'Shared device / IMEI', group: 'digital', keywords: ['imei', 'device', 'mobile'] },
  { type: 'other', hi: 'अन्य सहयोगी', en: 'Other associate', group: 'personal', keywords: ['associate', 'sahyogi'] },
];

const BY_TYPE = new Map(SOCIAL_TYPES.map((s) => [s.type, s]));

export function socialLabel(t: SocialType, lang: 'hi' | 'en'): string {
  const d = BY_TYPE.get(t) ?? BY_TYPE.get('other')!;
  return lang === 'hi' ? d.hi : d.en;
}

export function isCriminal(t: SocialType | undefined): boolean {
  return !!(t && BY_TYPE.get(t)?.criminal);
}
