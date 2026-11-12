import type { Confidence, Gender, Role, SocialType } from '../types';
import type { TStep } from '../engine/templates';

/** Actions proposed by the server AI assistant (/api/v1/ai/command, app "family"). */
interface PersonFields {
  name: string;
  gender: Gender;
  role?: Role;
  approxAge?: number;
  mobile?: string;
  address?: string;
  notes?: string;
  confidence: Confidence;
}

export type FamilyAction =
  | ({ op: 'addRelative'; ref: string; anchor: string; steps: TStep[] } & PersonFields)
  | ({ op: 'addAssociate'; ref: string; anchor: string; socialType: SocialType } & PersonFields)
  | ({ op: 'addPerson'; ref: string } & PersonFields)
  | { op: 'relate'; a: string; b: string; steps?: TStep[]; socialType?: SocialType; confidence: Confidence };

export interface AiStatus {
  enabled: boolean;
  models: { default: string; lite: string };
  dailyLimit: number;
  usedToday: number;
  maxChars: { command: number; extract: number };
}

export interface AiResult {
  reply: string;
  actions: FamilyAction[];
  questions: string[];
  warnings: string[];
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}
