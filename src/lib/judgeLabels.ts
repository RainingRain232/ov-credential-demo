import { JudgeCheck, JudgeResult } from './types';

export const QUALITY_CHECK_LABELS: Record<string, string> = {
  on_topic:           'Relevant',
  single_question:    'Enkele vraag',
  appropriate_length: 'Lengte OK',
  no_pii_leaked:      'Geen PII-lek',
  professional_tone:  'Professionele toon',
  consent_respected:  'Toestemming gerespecteerd',
};

export const ETHICS_CHECK_LABELS: Record<string, string> = {
  no_bias_discrimination: 'Geen bias of discriminatie',
  no_deception:           'Geen misleiding',
  no_manipulation:        'Geen manipulatie of druk',
  ai_transparency:        'AI-transparantie',
};

/** Splits judge checks into quality and ethics groups, preserving label order. */
export function splitJudgeChecks(result: JudgeResult): {
  quality: Array<[string, JudgeCheck]>;
  ethics: Array<[string, JudgeCheck]>;
} {
  const checks = result.checks as unknown as Record<string, JudgeCheck | undefined>;
  const pick = (labels: Record<string, string>) =>
    Object.keys(labels).filter(k => checks[k]).map(k => [k, checks[k]!] as [string, JudgeCheck]);
  return { quality: pick(QUALITY_CHECK_LABELS), ethics: pick(ETHICS_CHECK_LABELS) };
}

export function judgeLabel(key: string): string {
  return QUALITY_CHECK_LABELS[key] ?? ETHICS_CHECK_LABELS[key] ?? key;
}
