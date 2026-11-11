export type Gender = 'male' | 'female' | 'other' | 'unknown';
export type Role = 'suspect' | 'accused' | 'witness' | 'victim' | 'relative' | 'associate' | 'unknown';
export type Status = 'alive' | 'deceased' | 'absconding' | 'arrested' | 'renounced';
export type Confidence = 'confirmed' | 'probable' | 'suspected';

export interface Person {
  id: string;
  name: string;
  aliases: string[];
  gender: Gender;
  /** ISO date or year (YYYY). Used to decide elder / younger. */
  dob?: string;
  approxAge?: number;
  photo?: string; // data URL or remote URL
  role: Role;
  status: Status;
  religion?: string;
  mobiles: string[];
  /** Only the last 4 digits are ever stored. */
  aadhaarLast4?: string;
  address?: string;
  firs: string[];
  notes?: string;
  /** Placeholder created automatically for an unknown in-between relative. */
  isGhost?: boolean;
  /** Elder / younger hint relative to one sibling, when no DOB is known. */
  seniority?: { ref: string; elder: boolean };
  createdAt: number;
}

export type EdgeKind = 'parent' | 'spouse' | 'sibling' | 'social';

export type ParentSubtype = 'biological' | 'adoptive' | 'step' | 'foster' | 'guardian';
export type SpouseSubtype = 'married' | 'divorced' | 'separated' | 'widowed' | 'live-in';
export type SiblingSubtype = 'full' | 'half' | 'step' | 'fictive';
export type SocialType =
  | 'friend' | 'neighbour' | 'partner' | 'colleague' | 'employer' | 'business'
  | 'landlord' | 'co-accused' | 'gang' | 'handler' | 'money-mule' | 'sim-provider'
  | 'account-provider' | 'harbourer' | 'carrier' | 'surety' | 'cdr-contact'
  | 'social-media' | 'upi-counterparty' | 'shared-device' | 'other';

export interface Edge {
  id: string;
  kind: EdgeKind;
  /** parent edge: from = parent, to = child. Others: order does not matter except social direction. */
  from: string;
  to: string;
  subtype?: ParentSubtype | SpouseSubtype | SiblingSubtype | SocialType;
  confidence: Confidence;
  source?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  createdAt: number;
}

export interface CaseFile {
  id: string;
  title: string;
  firNo?: string;
  policeStation?: string;
  focusId?: string;
  persons: Record<string, Person>;
  edges: Record<string, Edge>;
  audit: AuditEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface AuditEntry {
  ts: number;
  user: string;
  action: string;
  detail: string;
}

export type Lang = 'hi' | 'en' | 'ur' | 'pa';
