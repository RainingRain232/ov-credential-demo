import { EmitFn } from './input.guardrails';
import { ETHICS_CHECKS } from './ethics.guardrails';

const PII_PATTERNS = [
  /\b[0-9]{9}\b/,
  /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\b/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14})\b/
];

const TOPIC_ANCHOR_TERMS = [
  'transport', 'credential', 'eligib', 'rule', 'qualify', 'apply', 'wallet',
  'student', 'citizen', 'age', 'yes', 'no', 'unfortunately', 'congratulations',
  'issued', 'check', 'requirement', 'help', 'assist',
  'youth', 'young', 'route', 'ov', 'under 18', 'over 18', 'free travel', 'subsidised',
  'vervoer', 'geschikt', 'aanvra', 'regel', 'burger', 'leeftijd', 'ja', 'nee',
  'helaas', 'gefeliciteerd', 'uitgegeven', 'controleer', 'vereist', 'jeugd', 'studenten',
  'onder 18', 'ouder', 'inschrijving', 'onderwijs'
];

export function checkSingleQuestion(text: string): { passed: boolean; reason?: string } {
  const questionMarks = (text.match(/\?/g) || []).length;
  if (questionMarks > 1) {
    return {
      passed: false,
      reason: `Antwoord bevat ${questionMarks} vragen — maximum is 1.`
    };
  }
  return { passed: true };
}

export function checkResponseLength(text: string): { passed: boolean; reason?: string; wordCount: number } {
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount > 200) {
    return {
      passed: false,
      reason: `Antwoord is ${wordCount} woorden — maximum is 200.`,
      wordCount
    };
  }
  return { passed: true, wordCount };
}

export function checkNoPIILeak(text: string): { passed: boolean; reason?: string } {
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(text)) {
      return {
        passed: false,
        reason: 'Antwoord bevat mogelijke persoonsgegevens — geblokkeerd voor privacy.'
      };
    }
  }
  return { passed: true };
}

export function checkTopicAdherence(text: string): { passed: boolean; reason?: string } {
  const lower = text.toLowerCase();
  const isOnTopic = TOPIC_ANCHOR_TERMS.some(term => lower.includes(term));
  if (!isOnTopic) {
    return {
      passed: false,
      reason: 'Antwoord lijkt niet over OV-credentials te gaan.'
    };
  }
  return { passed: true };
}

export function checkConsentGate(
  text: string,
  conversationHistory: Array<{ role: string; content: string }>
): { passed: boolean; reason?: string } {
  const actionPhrases = ['checking your wallet', 'applying for', 'i have applied', 'submitting your application',
    'wallet controleren', 'aanvragen voor', 'heb ik aangevraagd', 'aanvraag indienen', 'credential aanvragen', 'geschiktheid controleren'];
  const requiresConsent = actionPhrases.some(phrase => text.toLowerCase().includes(phrase));

  if (!requiresConsent) return { passed: true };

  // Look for explicit user consent in recent history
  const recentUserMessages = conversationHistory
    .filter(m => m.role === 'user')
    .slice(-4)
    .map(m => m.content.toLowerCase());

  const consentGiven = recentUserMessages.some(m =>
    m.includes('yes') || m.includes('please') || m.includes('go ahead') || m.includes('sure') || m.includes('ok')
  );

  if (!consentGiven) {
    return {
      passed: false,
      reason: 'Actie uitgevoerd zonder expliciete toestemming van de gebruiker.'
    };
  }
  return { passed: true };
}

export function runOutputGuardrails(
  text: string,
  conversationHistory: Array<{ role: string; content: string }>,
  emit: EmitFn
): { passed: boolean; blockReason?: string } {
  const checks: Array<{ name: string; fn: () => { passed: boolean; reason?: string } }> = [
    { name: 'Enkele vraag', fn: () => checkSingleQuestion(text) },
    { name: 'Antwoordlengte', fn: () => checkResponseLength(text) },
    { name: 'Geen PII-lek', fn: () => checkNoPIILeak(text) },
    { name: 'Onderwerpnaleving', fn: () => checkTopicAdherence(text) },
    { name: 'Toestemmingspoort', fn: () => checkConsentGate(text, conversationHistory) }
  ];

  for (const check of checks) {
    const result = check.fn();
    emit({
      type: result.passed ? 'CHECK_PASSED' : 'CHECK_FAILED',
      checkName: check.name,
      zone: 'OUTPUT',
      reason: result.reason
    });

    if (!result.passed) {
      return { passed: false, blockReason: result.reason };
    }
  }

  // ─── Ethische guardrails ──────────────────────────────────────────
  for (const check of ETHICS_CHECKS) {
    const result = check.fn(text);
    emit({
      type: result.passed ? 'CHECK_PASSED' : 'CHECK_FAILED',
      checkName: check.name,
      zone: 'OUTPUT',
      category: 'ETHICS',
      reason: result.reason
    });

    if (!result.passed) {
      return { passed: false, blockReason: result.reason };
    }
  }

  return { passed: true };
}
