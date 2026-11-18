// Nagebootste backend-API voor de statische demo. Componenten roepen apiFetch('/api/...') aan
// in plaats van fetch naar de backend; de antwoorden komen uit de demo-engine en fixtures.
import { demoChat, demoMedewerkerDecide } from './engine';
import { walletState, walletPayload, setPermission, resolveNotification, markTransparencyRead } from './wallet-state';
import { JUDGE_SYSTEM_PROMPT, QUALITY_CHECK_KEYS, ETHICS_CHECK_KEYS } from './guardrails/judge.prompt';
import llmConfigFixture from './fixtures/llm-config.json';
import triplyService from './fixtures/service-triply.json';
import transportService from './fixtures/service-transport.json';
import sfRules from './fixtures/sf-rules.json';
import sparqlPresets from './fixtures/sparql-presets.json';
import type { Style } from './script';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const latency = () => new Promise(r => setTimeout(r, 120 + Math.random() * 120));
const normalize = (q: string) => q.replace(/\s+/g, ' ').trim();

const DEMO_SYSTEM_PROMPT = `In deze online demo is er geen taalmodel. De antwoorden van de assistent zijn vooraf geschreven per communicatiestijl (zakelijk, rustig en uitgebreid, eenvoudig Nederlands) en per stap in de aanvraag.

De guardrails zijn wél echt: elk bericht van de gebruiker gaat door het invoerschild en elk antwoord van de assistent door het uitvoerfilter en de ethische guardrails, met dezelfde regels als in de volledige versie. Probeer het uit met de voorbeelden onder "Guardrails testen" in de chat.

In de volledige versie draait hier een lokaal taalmodel (Ollama) met deze opdracht:
"Je bent een behulpzame en professionele medewerker van de Nationale Autoriteit Openbaar Vervoer. Je enige doel is klanten te helpen met het begrijpen en aanvragen van het OV-credential. Je antwoordt altijd in het Nederlands. Je MOET get_eligibility_rules aanroepen voordat je vereisten noemt. Stel slechts één vraag per antwoord. Je ziet nooit de inhoud van credentials, alleen ja of nee."`;

function llmConfig() {
  return {
    model: { provider: 'Demo (zonder taalmodel)', mainModel: 'Gescripte demo-assistent', judgeModel: 'Gescripte beoordelaar', baseUrl: null },
    systemPrompt: DEMO_SYSTEM_PROMPT,
    judgeSystemPrompt: JUDGE_SYSTEM_PROMPT,
    inputGuardrails: llmConfigFixture.inputGuardrails,
    outputGuardrails: [
      ...llmConfigFixture.outputGuardrails,
      { name: 'Geen bias of discriminatie', description: 'Geen onderscheid of generalisaties op beschermde kenmerken (afkomst, religie, geslacht, ...)' },
      { name: 'Geen misleiding', description: 'Geen valse garanties zoals "gegarandeerd" of "geen enkel risico"' },
      { name: 'Geen manipulatie of druk', description: 'Geen kunstmatige urgentie zoals "laatste kans" of "beslis nu"' },
      { name: 'AI-transparantie', description: 'De assistent doet zich niet voor als mens of medewerker' },
    ],
    judgeChecks: [...QUALITY_CHECK_KEYS, ...ETHICS_CHECK_KEYS],
    consentWords: ['ja', 'graag', 'alsjeblieft', 'ok', 'prima', 'akkoord', 'doe het', 'ga door', 'controleer', 'aanvragen', 'yes', 'please', 'go ahead'],
    flowSteps: llmConfigFixture.flowSteps,
  };
}

function permissionsPayload() {
  return walletState.permissions;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  let m: RegExpMatchArray | null;

  if (path === '/api/chat' && method === 'POST') {
    return json(await demoChat(body.sessionId, body.message, body.communicationStyle as Style | null));
  }
  if (path === '/api/medewerker/decide' && method === 'POST') {
    const r = await demoMedewerkerDecide(body.sessionId, body.decision);
    return json(r, r.success ? 200 : 400);
  }

  await latency();

  if (path === '/api/config') {
    return json({ provider: 'demo', modelLabel: 'demo-assistent (gescript)', judgeModelLabel: 'demo-beoordelaar (gescript)' });
  }
  if (path === '/api/llm-config') return json(llmConfig());

  if ((m = path.match(/^\/api\/service\/(\w+)$/))) {
    if (m[1] === 'triply') return json(triplyService);
    if (m[1] === 'wallet') return json(walletPayload());
    if (m[1] === 'transport') return json(transportService);
    return json({ error: 'Onbekende dienst' }, 404);
  }

  if (path === '/api/wallet/profile') {
    if (method === 'POST' && (body.ageProfile === 'over18' || body.ageProfile === 'under18')) walletState.ageProfile = body.ageProfile;
    return json({ ageProfile: walletState.ageProfile });
  }

  if (path === '/api/wallet/permissions') {
    if (method === 'PUT') {
      if (!setPermission(body.folderId, body.partyId, body.allowed === true)) return json({ error: 'Onbekende map of partij' }, 400);
    }
    return json(permissionsPayload());
  }
  if ((m = path.match(/^\/api\/wallet\/permissions\/notifications\/(.+)$/)) && method === 'POST') {
    if (!resolveNotification(decodeURIComponent(m[1]), body.action)) return json({ error: 'Onbekende notificatie of actie' }, 404);
    return json(permissionsPayload());
  }

  if (path === '/api/wallet/transparency') return json(walletState.transparency);
  if ((m = path.match(/^\/api\/wallet\/transparency\/(.+)\/read$/)) && method === 'POST') {
    markTransparencyRead(decodeURIComponent(m[1]));
    return json(walletState.transparency);
  }

  if (path === '/api/triply/studiefinanciering/rules') return json(sfRules);

  if (path === '/api/sparql/triply' && method === 'POST') {
    const preset = sparqlPresets.find(p => normalize(p.query) === normalize(String(body.query ?? '')));
    if (preset) return json(preset.result);
    return json({ error: 'In de online demo is er geen SPARQL-server. Alleen de voorbeeldqueries geven resultaat; kies er een uit de lijst.' }, 400);
  }

  return json({ error: `Niet beschikbaar in de demo: ${method} ${path}` }, 404);
}
