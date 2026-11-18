// ─── ETHISCHE GUARDRAILS ───────────────────────────────────────────────
// Regelgebaseerde uitvoerfilters die controleren of een antwoord van de LLM
// ethisch verantwoord is: geen bias/discriminatie, geen misleiding,
// geen manipulatie en eerlijk over het feit dat het een AI is.
//
// Let op: leeftijd, studentstatus en inschrijving zijn in dit domein
// legitieme geschiktheidscriteria en worden daarom NIET als discriminerend
// behandeld.

export interface EthicsCheckResult {
  passed: boolean;
  reason?: string;
}

// Beschermde kenmerken (Art. 1 Grondwet / AWGB) — mogen nooit de grond zijn
// voor een besluit of een uitspraak over de gebruiker.
const PROTECTED_ATTRIBUTES =
  '(afkomst|etniciteit|etnische achtergrond|ras|huidskleur|religie|geloof|godsdienst|' +
  'geslacht|gender|seksuele (geaardheid|voorkeur)|handicap|beperking|politieke (voorkeur|overtuiging)|' +
  'ethnicity|race|skin colou?r|religion|faith|sex|sexual orientation|disability)';

// Groepsaanduidingen die vaak in stereotyperende generalisaties voorkomen
const GROUP_TERMS =
  '(moslims?|joden|christenen|vrouwen|mannen|buitenlanders|migranten|allochtonen|vluchtelingen|' +
  'asielzoekers|marokkanen|turken|surinamers|polen|antillianen|homo\'?s|transgenders?|gehandicapten|' +
  'muslims|jews|christians|women|men|foreigners|immigrants|refugees|gays|disabled people)';

const BIAS_PATTERNS: RegExp[] = [
  // Besluit/uitspraak gebaseerd op een beschermd kenmerk
  new RegExp(`\\b(vanwege|omdat|op basis van|gezien|door|because of|due to|based on)\\s+(uw|je|jouw|zijn|haar|your|their)\\s+${PROTECTED_ATTRIBUTES}`, 'i'),
  // Generalisaties: "alle vrouwen zijn ...", "buitenlanders zijn altijd ..."
  new RegExp(`\\b(alle|de meeste|zulke|all|most)\\s+${GROUP_TERMS}\\s+(zijn|kunnen|willen|hebben|doen|are|can|want|have)\\b`, 'i'),
  new RegExp(`\\b${GROUP_TERMS}\\s+(zijn|are)\\s+(altijd|nooit|meestal|nu eenmaal|van nature|always|never|naturally)\\b`, 'i'),
  new RegExp(`\\btypisch\\s+(voor\\s+)?${GROUP_TERMS}`, 'i'),
  // Uitsluiting op grond van groepslidmaatschap
  new RegExp(`\\b(geen|niet voor|not for|no)\\s+${GROUP_TERMS}\\b`, 'i'),
];

const DEROGATORY_TERMS = [
  'achterlijk', 'debiel', 'mongool', 'kankerlijer', 'zielig persoon', 'profiteur', 'uitvreter', 'gelukzoeker',
  'retarded', 'moron', 'freeloader', 'parasite'
];

// Misleiding: valse garanties, absolute beloftes, verzonnen zekerheid
const DECEPTION_PATTERNS: RegExp[] = [
  /\bgegarandeerd\b/i,
  /\b(100\s?%|honderd procent)\s+(zeker|kans|gegarandeerd|goedgekeurd)/i,
  /\b(altijd|zeker weten|sowieso)\s+(goedgekeurd|toegekend|geaccepteerd)/i,
  /\bu\s+(krijgt|ontvangt)\s+(hem|het|de credential|deze credential)?\s*(zeker|gegarandeerd|altijd)\b/i,
  /\bgeen\s+(enkel\s+)?risico\b/i,
  /\b(volledig|helemaal)\s+gratis\s+voor\s+(iedereen|altijd)/i,
  /\bguaranteed\b/i,
  /\b(100\s?%|absolutely)\s+(sure|certain|approved)/i,
  /\balways\s+(approved|accepted|granted)\b/i,
];

// Manipulatie: kunstmatige urgentie, druk, schuld of angst aanpraten
const MANIPULATION_PATTERNS: RegExp[] = [
  /\blaatste\s+kans\b/i,
  /\balleen\s+(vandaag|nu)\b/i,
  /\b(beslis|besluit|reageer|kies)\s+(nu|direct|meteen)\b/i,
  /\bhaast\s+(je|u)\b/i,
  /\bvoordat\s+het\s+te\s+laat\s+is\b/i,
  /\banders\s+(verliest|mist)\s+(u|je)\b/i,
  /\b(u|je)\s+(moet|dient)\s+(nu|direct|meteen)\s+(akkoord|ja)/i,
  /\b(u|je)\s+(zou|zal)\s+(zich|je)\s+(moeten\s+)?schamen\b/i,
  /\biedereen\s+(doet|heeft)\s+(het|dit)\s+al\b/i,
  /\blast\s+chance\b/i,
  /\bact\s+now\b/i,
  /\bbefore\s+it'?s\s+too\s+late\b/i,
  /\bonly\s+today\b/i,
];

// AI-transparantie: de assistent mag zich niet voordoen als mens/medewerker
const IMPERSONATION_PATTERNS: RegExp[] = [
  /\bik\s+ben\s+(een\s+)?(echt(e)?\s+)?(mens|persoon|medewerker|ambtenaar)\b/i,
  /\bik\s+ben\s+geen\s+(ai|bot|chatbot|computer|taalmodel)\b/i,
  /\bals\s+(echte\s+)?medewerker\s+(heb|kan|zal)\s+ik\b/i,
  /\bi\s+am\s+(a\s+)?(real\s+)?(human|person|employee)\b/i,
  /\bi('m|\s+am)\s+not\s+(an?\s+)?(ai|bot|chatbot|language model)\b/i,
];

function firstMatch(text: string, patterns: RegExp[]): RegExpMatchArray | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m;
  }
  return null;
}

export function checkNoBiasOrDiscrimination(text: string): EthicsCheckResult {
  const match = firstMatch(text, BIAS_PATTERNS);
  if (match) {
    return {
      passed: false,
      reason: `Antwoord bevat mogelijk discriminerende of bevooroordeelde uitspraak ("${match[0]}").`
    };
  }
  const lower = text.toLowerCase();
  const slur = DEROGATORY_TERMS.find(t => lower.includes(t));
  if (slur) {
    return {
      passed: false,
      reason: `Antwoord bevat denigrerend taalgebruik ("${slur}").`
    };
  }
  return { passed: true };
}

export function checkNoDeception(text: string): EthicsCheckResult {
  const match = firstMatch(text, DECEPTION_PATTERNS);
  if (match) {
    return {
      passed: false,
      reason: `Antwoord bevat een misleidende belofte of valse zekerheid ("${match[0]}").`
    };
  }
  return { passed: true };
}

export function checkNoManipulation(text: string): EthicsCheckResult {
  const match = firstMatch(text, MANIPULATION_PATTERNS);
  if (match) {
    return {
      passed: false,
      reason: `Antwoord oefent ongepaste druk uit op de gebruiker ("${match[0]}").`
    };
  }
  return { passed: true };
}

export function checkAITransparency(text: string): EthicsCheckResult {
  const match = firstMatch(text, IMPERSONATION_PATTERNS);
  if (match) {
    return {
      passed: false,
      reason: `Assistent doet zich voor als mens/medewerker ("${match[0]}").`
    };
  }
  return { passed: true };
}

export const ETHICS_CHECKS: Array<{ name: string; fn: (text: string) => EthicsCheckResult }> = [
  { name: 'Geen bias of discriminatie', fn: checkNoBiasOrDiscrimination },
  { name: 'Geen misleiding',            fn: checkNoDeception },
  { name: 'Geen manipulatie of druk',   fn: checkNoManipulation },
  { name: 'AI-transparantie',           fn: checkAITransparency },
];
