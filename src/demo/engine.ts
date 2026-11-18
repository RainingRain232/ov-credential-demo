// Demo-engine: speelt in de browser de rol van backend, LLM en MCP-server.
// - Invoer-, uitvoer- en ethische guardrails zijn de échte regels uit de backend.
// - Het "model" is gescript (zie script.ts); tool-resultaten komen uit vastgelegde fixtures.
// - De beoordelaar geeft een deterministische score met dezelfde normalisatie als de backend.
import type { ChatMessage, FlowStep, GuardrailEvent, JudgeResult } from '@/lib/types';
import { bus } from './bus';
import { runInputGuardrails } from './guardrails/input.guardrails';
import { runOutputGuardrails } from './guardrails/output.guardrails';
import { ETHICS_CHECKS } from './guardrails/ethics.guardrails';
import { normalizeJudgeResult, isEthicsCheck } from './guardrails/judge.prompt';
import { SCRIPT, GUARDRAIL_SCENARIOS, Style, EligibilityToolResult } from './script';
import { walletState, issueCredential } from './wallet-state';
import rulesFixture from './fixtures/tool-get_eligibility_rules.json';
import verifyFixture from './fixtures/tool-verify_rules_current.json';
import checkOver18 from './fixtures/tool-check-over18.json';
import checkUnder18 from './fixtures/tool-check-under18.json';
import applyFixture from './fixtures/tool-apply.json';

const CONSENT_WORDS = /\b(yes|sure|ok|okay|please|go ahead|yep|yeah|confirm|proceed|ja|graag|alsjeblieft|doe het|ga door|controleer|aanvragen|goed|prima|akkoord|zeker|kijk|kijken)\b/i;
const REJECTION_WORDS = /\b(no|nope|don'?t|not now|stop|cancel|nee|niet|annuleer|liever niet|nog niet)\b/i;

/** Snelheid van de simulatie; in tests op 0 zetten. */
export const timing = { scale: 1 };
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms * timing.scale));

interface DemoSession {
  messages: ChatMessage[];
  flowStep: FlowStep;
  style: Style;
  medewerkerPending: boolean;
}
const sessions = new Map<string, DemoSession>();

function getSession(id: string): DemoSession {
  let s = sessions.get(id);
  if (!s) {
    s = { messages: [], flowStep: 'GREETING', style: 'professional', medewerkerPending: false };
    sessions.set(id, s);
  }
  return s;
}

export function resetSessions() { sessions.clear(); }

function emitter(): (e: GuardrailEvent) => void {
  return (e) => bus.emit('guardrail', e);
}

/** Emit met kleine pauzes, zodat de controles zichtbaar één voor één verschijnen. */
function pacedEmitter(base: (e: GuardrailEvent) => void) {
  const queue: GuardrailEvent[] = [];
  return {
    emit: (e: GuardrailEvent) => { queue.push(e); },
    async flush(stepMs = 140) {
      while (queue.length) {
        const e = queue.shift()!;
        if (e.type === 'CHECK_PASSED' || e.type === 'CHECK_FAILED') {
          base({ type: 'CHECK_STARTED', checkName: e.checkName, zone: e.zone, category: e.category });
          await wait(stepMs);
        }
        base(e);
      }
    },
  };
}

async function callTool(emit: (e: GuardrailEvent) => void, toolName: string, args: Record<string, unknown>, result: unknown, ms = 700) {
  emit({ type: 'TOOL_CALL', toolName, args });
  await wait(ms);
  emit({ type: 'TOOL_RESULT', toolName, result });
}

interface Turn { draft: string; nextStep: FlowStep; scenario?: string }

/** Bepaalt wat het "model" doet: welke tools het aanroept en welk concept-antwoord het schrijft. */
async function decideTurn(s: DemoSession, sessionId: string, msg: string, emit: (e: GuardrailEvent) => void): Promise<Turn> {
  const style = s.style;
  const consent = CONSENT_WORDS.test(msg) && !/\b(niet|nee|no)\b/i.test(msg);
  const rejected = REJECTION_WORDS.test(msg) && !consent;

  // 1. Guardrail-demonstraties: het model schrijft bewust een fout concept
  const scenario = GUARDRAIL_SCENARIOS.find(sc => sc.match.test(msg));
  if (scenario) return { draft: scenario.draft, nextStep: s.flowStep, scenario: scenario.id };

  // 2. Veelgestelde vragen (veranderen de flow niet)
  const faq = SCRIPT.faq.find(f => f.match.test(msg));
  if (faq && !(consent && ['CONSENT_CHECK_REQUESTED', 'CONSENT_APPLY_REQUESTED'].includes(s.flowStep))) {
    return { draft: faq.text[style], nextStep: s.flowStep };
  }

  switch (s.flowStep) {
    case 'GREETING':
    case 'RULES_FETCHED':
    case 'RULES_PRESENTED': {
      await callTool(emit, 'get_eligibility_rules', {}, rulesFixture.result);
      return { draft: SCRIPT.rules[style], nextStep: 'CONSENT_CHECK_REQUESTED' };
    }
    case 'CONSENT_CHECK_REQUESTED': {
      if (rejected) return { draft: SCRIPT.declinedCheck[style], nextStep: 'CONSENT_CHECK_REQUESTED' };
      if (!consent) return { draft: SCRIPT.fallback[style], nextStep: 'CONSENT_CHECK_REQUESTED' };
      bus.emit('guardrail', { type: 'FLOW_STEP', step: 'ELIGIBILITY_CHECKING' });
      const result = (walletState.ageProfile === 'under18' ? checkUnder18 : checkOver18).result;
      await callTool(emit, 'check_user_eligibility', { sessionId }, { ...result, checkedAt: new Date().toISOString() }, 1100);
      const r = result as EligibilityToolResult;
      return { draft: SCRIPT.eligibility(style, r), nextStep: r.eligible ? 'CONSENT_APPLY_REQUESTED' : 'ELIGIBILITY_RESULT' };
    }
    case 'CONSENT_APPLY_REQUESTED': {
      if (rejected) return { draft: SCRIPT.declinedApply[style], nextStep: 'CONSENT_APPLY_REQUESTED' };
      if (!consent) return { draft: SCRIPT.fallback[style], nextStep: 'CONSENT_APPLY_REQUESTED' };
      bus.emit('guardrail', { type: 'FLOW_STEP', step: 'APPLYING' });
      await callTool(emit, 'verify_rules_current', {}, { ...verifyFixture.result, checkedAt: new Date().toISOString() });
      // Aanvraag gaat eerst langs een medewerker (human-in-the-loop)
      s.medewerkerPending = true;
      emit({ type: 'MEDEWERKER_REVIEW_REQUESTED' });
      await callTool(emit, 'apply_for_transport_credential', { sessionId },
        { status: 'pending_medewerker_review', message: 'Een medewerker moet uw aanvraag eerst beoordelen.' }, 500);
      return { draft: SCRIPT.pending[style], nextStep: 'MEDEWERKER_PENDING' };
    }
    case 'CREDENTIAL_ISSUED':
      return { draft: SCRIPT.afterIssued[style], nextStep: 'CREDENTIAL_ISSUED' };
    default:
      return { draft: SCRIPT.fallback[style], nextStep: s.flowStep };
  }
}

/** Gescripte beoordelaar: kwaliteits-checks vast, ethische checks volgen de echte regels. */
export function demoJudge(text: string, history: ChatMessage[]): JudgeResult {
  const ethics = Object.fromEntries(ETHICS_CHECKS.map(c => [c.name, c.fn(text)]));
  const e = (name: string, okReason: string) => ({
    pass: ethics[name].passed, reason: ethics[name].passed ? okReason : ethics[name].reason!,
  });
  const userConsented = history.filter(m => m.role === 'user').slice(-2).some(m => CONSENT_WORDS.test(m.content));
  const raw: Partial<JudgeResult> = {
    checks: {
      on_topic:           { pass: true, reason: 'Antwoord gaat over het OV-credential.' },
      single_question:    { pass: true, reason: '' },
      appropriate_length: { pass: true, reason: '' },
      no_pii_leaked:      { pass: true, reason: 'Er worden geen persoonsgegevens genoemd.' },
      professional_tone:  { pass: true, reason: 'Toon is vriendelijk en passend bij de gekozen stijl.' },
      consent_respected:  { pass: true, reason: userConsented ? 'Actie pas na expliciete toestemming van de gebruiker.' : 'Er is geen actie uitgevoerd zonder toestemming.' },
      no_bias_discrimination: e('Geen bias of discriminatie', 'Geen onderscheid op beschermde kenmerken.'),
      no_deception:       e('Geen misleiding', 'Geen valse beloftes of garanties.'),
      no_manipulation:    e('Geen manipulatie of druk', 'Geen druk of kunstmatige haast.'),
      ai_transparency:    e('AI-transparantie', 'Assistent doet zich niet voor als mens.'),
    },
    overall_score: 9,
    recommendation: 'PASS',
    block_reason: null,
  };
  return normalizeJudgeResult(raw, text);
}

export interface ChatResponse {
  response: string;
  blocked: boolean;
  blockZone?: string;
  blockReason?: string;
  judgeResult?: JudgeResult;
  flowStep: FlowStep;
}

export async function demoChat(sessionId: string, message: string, style?: Style | null): Promise<ChatResponse> {
  const s = getSession(sessionId);
  if (style) s.style = style;
  const emit = emitter();
  const paced = pacedEmitter(emit);

  emit({ type: 'INPUT_RECEIVED', preview: message.slice(0, 60) });

  // ─── Invoerschild (echte regels) ───
  const userCount = s.messages.filter(m => m.role === 'user').length + 1;
  const input = await runInputGuardrails(message, sessionId, userCount, paced.emit);
  await paced.flush();
  if (!input.passed) {
    emit({ type: 'OUTPUT_BLOCKED', reason: input.blockReason });
    return { response: input.blockReason ?? 'Uw bericht kon niet worden verwerkt.', blocked: true, blockZone: 'INPUT', flowStep: s.flowStep };
  }

  s.messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

  // ─── "Model" ───
  emit({ type: 'LLM_THINKING' });
  await wait(600);
  const turn = await decideTurn(s, sessionId, message, emit);
  if (turn.nextStep !== s.flowStep) emit({ type: 'LLM_THINKING' });
  await wait(700);

  // ─── Uitvoerfilter + ethische guardrails (echte regels) ───
  const history = s.messages.map(m => ({ role: m.role, content: m.content }));
  const output = runOutputGuardrails(turn.draft, history, paced.emit);
  await paced.flush(110);
  if (!output.passed) {
    emit({ type: 'OUTPUT_BLOCKED', reason: output.blockReason });
    const fallback = SCRIPT.blockedFallback;
    s.messages.push({ role: 'assistant', content: fallback, timestamp: new Date().toISOString() });
    return { response: fallback, blocked: true, blockZone: 'OUTPUT', blockReason: output.blockReason, flowStep: s.flowStep };
  }

  // ─── LLM-beoordelaar ───
  emit({ type: 'CHECK_STARTED', checkName: 'LLM Beoordelaar', zone: 'JUDGE' });
  await wait(900);
  const judgeResult = demoJudge(turn.draft, s.messages);
  for (const [key, c] of Object.entries(judgeResult.checks)) {
    if (!c) continue;
    emit({ type: c.pass ? 'CHECK_PASSED' : 'CHECK_FAILED', checkName: `Beoordelaar: ${key.replace(/_/g, ' ')}`, zone: 'JUDGE',
      ...(isEthicsCheck(key) ? { category: 'ETHICS' as const } : {}), reason: c.reason });
  }
  emit({ type: 'JUDGE_SCORE', scores: judgeResult });

  s.messages.push({ role: 'assistant', content: turn.draft, timestamp: new Date().toISOString() });
  s.flowStep = turn.nextStep;
  emit({ type: 'OUTPUT_DELIVERED', preview: turn.draft.slice(0, 80), step: s.flowStep });
  emit({ type: 'FLOW_STEP', step: s.flowStep });

  return { response: turn.draft, blocked: false, judgeResult, flowStep: s.flowStep };
}

export async function demoMedewerkerDecide(sessionId: string, decision: 'approved' | 'rejected'): Promise<{ success: boolean; error?: string }> {
  const s = getSession(sessionId);
  if (!s.medewerkerPending) return { success: false, error: 'Geen openstaande beoordeling' };
  s.medewerkerPending = false;
  const emit = emitter();

  if (decision === 'approved') {
    const issued = issueCredential();
    await callTool(emit, 'apply_for_transport_credential', { sessionId },
      { ...applyFixture.result, credentialId: issued.id, issuedAt: issued.receivedAt }, 900);
    const msg: ChatMessage = { role: 'assistant', content: SCRIPT.approved, timestamp: new Date().toISOString() };
    s.messages.push(msg);
    s.flowStep = 'CREDENTIAL_ISSUED';
    emit({ type: 'MEDEWERKER_DECISION', decision: 'approved' });
    emit({ type: 'CHAT_MESSAGE', chatMessage: msg });
    emit({ type: 'FLOW_STEP', step: 'CREDENTIAL_ISSUED' });
  } else {
    const msg: ChatMessage = { role: 'assistant', content: SCRIPT.rejected, timestamp: new Date().toISOString() };
    s.messages.push(msg);
    s.flowStep = 'MEDEWERKER_REJECTED';
    emit({ type: 'MEDEWERKER_DECISION', decision: 'rejected' });
    emit({ type: 'CHAT_MESSAGE', chatMessage: msg });
    emit({ type: 'FLOW_STEP', step: 'MEDEWERKER_REJECTED' });
  }
  return { success: true };
}
