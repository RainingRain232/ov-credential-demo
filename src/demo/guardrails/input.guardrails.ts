import { GuardrailEvent } from '@/lib/types';

export interface GuardrailResult {
  passed: boolean;
  checkName: string;
  reason?: string;
}

// Rate limiting: track message timestamps per session
const sessionMessageTimes = new Map<string, number[]>();

// PII detection patterns
const PII_PATTERNS = [
  { name: 'BSN (Burgerservicenummer)', regex: /\b[0-9]{9}\b/ }, // Simplified; full 11-proof is complex
  { name: 'IBAN', regex: /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\b/ },
  { name: 'Passport Number', regex: /\b[A-Z]{1,3}[0-9]{6,9}\b/ },
  { name: 'Credit Card', regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/ },
  { name: 'Dutch Phone', regex: /\b(?:\+31|0031|0)[\s-]?(?:[1-9][0-9]{8}|6[0-9]{8})\b/ },
  { name: 'Email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/ }
];

// Prompt injection patterns
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/i,
  /forget\s+(your\s+)?(previous\s+)?instructions?/i,
  /you\s+are\s+now\s+(a|an)/i,
  /system\s+prompt/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /override\s+(your\s+)?instructions?/i,
  /act\s+as\s+(if\s+you\s+are\s+)?(?!a\s+(transport|public))/i
];

// Topic keywords — at least one must be present (unless it's early in conversation)
const TOPIC_KEYWORDS = [
  'transport', 'ov', 'bus', 'train', 'tram', 'metro', 'credential', 'pass', 'card',
  'student', 'eligible', 'qualify', 'apply', 'application', 'age', 'citizen', 'university',
  'travel', 'public', 'rules', 'requirement', 'check', 'wallet', 'yes', 'no', 'hello',
  'hi', 'help', 'want', 'need', 'can', 'please', 'thank', 'how', 'what', 'when',
  'youth', 'young', 'under 18', 'over 18', '18', 'route', 'free', 'subsidised',
  'vervoer', 'trein', 'geschikt', 'aanvra', 'leeftijd', 'burger', 'universiteit',
  'reizen', 'openbaar', 'regels', 'vereist', 'controleer', 'ja', 'nee', 'hallo',
  'hoi', 'hulp', 'wil', 'graag', 'alsjeblieft', 'dank', 'hoe', 'wat', 'wanneer',
  'jeugd', 'jong', 'onder 18', 'ouder', 'gratis', 'gesubsidieerd', 'inschrijving'
];

export function checkRateLimit(sessionId: string): GuardrailResult {
  const now = Date.now();
  const times = sessionMessageTimes.get(sessionId) || [];
  const recentTimes = times.filter(t => now - t < 60000); // last 60 seconds

  if (recentTimes.length >= 10) {
    return {
      passed: false,
      checkName: 'Snelheidslimiet',
      reason: 'Te veel berichten. Wacht even voordat je verdergaat.'
    };
  }

  recentTimes.push(now);
  sessionMessageTimes.set(sessionId, recentTimes);
  return { passed: true, checkName: 'Snelheidslimiet' };
}

export function checkPII(message: string): GuardrailResult {
  for (const pattern of PII_PATTERNS) {
    if (pattern.regex.test(message)) {
      return {
        passed: false,
        checkName: 'PII-detectie',
        reason: `Deel alsjeblieft geen persoonlijke identificatiegegevens (${pattern.name}) in de chat. Je privacy wordt beschermd via je digitale wallet.`
      };
    }
  }
  return { passed: true, checkName: 'PII-detectie' };
}

export function checkInjection(message: string): GuardrailResult {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return {
        passed: false,
        checkName: 'Injectiedetectie',
        reason: 'Ik kan alleen helpen met vragen over OV-credentials.'
      };
    }
  }
  return { passed: true, checkName: 'Injectiedetectie' };
}

export function checkTopicRelevance(message: string, messageCount: number): GuardrailResult {
  // Always pass the first 2 messages (greeting/intro)
  if (messageCount <= 2) {
    return { passed: true, checkName: 'Onderwerprelevantie' };
  }

  const lower = message.toLowerCase();
  const isRelevant = TOPIC_KEYWORDS.some(kw => lower.includes(kw));

  if (!isRelevant) {
    return {
      passed: false,
      checkName: 'Onderwerprelevantie',
      reason: 'Ik kan alleen helpen met vragen over OV-credentials voor het openbaar vervoer.'
    };
  }
  return { passed: true, checkName: 'Onderwerprelevantie' };
}

export function checkMessageLength(message: string): GuardrailResult {
  if (message.length > 500) {
    return {
      passed: false,
      checkName: 'Berichtlengte',
      reason: 'Je bericht is te lang. Houd berichten onder de 500 tekens.'
    };
  }
  return { passed: true, checkName: 'Berichtlengte' };
}

export type EmitFn = (event: GuardrailEvent) => void;

export async function runInputGuardrails(
  message: string,
  sessionId: string,
  messageCount: number,
  emit: EmitFn
): Promise<{ passed: boolean; blockReason?: string }> {
  const checks = [
    () => checkRateLimit(sessionId),
    () => checkMessageLength(message),
    () => checkPII(message),
    () => checkInjection(message),
    () => checkTopicRelevance(message, messageCount)
  ];

  for (const check of checks) {
    const result = check();
    emit({
      type: result.passed ? 'CHECK_PASSED' : 'CHECK_FAILED',
      checkName: result.checkName,
      zone: 'INPUT',
      reason: result.reason
    });

    if (!result.passed) {
      return { passed: false, blockReason: result.reason };
    }
  }

  return { passed: true };
}
