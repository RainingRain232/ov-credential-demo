import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { demoChat, demoMedewerkerDecide, resetSessions, timing } from '@/demo/engine';
import { bus } from '@/demo/bus';
import { SCRIPT, GUARDRAIL_EXAMPLES, Style } from '@/demo/script';
import { runOutputGuardrails } from '@/demo/guardrails/output.guardrails';
import { walletPayload, resetWalletState, walletState } from '@/demo/wallet-state';
import { apiFetch } from '@/demo/api';
import type { GuardrailEvent } from '@/lib/types';

const STYLES: Style[] = ['professional', 'rustig', 'inburgering'];
let events: GuardrailEvent[] = [];
const listener = (e: GuardrailEvent) => { events.push(e); };
let n = 0;
const newSession = () => `test-${++n}`;

beforeEach(() => {
  timing.scale = 0;
  events = [];
  resetSessions();
  resetWalletState();
  bus.on('guardrail', listener);
});
afterEach(() => bus.off('guardrail', listener));

describe('gescripte teksten', () => {
  const consentHistory = [{ role: 'user', content: 'Ja, graag' }];
  const texts: Array<[string, string]> = [];
  for (const st of STYLES) {
    texts.push([`rules/${st}`, SCRIPT.rules[st]]);
    texts.push([`eligible/${st}`, SCRIPT.eligibility(st, { eligible: true, route: 'over18', routeLabel: 'Studenten-OV Route', credentialType: 'StudentOVCredential' })]);
    texts.push([`youth/${st}`, SCRIPT.eligibility(st, { eligible: true, route: 'under18', routeLabel: 'Jeugd-OV Route', credentialType: 'YouthOVCredential' })]);
    texts.push([`not-eligible/${st}`, SCRIPT.eligibility(st, { eligible: false })]);
    texts.push([`pending/${st}`, SCRIPT.pending[st]]);
    texts.push([`declinedCheck/${st}`, SCRIPT.declinedCheck[st]]);
    texts.push([`declinedApply/${st}`, SCRIPT.declinedApply[st]]);
    texts.push([`afterIssued/${st}`, SCRIPT.afterIssued[st]]);
    texts.push([`fallback/${st}`, SCRIPT.fallback[st]]);
    for (const f of SCRIPT.faq) texts.push([`faq-${f.id}/${st}`, f.text[st]]);
  }
  texts.push(['blockedFallback', SCRIPT.blockedFallback]);

  it.each(texts)('%s komt door uitvoerfilter en ethische guardrails', (_name, text) => {
    const r = runOutputGuardrails(text, consentHistory, () => {});
    expect(r.blockReason).toBeUndefined();
    expect(r.passed).toBe(true);
  });
});

describe('volledige OV-flow', () => {
  it.each(STYLES)('doorloopt de aanvraag tot uitgifte (%s)', async (style) => {
    const id = newSession();
    let r = await demoChat(id, 'Ik wil graag een OV-credential aanvragen', style);
    expect(r.blocked).toBe(false);
    expect(r.flowStep).toBe('CONSENT_CHECK_REQUESTED');
    expect(events.some(e => e.type === 'TOOL_CALL' && e.toolName === 'get_eligibility_rules')).toBe(true);

    r = await demoChat(id, 'Ja, controleer mijn geschiktheid', style);
    expect(r.flowStep).toBe('CONSENT_APPLY_REQUESTED');
    expect(events.some(e => e.type === 'TOOL_CALL' && e.toolName === 'check_user_eligibility')).toBe(true);

    r = await demoChat(id, 'Ja, vraag het aan', style);
    expect(r.flowStep).toBe('MEDEWERKER_PENDING');
    expect(events.some(e => e.type === 'MEDEWERKER_REVIEW_REQUESTED')).toBe(true);

    const before = walletPayload()['/credentials/full'].credentials.length;
    expect((await demoMedewerkerDecide(id, 'approved')).success).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'FLOW_STEP', step: 'CREDENTIAL_ISSUED' });
    const creds = walletPayload()['/credentials/full'].credentials as Array<{ type: string[] }>;
    expect(creds.length).toBe(before + 1);
    expect(creds[0].type).toContain('PublicTransportCredential');
  });

  it('elk antwoord krijgt een beoordeling met alle tien de checks', async () => {
    const r = await demoChat(newSession(), 'Hallo, vertel over het OV-credential', 'professional');
    expect(r.judgeResult?.recommendation).toBe('PASS');
    expect(Object.keys(r.judgeResult!.checks)).toHaveLength(10);
  });

  it('respecteert een weigering en voert geen controle uit', async () => {
    const id = newSession();
    await demoChat(id, 'Ik wil een OV-credential', 'rustig');
    events = [];
    const r = await demoChat(id, 'Nee, nu niet', 'rustig');
    expect(r.flowStep).toBe('CONSENT_CHECK_REQUESTED');
    expect(events.some(e => e.type === 'TOOL_CALL')).toBe(false);
  });

  it('gebruikt de jeugdroute bij leeftijdsprofiel onder 18', async () => {
    walletState.ageProfile = 'under18';
    const id = newSession();
    await demoChat(id, 'Ik wil een OV-credential', 'professional');
    const r = await demoChat(id, 'Ja, controleer mijn geschiktheid', 'professional');
    expect(r.response).toContain('Jeugd-OV');
  });

  it('afwijzing door medewerker eindigt in MEDEWERKER_REJECTED', async () => {
    const id = newSession();
    await demoChat(id, 'Ik wil een OV-credential', 'professional');
    await demoChat(id, 'Ja, controleer', 'professional');
    await demoChat(id, 'Ja, vraag het aan', 'professional');
    await demoMedewerkerDecide(id, 'rejected');
    expect(events.at(-1)).toEqual({ type: 'FLOW_STEP', step: 'MEDEWERKER_REJECTED' });
  });
});

describe('guardrail-voorbeelden', () => {
  const ZONE: Record<string, string> = { Invoerschild: 'INPUT', Uitvoerfilter: 'OUTPUT', 'Ethische guardrails': 'OUTPUT' };

  it.each(GUARDRAIL_EXAMPLES.map(e => [e.label, e] as const))('%s wordt tegengehouden', async (_label, ex) => {
    const id = newSession();
    // Twee gewone berichten vooraf: de onderwerpcontrole geldt pas vanaf het derde bericht
    await demoChat(id, 'Hallo', 'professional');
    await demoChat(id, 'Wat is een wallet?', 'professional');
    events = [];
    const r = await demoChat(id, ex.message, 'professional');
    expect(r.blocked).toBe(true);
    expect(r.blockZone).toBe(ZONE[ex.zone]);
    const failed = events.find(e => e.type === 'CHECK_FAILED');
    expect(failed).toBeDefined();
    if (ex.zone === 'Ethische guardrails') expect(failed!.category).toBe('ETHICS');
  });
});

describe('nagebootste API', () => {
  it('permissies: notificatie afhandelen verwijdert hem en voegt toegang toe', async () => {
    const res = await apiFetch('/api/wallet/permissions/notifications/duo-enrollment-yearly', { method: 'POST', body: JSON.stringify({ action: 'allow' }) });
    const d = await res.json();
    expect(d.notifications).toHaveLength(1);
    expect(d.grants.some((g: { partyName: string }) => g.partyName === 'DUO')).toBe(true);
  });
  it('SPARQL: voorbeeldquery geeft resultaat, eigen query een nette foutmelding', async () => {
    const presets = (await import('@/demo/fixtures/sparql-presets.json')).default;
    const ok = await apiFetch('/api/sparql/triply', { method: 'POST', body: JSON.stringify({ query: presets[0].query }) });
    expect(ok.status).toBe(200);
    const bad = await apiFetch('/api/sparql/triply', { method: 'POST', body: JSON.stringify({ query: 'SELECT * WHERE { ?s ?p ?o }' }) });
    expect(bad.status).toBe(400);
  });
  it('wallet: inschrijving onderwijs is in de demo geldig', async () => {
    const d = await (await apiFetch('/api/service/wallet')).json();
    const enr = d['/credentials/full'].credentials.find((c: { type: string[]; isDummy?: boolean }) => c.type.includes('UniversityEnrollmentCredential') && !c.isDummy);
    expect(new Date(enr.validUntil).getTime()).toBeGreaterThan(Date.now());
  });
});
