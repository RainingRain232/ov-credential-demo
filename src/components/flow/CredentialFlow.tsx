'use client';
import { apiFetch } from '@/demo/api';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlowStep } from '@/lib/types';
import { runWalletScan, ScanReport, ScanSeverity } from '@/lib/walletScan';
import TransparencyOverlay, { TransparencyPayload } from './TransparencyOverlay';
import SubsidyScanOverlay from './SubsidyScanOverlay';


const STEPS: { key: FlowStep; label: string; icon: string }[] = [
  { key: 'GREETING',                label: 'Welkom',                    icon: '👋' },
  { key: 'RULES_PRESENTED',         label: 'Regels uitgelegd',          icon: '📋' },
  { key: 'CONSENT_CHECK_REQUESTED', label: 'Toestemming controle',      icon: '🔍' },
  { key: 'ELIGIBILITY_RESULT',      label: 'Geschiktheid gecontroleerd', icon: '✅' },
  { key: 'CONSENT_APPLY_REQUESTED', label: 'Toestemming aanvraag',      icon: '📝' },
  { key: 'APPLYING',                label: 'Aanvragen',                 icon: '⚙️' },
  { key: 'MEDEWERKER_PENDING',      label: 'Medewerker review',         icon: '👤' },
  { key: 'CREDENTIAL_ISSUED',       label: 'Uitgegeven!',               icon: '🎫' },
];

const STEP_ORDER: FlowStep[] = [
  'GREETING', 'RULES_FETCHED', 'RULES_PRESENTED',
  'CONSENT_CHECK_REQUESTED', 'CONSENT_CHECK_GIVEN', 'ELIGIBILITY_CHECKING',
  'ELIGIBILITY_RESULT', 'CONSENT_APPLY_REQUESTED', 'CONSENT_APPLY_GIVEN',
  'APPLYING', 'MEDEWERKER_PENDING', 'MEDEWERKER_APPROVED', 'CREDENTIAL_ISSUED'
];

const SERVICES = [
  { key: 'triply',    label: 'Triply DB',      icon: '🗄️', color: 'border-teal-700/60 hover:border-teal-500 text-teal-400' },
  { key: 'wallet',    label: 'Wallet',          icon: '👜', color: 'border-cyan-700/60 hover:border-cyan-500 text-cyan-400' },
  { key: 'transport', label: 'Vervoerder',       icon: '🚌', color: 'border-orange-700/60 hover:border-orange-500 text-orange-400' },
];

// ---------- LLM Config Modal ----------

interface LLMConfig {
  model: { provider: string; mainModel: string; judgeModel: string; baseUrl: string | null };
  systemPrompt: string;
  judgeSystemPrompt: string;
  inputGuardrails: { name: string; description: string }[];
  outputGuardrails: { name: string; description: string }[];
  judgeChecks: string[];
  consentWords: string[];
  flowSteps: string[];
}

function LLMConfigModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<LLMConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'model' | 'prompt' | 'guardrails' | 'judge' | 'flow'>('model');

  useEffect(() => {
    apiFetch(`/api/llm-config`)
      .then(r => r.json())
      .then(d => { setData(d as LLMConfig); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'model',      label: 'Model' },
    { key: 'prompt',     label: 'Systeemprompt' },
    { key: 'guardrails', label: 'Guardrails' },
    { key: 'judge',      label: 'Beoordelaar' },
    { key: 'flow',       label: 'Stroom' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <span className="text-xl">🧠</span>
          <div>
            <h2 className="text-sm font-bold text-slate-100">Assistent & guardrails</h2>
            <p className="text-[10px] text-slate-500">Actieve systeemconfiguratie</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-300 text-lg leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 flex-shrink-0 border-b border-slate-800 pb-0">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-[11px] px-3 py-1.5 rounded-t-lg font-medium transition-colors
                ${tab === t.key ? 'bg-slate-800 text-slate-100 border-t border-x border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
              Laden...
            </div>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}

          {data && tab === 'model' && (
            <div className="space-y-3">
              {[
                { label: 'Provider', value: data.model.provider },
                { label: 'Hoofdmodel', value: data.model.mainModel },
                { label: 'Beoordelaarmodel', value: data.model.judgeModel },
                ...(data.model.baseUrl ? [{ label: 'Basis-URL', value: data.model.baseUrl }] : []),
              ].map(row => (
                <div key={row.label} className="flex items-start gap-3 bg-slate-800/50 rounded-lg p-3">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider w-24 flex-shrink-0 pt-0.5">{row.label}</span>
                  <span className="text-[12px] font-mono text-slate-200">{row.value}</span>
                </div>
              ))}
            </div>
          )}

          {data && tab === 'prompt' && (
            <div>
              <p className="text-[10px] font-mono text-slate-500 mb-2 uppercase tracking-wider">Werking van de assistent</p>
              <pre className="text-[11px] font-mono text-slate-200 bg-slate-800/60 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
                {data.systemPrompt}
              </pre>
            </div>
          )}

          {data && tab === 'guardrails' && (
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-mono text-slate-500 mb-2 uppercase tracking-wider">Invoer-guardrails ({data.inputGuardrails.length} controles)</p>
                <div className="space-y-2">
                  {data.inputGuardrails.map(g => (
                    <div key={g.name} className="bg-slate-800/50 rounded-lg p-3">
                      <span className="text-[11px] font-semibold text-blue-400">{g.name}</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{g.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-mono text-slate-500 mb-2 uppercase tracking-wider">Uitvoer-guardrails ({data.outputGuardrails.length} controles)</p>
                <div className="space-y-2">
                  {data.outputGuardrails.map(g => (
                    <div key={g.name} className="bg-slate-800/50 rounded-lg p-3">
                      <span className="text-[11px] font-semibold text-purple-400">{g.name}</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{g.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-mono text-slate-500 mb-2 uppercase tracking-wider">Toestemmingstriggerwoorden</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.consentWords.map(w => (
                    <span key={w} className="text-[10px] font-mono bg-green-900/40 text-green-400 px-2 py-0.5 rounded">{w}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {data && tab === 'judge' && (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-mono text-slate-500 mb-2 uppercase tracking-wider">Beoordelaar-systeemprompt</p>
                <pre className="text-[11px] font-mono text-slate-200 bg-slate-800/60 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
                  {data.judgeSystemPrompt}
                </pre>
              </div>
              <div>
                <p className="text-[10px] font-mono text-slate-500 mb-2 uppercase tracking-wider">Beoordelaarchecks (6 binair)</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.judgeChecks.map(c => (
                    <span key={c} className="text-[10px] font-mono bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <span className="text-[11px] font-semibold text-slate-300">Beoordeling</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Totaalscore 1–10 · Aanbeveling: PASS / WARN / BLOCK · BLOCK overschrijft antwoordlevering</p>
              </div>
            </div>
          )}

          {data && tab === 'flow' && (
            <div className="space-y-3">
              <p className="text-[10px] font-mono text-slate-500 mb-2 uppercase tracking-wider">Gespreksstroom (afgedwongen door systeemprompt)</p>
              {data.flowSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-800/50 rounded-lg p-3">
                  <span className="text-[11px] font-mono text-slate-500 flex-shrink-0">{i + 1}.</span>
                  <span className="text-[11px] font-mono text-slate-300">{step}</span>
                </div>
              ))}
              <div className="bg-slate-800/50 rounded-lg p-3 mt-2">
                <span className="text-[11px] font-semibold text-slate-300">Toestemmingspoorten</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Poort 1: regelcontrole → Poort 2: leeftijdsgebaseerde geschiktheidscontrole (onder-18 of 18+ pad) → Poort 3: credential-aanvraag. Elke poort vereist expliciete toestemming van de gebruiker voordat een tool-aanroep wordt gedaan.</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function getStepIndex(step: FlowStep): number { return STEP_ORDER.indexOf(step); }
function isStepComplete(step: FlowStep, currentStep: FlowStep): boolean {
  return getStepIndex(step) <= getStepIndex(currentStep);
}

// ---- TriplyDB dataset view ----

interface JsonLdGraph {
  '@id': string;
  '@type': string;
  [key: string]: unknown;
}

interface JsonLdDataset {
  '@context': Record<string, string>;
  '@graph': JsonLdGraph[];
  meta?: {
    source?: string;
    dataset?: string;
    lastUpdated?: string;
    version?: string;
    endpoint?: string;
  };
}

interface SparqlBinding { type: string; value: string; datatype?: string; lang?: string; }
interface SparqlResult {
  head: { vars: string[] };
  results: { bindings: Record<string, SparqlBinding>[] };
  boolean?: boolean;
}

const PRESET_QUERIES = [
  {
    label: 'All eligibility rules',
    query: `PREFIX transport: <https://transport.example.nl/ontology#>
SELECT ?rule ?title ?description ?credentialType ?order
WHERE {
  ?rule a transport:EligibilityRule ;
        transport:title ?title ;
        transport:description ?description ;
        transport:credentialType ?credentialType ;
        transport:order ?order .
}
ORDER BY ?order`,
  },
  {
    label: 'Rule set metadata',
    query: `PREFIX transport: <https://transport.example.nl/ontology#>
SELECT ?source ?version ?lastUpdated ?credentialName
WHERE {
  ?ruleset a transport:RuleSet ;
           transport:source ?source ;
           transport:version ?version ;
           transport:lastUpdated ?lastUpdated ;
           transport:credentialName ?credentialName .
}`,
  },
  {
    label: 'Required credentials',
    query: `PREFIX transport: <https://transport.example.nl/ontology#>
SELECT ?title ?credentialType ?requiredClaim
WHERE {
  ?rule a transport:EligibilityRule ;
        transport:title ?title ;
        transport:credentialType ?credentialType ;
        transport:requiredClaim ?requiredClaim ;
        transport:isRequired true .
}
ORDER BY ?title`,
  },
  {
    label: 'Count by RDF type',
    query: `SELECT ?type (COUNT(*) AS ?count)
WHERE { ?s a ?type }
GROUP BY ?type
ORDER BY DESC(?count)`,
  },
  {
    label: 'All triples (limit 50)',
    query: `SELECT ?s ?p ?o
WHERE { ?s ?p ?o }
ORDER BY ?s ?p
LIMIT 50`,
  },
];

function prefixCurie(iri: string, context: Record<string, string>): string {
  for (const [prefix, ns] of Object.entries(context)) {
    if (typeof ns === 'string' && iri.startsWith(ns)) {
      return `${prefix}:${iri.slice(ns.length)}`;
    }
  }
  // Shorten long IRIs
  if (iri.length > 55) return iri.slice(0, 22) + '…' + iri.slice(-22);
  return iri;
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2">
      <div className={`text-base font-bold font-mono ${accent ?? 'text-teal-400'}`}>{value}</div>
      <div className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function TriplyDBView({ dataset }: { dataset: JsonLdDataset }) {
  type Tab = 'overview' | 'graphs' | 'query' | 'context';
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sparqlQuery, setSparqlQuery] = useState(PRESET_QUERIES[0].query);
  const [queryResult, setQueryResult] = useState<SparqlResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryMs, setQueryMs] = useState<number | null>(null);

  const ctx = dataset['@context'] || {};
  const graphs = dataset['@graph'] || [];
  const meta = dataset.meta;
  const totalTriples = graphs.reduce((n, g) => n + Object.keys(g).filter(k => !k.startsWith('@')).length, 0);

  function toggleNode(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function runQuery() {
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);
    setQueryMs(null);
    const t0 = Date.now();
    try {
      const r = await apiFetch(`/api/sparql/triply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sparqlQuery }),
      });
      const data = await r.json() as SparqlResult;
      setQueryMs(Date.now() - t0);
      if (!r.ok) { setQueryError(JSON.stringify(data)); return; }
      setQueryResult(data);
    } catch (err) {
      setQueryError(String(err));
    } finally {
      setQueryLoading(false);
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overzicht' },
    { key: 'graphs',   label: `Grafen (${graphs.length})` },
    { key: 'query',    label: 'SPARQL Query' },
    { key: 'context',  label: '@context' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Dataset breadcrumb header */}
      <div className="bg-teal-900/20 border border-teal-700/40 rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2 flex-wrap flex-shrink-0">
        <span className="text-teal-400 text-[11px] font-bold font-mono">Apache Jena Fuseki</span>
        <span className="text-slate-600 text-[10px]">/</span>
        <span className="text-slate-400 text-[10px] font-mono">{meta?.source || 'transport-authority'}</span>
        <span className="text-slate-600 text-[10px]">/</span>
        <span className="text-teal-300 text-[11px] font-mono font-semibold">{meta?.dataset || 'transport-rules'}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] text-emerald-400 font-mono">LIVE</span>
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-slate-700 flex-shrink-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`text-[10px] px-3 py-1.5 font-medium transition-colors
              ${activeTab === t.key
                ? 'bg-slate-800 text-teal-300 border-t border-x border-slate-700 rounded-t -mb-px'
                : 'text-slate-500 hover:text-slate-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto pt-3">

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2">
              <StatCard label="Versie"         value={meta?.version ?? '—'} />
              <StatCard label="Benoemde grafen" value={graphs.length} accent="text-teal-400" />
              <StatCard label="Triples"       value={totalTriples}  accent="text-teal-400" />
              <StatCard label="Bijgewerkt"    value={meta?.lastUpdated ? meta.lastUpdated.split('T')[0] : '—'} />
            </div>

            {/* Dataset info */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 space-y-2.5">
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Dataset</h3>
              {[
                { label: 'Naam',              value: meta?.dataset ?? '—' },
                { label: 'Bron',              value: meta?.source  ?? '—' },
                { label: 'Credential-typen',  value: 'YouthOVCredential / StudentOVCredential' },
                { label: 'Formaat',           value: 'Turtle / JSON-LD / N-Triples' },
                { label: 'Protocol',          value: 'SPARQL 1.1 (W3C)' },
              ].map(row => (
                <div key={row.label} className="flex gap-3 text-[11px]">
                  <span className="text-slate-500 w-32 flex-shrink-0">{row.label}</span>
                  <span className="text-slate-200 font-mono">{row.value}</span>
                </div>
              ))}
            </div>

            {/* Endpoint */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 space-y-2">
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">SPARQL Endpoint</h3>
              <div className="font-mono text-[11px] text-emerald-300 bg-slate-950/60 rounded-lg px-3 py-2 break-all">
                {meta?.endpoint ?? 'http://localhost:3030/transport-rules/sparql'}
              </div>
              <p className="text-[10px] text-slate-500">
                Supports SELECT, CONSTRUCT, ASK, DESCRIBE · Content-Type: application/sparql-results+json
              </p>
            </div>

            {/* Rules summary cards */}
            <div>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Geschiktheidsregels</h3>
              <div className="space-y-1.5">
                {graphs.map(node => {
                  const title = node[`https://transport.example.nl/ontology#title`] as string | undefined;
                  const desc  = node[`https://transport.example.nl/ontology#description`] as string | undefined;
                  const ctype = node[`https://transport.example.nl/ontology#credentialType`] as string | undefined;
                  if (!title) return null;
                  return (
                    <div key={node['@id']} className="bg-slate-800/30 border border-slate-700/40 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-semibold text-slate-200">{title}</span>
                        {ctype && <span className="text-[9px] font-mono bg-teal-900/40 text-teal-400 px-1.5 py-0.5 rounded">{ctype}</span>}
                      </div>
                      {desc && <p className="text-[10px] text-slate-400">{desc}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Named Graphs ── */}
        {activeTab === 'graphs' && (
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 mb-3">
              {graphs.length} benoemde {graphs.length !== 1 ? 'grafen' : 'graaf'} · {totalTriples} triples totaal
            </p>
            {graphs.map(node => {
              const id = node['@id'];
              const type = node['@type'];
              const isOpen = expandedIds.has(id);
              const predicates = Object.entries(node).filter(([k]) => !k.startsWith('@'));
              const title = node[`https://transport.example.nl/ontology#title`] as string | undefined;
              return (
                <div key={id} className="border border-slate-700/60 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleNode(id)}
                    className="w-full flex items-start gap-2 px-3 py-2 bg-slate-800/40 hover:bg-slate-800/70 text-left transition-colors"
                  >
                    <span className="text-teal-400 text-[10px] mt-0.5 flex-shrink-0">{isOpen ? '▼' : '▶'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-mono text-teal-300 break-all">{prefixCurie(id, ctx)}</div>
                      <div className="text-[9px] text-slate-500 font-mono">
                        rdf:type <span className="text-slate-400">{prefixCurie(type, ctx)}</span>
                        {title && <span className="ml-2 text-slate-500 not-italic">— {title}</span>}
                      </div>
                    </div>
                    <div className="text-[9px] text-slate-600 flex-shrink-0 ml-2">{predicates.length} triples</div>
                  </button>
                  {isOpen && (
                    <div className="bg-slate-900/60 border-t border-slate-700/40">
                      <table className="w-full table-fixed text-[10px] font-mono">
                        <thead>
                          <tr className="border-b border-slate-700/30">
                            <th className="text-left text-slate-600 px-3 py-1.5 w-[30%]">Subject</th>
                            <th className="text-left text-slate-600 px-3 py-1.5 w-[35%]">Predicate</th>
                            <th className="text-left text-slate-600 px-3 py-1.5">Object</th>
                          </tr>
                        </thead>
                        <tbody>
                          {predicates.map(([pred, val]) => (
                            <tr key={pred} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                              <td className="px-3 py-1 text-teal-300/70 truncate max-w-0" title={id}>
                                {prefixCurie(id, ctx)}
                              </td>
                              <td className="px-3 py-1 text-slate-500 truncate max-w-0" title={pred}>
                                {prefixCurie(pred, ctx)}
                              </td>
                              <td className="px-3 py-1 text-slate-300 break-all">
                                {typeof val === 'boolean'
                                  ? <span className={val ? 'text-emerald-400' : 'text-red-400'}>{String(val)}</span>
                                  : typeof val === 'string'
                                  ? <span className="text-amber-300">"{val}"</span>
                                  : <span>{JSON.stringify(val)}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── SPARQL Query ── */}
        {activeTab === 'query' && (
          <div className="space-y-3">
            {/* Preset selector */}
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-slate-500 flex-shrink-0">Voorinstelling:</label>
              <select
                className="flex-1 text-[11px] bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-slate-200 font-mono focus:outline-none focus:border-teal-600"
                onChange={e => setSparqlQuery(PRESET_QUERIES[parseInt(e.target.value)].query)}
              >
                {PRESET_QUERIES.map((q, i) => (
                  <option key={i} value={i}>{q.label}</option>
                ))}
              </select>
            </div>

            {/* Editor */}
            <textarea
              value={sparqlQuery}
              onChange={e => setSparqlQuery(e.target.value)}
              rows={9}
              spellCheck={false}
              className="w-full text-[11px] font-mono bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2.5 text-emerald-300 focus:outline-none focus:border-teal-600 resize-none leading-relaxed"
            />

            {/* Run button + status */}
            <div className="flex items-center gap-3">
              <button
                onClick={runQuery}
                disabled={queryLoading}
                className="flex items-center gap-2 px-4 py-1.5 bg-teal-700 hover:bg-teal-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[11px] font-semibold rounded-lg transition-colors"
              >
                {queryLoading
                  ? <><span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />Uitvoeren...</>
                  : <>▶ Query uitvoeren</>}
              </button>
              {queryMs !== null && !queryLoading && (
                <span className="text-[10px] text-slate-500 font-mono">{queryMs} ms</span>
              )}
              {queryResult && (
                <span className="text-[10px] text-teal-400 font-mono ml-auto">
                  {queryResult.results?.bindings?.length ?? 0} rijen
                </span>
              )}
            </div>

            {/* Error */}
            {queryError && (
              <div className="bg-red-900/20 border border-red-700/50 rounded-lg px-3 py-2 text-[10px] font-mono text-red-300 break-all">
                {queryError}
              </div>
            )}

            {/* Results table */}
            {queryResult?.results?.bindings && queryResult.results.bindings.length > 0 && (
              <div className="border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] font-mono">
                    <thead>
                      <tr className="bg-slate-800/70 border-b border-slate-700">
                        {queryResult.head.vars.map(v => (
                          <th key={v} className="text-left text-teal-400 px-3 py-2 whitespace-nowrap">?{v}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.results.bindings.map((row, i) => (
                        <tr key={i} className={`border-b border-slate-800/60 ${i % 2 === 0 ? '' : 'bg-slate-800/20'} hover:bg-slate-800/40`}>
                          {queryResult.head.vars.map(v => {
                            const cell = row[v];
                            if (!cell) return <td key={v} className="px-3 py-1.5 text-slate-600">—</td>;
                            const display = cell.type === 'uri' ? prefixCurie(cell.value, ctx) : cell.value;
                            return (
                              <td key={v} className="px-3 py-1.5 max-w-xs" title={cell.value}>
                                {cell.type === 'uri'
                                  ? <span className="text-teal-300">{display}</span>
                                  : cell.type === 'typed-literal' || cell.type === 'literal'
                                  ? <span className="text-amber-300">"{display}"</span>
                                  : <span className="text-slate-300">{display}</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {queryResult?.results?.bindings?.length === 0 && (
              <div className="text-center text-[11px] text-slate-600 py-6 italic">Geen resultaten</div>
            )}
          </div>
        )}

        {/* ── @context ── */}
        {activeTab === 'context' && (
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 mb-3">JSON-LD namespace-prefixen — {Object.keys(ctx).length} gedeclareerd</p>
            {Object.entries(ctx).map(([prefix, ns]) => (
              <div key={prefix} className="flex gap-3 text-[10px] font-mono bg-slate-800/40 border border-slate-700/40 rounded-lg px-3 py-2">
                <span className="text-teal-400 w-24 flex-shrink-0 font-semibold">{prefix}:</span>
                <span className="text-slate-400 break-all">{ns}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Wallet credential cards view ----

interface FullCredential {
  id: string;
  type: string[];
  issuer: string | { id: string; name: string };
  validFrom: string;
  validUntil?: string;
  receivedAt: string;
  folders?: string[];
  isDummy?: boolean;
  isFavorite?: boolean;
  raw: Record<string, unknown>;
}

interface WalletFolder {
  id: string;
  label: string;
  icon: string;
  description: string;
}

// Puur visuele aantallen (demo): de wallet toont een groot archief zonder dat al die credentials bestaan
const DISPLAY_TOTAL_CREDENTIALS = 1890;
const DISPLAY_FOLDER_COUNTS: Record<string, number> = { archief: 1886 };
const displayCount = (folderId: string, actual: number) => DISPLAY_FOLDER_COUNTS[folderId] ?? actual;

const FOLDER_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  veelgebruikt: { color: 'text-amber-300',   bg: 'bg-amber-900/15',   border: 'border-amber-700/40' },
  medisch:      { color: 'text-rose-300',    bg: 'bg-rose-900/15',    border: 'border-rose-700/40' },
  opleiding:    { color: 'text-emerald-300', bg: 'bg-emerald-900/15', border: 'border-emerald-700/40' },
  wonen:        { color: 'text-orange-300',  bg: 'bg-orange-900/15',  border: 'border-orange-700/40' },
  juridisch:    { color: 'text-violet-300',  bg: 'bg-violet-900/15',  border: 'border-violet-700/40' },
  archief:      { color: 'text-slate-300',   bg: 'bg-slate-800/40',   border: 'border-slate-600/50' },
};

const CRED_META: Record<string, { icon: string; color: string; bg: string; border: string; label: string }> = {
  BirthCertificateCredential:     { icon: '📜', color: 'text-violet-300', bg: 'bg-violet-900/20', border: 'border-violet-700/50', label: 'Geboorteakte' },
  EUCitizenshipCredential:        { icon: '🇪🇺', color: 'text-blue-300',   bg: 'bg-blue-900/20',   border: 'border-blue-700/50',   label: 'EU-burgerschap' },
  UniversityEnrollmentCredential: { icon: '🎓', color: 'text-emerald-300', bg: 'bg-emerald-900/20',border: 'border-emerald-700/50',label: 'Inschrijving onderwijs' },
  OVCredential:                   { icon: '🎫', color: 'text-amber-300',   bg: 'bg-amber-900/20',  border: 'border-amber-700/50',  label: 'OV-credential' },
  YouthOVCredential:              { icon: '🎫', color: 'text-amber-300',   bg: 'bg-amber-900/20',  border: 'border-amber-700/50',  label: 'Jeugd-OV Credential' },
  PublicTransportCredential:      { icon: '', color: 'text-amber-300',   bg: 'bg-amber-900/20',  border: 'border-amber-700/50',  label: 'OV-credential (vervoerder)' },
  StudentOVCredential:            { icon: '🎫', color: 'text-amber-300',   bg: 'bg-amber-900/20',  border: 'border-amber-700/50',  label: 'Studenten-OV Credential' },
  DriversLicenseCredential:       { icon: '🚗', color: 'text-sky-300',     bg: 'bg-sky-900/20',    border: 'border-sky-700/50',    label: 'Rijbewijs' },
  ResidenceAddressCredential:     { icon: '🏠', color: 'text-orange-300',  bg: 'bg-orange-900/20', border: 'border-orange-700/50', label: 'Woonadres (BRP)' },
  HealthInsuranceCredential:      { icon: '🏥', color: 'text-rose-300',    bg: 'bg-rose-900/20',   border: 'border-rose-700/50',   label: 'Zorgverzekeringspas' },
  VaccinationCredential:          { icon: '💉', color: 'text-pink-300',    bg: 'bg-pink-900/20',   border: 'border-pink-700/50',   label: 'Vaccinatiebewijs' },
  OrganDonorCredential:           { icon: '❤️', color: 'text-red-300',     bg: 'bg-red-900/20',    border: 'border-red-700/50',    label: 'Donorregistratie' },
  SecondaryEducationDiplomaCredential: { icon: '📘', color: 'text-teal-300', bg: 'bg-teal-900/20', border: 'border-teal-700/50',   label: 'VWO-diploma' },
  LanguageCertificateCredential:  { icon: '🗣️', color: 'text-lime-300',    bg: 'bg-lime-900/20',   border: 'border-lime-700/50',   label: 'Taalcertificaat' },
  ParentalAuthorityCredential:    { icon: '', color: 'text-violet-300',  bg: 'bg-violet-900/20', border: 'border-violet-700/50', label: 'Ouderlijk gezag' },
  MandateCredential:              { icon: '', color: 'text-indigo-300',  bg: 'bg-indigo-900/20', border: 'border-indigo-700/50', label: 'Machtiging' },
  CuratorshipCredential:          { icon: '', color: 'text-purple-300',  bg: 'bg-purple-900/20', border: 'border-purple-700/50', label: 'Curatele' },
  PropertyOwnershipCredential:    { icon: '', color: 'text-orange-300',  bg: 'bg-orange-900/20', border: 'border-orange-700/50', label: 'Eigendomsbewijs woning' },
  MiningDamageReportCredential:   { icon: '', color: 'text-amber-300',   bg: 'bg-amber-900/20',  border: 'border-amber-700/50',  label: 'Schaderapport mijnbouwschade' },
  SustainabilityInvoiceCredential:{ icon: '', color: 'text-lime-300',    bg: 'bg-lime-900/20',   border: 'border-lime-700/50',   label: 'Factuur zonnepanelen' },
  StudyFinanceCredential:         { icon: '', color: 'text-orange-300',  bg: 'bg-orange-900/20', border: 'border-orange-700/50', label: 'Studiefinanciering' },
  FirstAidCertificateCredential:  { icon: '⛑️', color: 'text-red-300',     bg: 'bg-red-900/20',    border: 'border-red-700/50',    label: 'EHBO-certificaat' },
};

function credMeta(types: string[]) {
  for (const t of types) {
    if (CRED_META[t]) return CRED_META[t];
  }
  return { icon: '📄', color: 'text-slate-300', bg: 'bg-slate-800/40', border: 'border-slate-700/50', label: types.filter(t => t !== 'VerifiableCredential')[0] || 'Credential' };
}

function CredentialDetailOverlay({ cred, onClose }: { cred: FullCredential; onClose: () => void }) {
  const meta = credMeta(cred.type);
  const subject = cred.raw.credentialSubject as Record<string, unknown> | undefined;
  const proof = cred.raw._proof as Record<string, unknown> | undefined;
  const issuerName = typeof cred.issuer === 'object' ? cred.issuer.name : cred.issuer;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-950/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 20 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-xl max-h-[88vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b border-slate-700 flex-shrink-0 rounded-t-2xl ${meta.bg}`}>
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-bold ${meta.color}`}>{meta.label}</h3>
            <p className="text-[10px] text-slate-500 truncate">{cred.id}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none flex-shrink-0">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Issuer + validity */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`${meta.bg} ${meta.border} border rounded-xl px-3 py-2.5`}>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Uitgever</div>
              <div className="text-[11px] text-slate-200 font-mono break-all">{issuerName}</div>
            </div>
            <div className={`${meta.bg} ${meta.border} border rounded-xl px-3 py-2.5`}>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Geldig tot</div>
              <div className="text-[11px] text-slate-200 font-mono">{cred.validUntil ? new Date(cred.validUntil).toLocaleDateString('nl-NL') : '—'}</div>
            </div>
          </div>

          {/* Claims */}
          {subject && (
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>credentialSubject</span>
                <span className="text-[9px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 font-normal normal-case tracking-normal text-slate-400">SD-JWT selectively disclosed</span>
              </div>
              <div className="space-y-1.5">
                {Object.entries(subject).map(([k, v]) => (
                  v && typeof v === 'object' && !Array.isArray(v) ? (
                    <div key={k} className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[11px] font-mono">
                      <div className="text-slate-300 font-semibold mb-1.5">{k}</div>
                      <div className="space-y-1 pl-3 border-l border-slate-700">
                        {Object.entries(v as Record<string, unknown>).map(([sk, sv]) => (
                          <div key={sk} className="flex items-start justify-between gap-3">
                            <span className="text-slate-500">{sk}</span>
                            <span className="text-sky-300 text-right break-words">{typeof sv === 'string' ? sv : JSON.stringify(sv)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div key={k} className="flex items-start justify-between gap-3 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[11px] font-mono">
                      <span className="text-slate-400 flex-shrink-0">{k}</span>
                      <span className={`font-semibold text-right break-words ${v === true ? 'text-green-400' : v === false ? 'text-slate-500' : 'text-sky-300'}`}>
                        {Array.isArray(v) ? v.join(', ') : JSON.stringify(v)}
                      </span>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Proof */}
          {proof && (
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Proof</div>
              <div className="space-y-1.5">
                {Object.entries(proof).map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-3 bg-slate-800/40 border border-slate-700/30 rounded-lg px-3 py-2 text-[10px] font-mono">
                    <span className="text-slate-500 flex-shrink-0">{k}</span>
                    <span className="text-slate-300 text-right break-all">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw JSON toggle */}
          <details className="group">
            <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300 select-none list-none flex items-center gap-1.5">
              <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
              Bekijk ruwe JSON-LD
            </summary>
            <pre className="mt-2 text-[10px] font-mono text-slate-300 bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
              {JSON.stringify(cred.raw, null, 2)}
            </pre>
          </details>
        </div>
      </motion.div>
    </motion.div>
  );
}

function credStatus(cred: FullCredential): 'VALID' | 'EXPIRED' | 'REVOKED' {
  const status = cred.raw.credentialStatus as { status?: string } | undefined;
  if (status?.status === 'revoked') return 'REVOKED';
  if (cred.validUntil && new Date(cred.validUntil) < new Date()) return 'EXPIRED';
  return 'VALID';
}

const STATUS_BADGE: Record<ReturnType<typeof credStatus>, { label: string; cls: string }> = {
  VALID:   { label: 'GELDIG',     cls: 'bg-green-900/50 text-green-400 border border-green-700/40' },
  EXPIRED: { label: 'VERLOPEN',   cls: 'bg-red-900/50 text-red-400 border border-red-700/40' },
  REVOKED: { label: 'INGETROKKEN', cls: 'bg-slate-800 text-slate-400 border border-slate-600/60' },
};

function CredentialCard({ cred, onClick }: { cred: FullCredential; onClick: () => void }) {
  const meta = credMeta(cred.type);
  const specificType = cred.type.find(t => t !== 'VerifiableCredential') || cred.type[0];
  const issuerName = typeof cred.issuer === 'object' ? (cred.issuer as { name: string }).name : cred.issuer;
  const status = credStatus(cred);
  const badge = STATUS_BADGE[status];

  return (
    <motion.button
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={`w-full text-left ${meta.bg} ${meta.border} border rounded-xl px-4 py-3.5 transition-all hover:brightness-125 cursor-pointer group ${status !== 'VALID' ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
            {cred.isFavorite && (
              <span className="text-amber-400 text-sm leading-none" title="Favoriet credential" aria-label="Favoriet">★</span>
            )}
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
            {!cred.isDummy && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-cyan-900/40 text-cyan-300 border border-cyan-700/40">ACTIEF IN DEMO</span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">{specificType}</div>
          <div className="text-[10px] text-slate-500 mt-1">Uitgegeven door <span className="text-slate-400">{issuerName}</span></div>
          {cred.validUntil && (
            <div className="text-[9px] text-slate-600 mt-0.5">Geldig tot {new Date(cred.validUntil).toLocaleDateString('nl-NL')}</div>
          )}
        </div>
        <span className={`text-[10px] ${meta.color} opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1`}>Bekijk →</span>
      </div>
    </motion.button>
  );
}

interface PermissionsPayload {
  parties: Array<{ id: string; label: string }>;
  folders: WalletFolder[];
  permissions: Record<string, Record<string, boolean>>;
  grants?: Array<{ partyId: string; partyName: string; credentialId: string; credentialLabel: string; folderId: string; note?: string }>;
  notifications?: Array<{
    id: string;
    partyName: string;
    title: string;
    message: string;
    actions: Array<{ id: string; label: string; variant: 'primary' | 'danger' | 'neutral' }>;
  }>;
}

const ACTION_STYLE: Record<string, string> = {
  primary: 'bg-cyan-600/80 hover:bg-cyan-500 text-white border-cyan-500/60',
  danger:  'bg-red-600/80 hover:bg-red-500 text-white border-red-500/60',
  neutral: 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600',
};

function usePermissions() {
  const [data, setData] = useState<PermissionsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiFetch(`/api/wallet/permissions`)
      .then(r => r.json())
      .then(d => setData(d as PermissionsPayload))
      .catch(e => setError(String(e)));
  }, []);
  return { data, setData, error, setError };
}

function PermissionsIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border transition-colors ${
        checked ? 'bg-emerald-500/80 border-emerald-400/60' : 'bg-slate-700 border-slate-600'
      } ${disabled ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
    </button>
  );
}

function PermissionsView({ onBack, perms }: { onBack: () => void; perms: ReturnType<typeof usePermissions> }) {
  const { data, setData, error, setError } = perms;
  const [pending, setPending] = useState<string | null>(null);

  const resolve = async (notificationId: string, action: string) => {
    setPending(`notif:${notificationId}`);
    try {
      const r = await apiFetch(`/api/wallet/permissions/notifications/${encodeURIComponent(notificationId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json() as PermissionsPayload);
    } catch (e) {
      setError(`Afhandelen mislukt: ${String(e)}`);
    } finally {
      setPending(null);
    }
  };

  const update = async (folderId: string, partyId: string, allowed: boolean) => {
    if (!data) return;
    const key = `${folderId}:${partyId}`;
    const previous = data;
    // Optimistische update
    setData({ ...data, permissions: { ...data.permissions, [folderId]: { ...data.permissions[folderId], [partyId]: allowed } } });
    setPending(key);
    try {
      const r = await apiFetch(`/api/wallet/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, partyId, allowed }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json() as PermissionsPayload);
    } catch (e) {
      setData(previous);
      setError(`Opslaan mislukt: ${String(e)}`);
    } finally {
      setPending(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800/60 border border-slate-700 rounded-lg px-2.5 py-1"
        >
          ← Wallet
        </button>
        <PermissionsIcon className="w-4 h-4 text-cyan-300" />
        <span className="text-sm font-semibold text-cyan-300">Permissies</span>
      </div>
      <p className="text-[10px] text-slate-500 mb-4">Bepaal per map welke partijen toegang hebben tot de credentials in die map.</p>

      {error && <p className="text-[11px] text-red-400 mb-3">{error}</p>}
      {!data && !error && <p className="text-[11px] text-slate-500">Laden…</p>}

      {data && (data.notifications?.length ?? 0) > 0 && (
        <div className="mb-5">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Notificaties ({data.notifications!.length})</div>
          <div className="space-y-2.5">
            <AnimatePresence>
              {data.notifications!.map(n => (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="bg-amber-900/15 border border-amber-600/40 rounded-xl p-3.5"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    <span className="text-[12px] font-semibold text-amber-200">{n.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mb-3 pl-3.5">{n.message}</p>
                  <div className="flex flex-wrap gap-2 pl-3.5">
                    {n.actions.map(a => (
                      <button
                        key={a.id}
                        disabled={pending === `notif:${n.id}`}
                        onClick={() => resolve(n.id, a.id)}
                        className={`text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${ACTION_STYLE[a.variant]}`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {data && (
        <div className="space-y-3">
          {data.folders.map(f => {
            const style = FOLDER_STYLE[f.id] ?? FOLDER_STYLE.archief;
            const perms = data.permissions[f.id] ?? {};
            const allowedCount = data.parties.filter(p => perms[p.id]).length;
            return (
              <div key={f.id} className={`${style.bg} ${style.border} border rounded-xl p-3.5`}>
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`text-sm font-semibold ${style.color}`}>{f.label}</span>
                  <span className="text-[10px] text-slate-500">{allowedCount} van {data.parties.length} toegestaan</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {data.parties.map(p => {
                    const key = `${f.id}:${p.id}`;
                    const checked = perms[p.id] === true;
                    return (
                      <label key={p.id} className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                        <span className={checked ? 'text-slate-200' : 'text-slate-500'}>{p.label}</span>
                        <Toggle
                          checked={checked}
                          disabled={pending === key}
                          label={`${p.label} toegang tot ${f.label}`}
                          onChange={v => update(f.id, p.id, v)}
                        />
                      </label>
                    );
                  })}
                </div>
                {(data.grants ?? []).filter(g => g.folderId === f.id).length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-700/50">
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5">Toegang tot individuele credentials</div>
                    {(data.grants ?? []).filter(g => g.folderId === f.id).map(g => (
                      <div key={`${g.partyName}-${g.credentialId}`} className="flex items-center justify-between text-[11px] py-0.5">
                        <span className="text-slate-300">{g.partyName} <span className="text-slate-500">→ {g.credentialLabel}</span></span>
                        {g.note && <span className="text-[10px] text-slate-500">{g.note}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TransparencyIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SubsidyIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5a3 3 0 1 0 0 5M8 11h5M8 13h5" />
    </svg>
  );
}

function ScanIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 12h10" />
    </svg>
  );
}

const SEVERITY_STYLE: Record<ScanSeverity, { label: string; dot: string; text: string; box: string }> = {
  hoog:   { label: 'Hoog',   dot: 'bg-red-400',   text: 'text-red-300',   box: 'bg-red-900/15 border-red-700/40' },
  middel: { label: 'Middel', dot: 'bg-amber-400', text: 'text-amber-300', box: 'bg-amber-900/15 border-amber-700/40' },
  laag:   { label: 'Laag',   dot: 'bg-sky-400',   text: 'text-sky-300',   box: 'bg-sky-900/10 border-sky-700/30' },
};

const SCAN_STEPS = [
  'Credentials inlezen…',
  'Geldigheid en vervaldata controleren…',
  'Intrekkingsstatus bij uitgevers controleren…',
  'Permissies per map analyseren…',
  'Toegang van partijen tot individuele credentials controleren…',
  'Rapport opstellen…',
];
const SCAN_DURATION_MS = 5000;
const LAST_SCAN_KEY = 'wallet:lastScan';

function ScanReportPanel({ report, heading }: { report: ScanReport; heading: string }) {
  const grouped = report.findings.reduce<Record<string, typeof report.findings>>((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {});
  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">{heading}</div>
          <div className="text-[12px] text-slate-200 font-medium mt-0.5">
            {new Date(report.scannedAt).toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' })}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500">Gescand</div>
          <div className="text-[12px] text-slate-200 font-semibold tabular-nums">{report.credentialsScanned.toLocaleString('nl-NL')} credentials</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {(['hoog', 'middel', 'laag'] as ScanSeverity[]).map(sev => (
          <div key={sev} className={`${SEVERITY_STYLE[sev].box} border rounded-lg px-3 py-2`}>
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">Risico {SEVERITY_STYLE[sev].label.toLowerCase()}</div>
            <div className={`text-lg font-bold tabular-nums ${SEVERITY_STYLE[sev].text}`}>{report.counts[sev]}</div>
          </div>
        ))}
      </div>

      {report.findings.length === 0 ? (
        <p className="text-[11px] text-emerald-400">Geen problemen gevonden. Uw wallet is op orde.</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="text-[10px] text-slate-400 font-semibold mb-1.5">{category} <span className="text-slate-600 font-normal">({items.length})</span></div>
              <div className="space-y-1.5">
                {items.map((f, i) => (
                  <div key={i} className={`${SEVERITY_STYLE[f.severity].box} border rounded-lg px-3 py-2`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEVERITY_STYLE[f.severity].dot}`} />
                      <span className="text-[11px] text-slate-200 font-medium flex-1">{f.title}</span>
                      <span className={`text-[9px] uppercase tracking-wider ${SEVERITY_STYLE[f.severity].text}`}>{SEVERITY_STYLE[f.severity].label}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 pl-3.5 leading-snug">{f.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CredentialScanOverlay({
  credentials, perms, onClose
}: {
  credentials: FullCredential[];
  perms: PermissionsPayload | null;
  onClose: () => void;
}) {
  const buildReport = (now?: Date) => runWalletScan(
    credentials.map(c => ({
      id: c.id,
      type: c.type,
      label: credMeta(c.type).label,
      validUntil: c.validUntil,
      folders: c.folders,
      revoked: credStatus(c) === 'REVOKED',
    })),
    perms,
    { now, displayTotal: DISPLAY_TOTAL_CREDENTIALS, archivedDisplayCount: DISPLAY_FOLDER_COUNTS.archief }
  );

  const [lastScan, setLastScan] = useState<ScanReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [freshReport, setFreshReport] = useState<ScanReport | null>(null);

  // Laatste scan ophalen (of een eerdere demo-scan van 12 dagen geleden tonen)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_SCAN_KEY);
      if (stored) { setLastScan(JSON.parse(stored) as ScanReport); return; }
    } catch { /* ignore */ }
    setLastScan(buildReport(new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Voortgangsbalk: 5 seconden, daarna rapport
  useEffect(() => {
    if (!scanning) return;
    const start = Date.now();
    const timer = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / SCAN_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timer);
        const report = buildReport();
        setFreshReport(report);
        setLastScan(report);
        try { localStorage.setItem(LAST_SCAN_KEY, JSON.stringify(report)); } catch { /* ignore */ }
        setScanning(false);
      }
    }, 50);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const startScan = () => {
    setFreshReport(null);
    setProgress(0);
    setScanning(true);
  };

  const stepIndex = Math.min(SCAN_STEPS.length - 1, Math.floor((progress / 100) * SCAN_STEPS.length));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-xl max-h-[88vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <ScanIcon className="w-5 h-5 text-violet-300" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-100">Credential scan</h3>
            <p className="text-[10px] text-slate-500">Controleert geldigheid, intrekkingen en toegang van partijen</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Nu scannen */}
          <div className="bg-violet-900/15 border border-violet-700/40 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[12px] text-violet-200 font-semibold">Nu scannen</div>
                <div className="text-[10px] text-slate-500">Voer een volledige controle uit op alle credentials en permissies</div>
              </div>
              <button
                onClick={startScan}
                disabled={scanning}
                className="flex-shrink-0 text-[11px] font-medium px-3.5 py-2 rounded-lg border bg-violet-600/80 hover:bg-violet-500 text-white border-violet-500/60 disabled:opacity-50 disabled:cursor-wait"
              >
                {scanning ? 'Bezig met scannen…' : 'Nu scannen'}
              </button>
            </div>
            {scanning && (
              <div className="mt-4">
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full transition-[width] duration-75" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px]">
                  <span className="text-slate-400">{SCAN_STEPS[stepIndex]}</span>
                  <span className="text-slate-500 tabular-nums">{Math.round(progress)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Rapport van de nieuwe scan, of info over de laatste scan */}
          {!scanning && freshReport && <ScanReportPanel report={freshReport} heading="Scanrapport" />}
          {!scanning && !freshReport && lastScan && <ScanReportPanel report={lastScan} heading="Laatste scan" />}
        </div>
      </motion.div>
    </motion.div>
  );
}

function WalletView({ data }: { data: Record<string, unknown> }) {
  const [selected, setSelected] = useState<FullCredential | null>(null);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [showSubsidy, setShowSubsidy] = useState(false);
  const [transparency, setTransparency] = useState<TransparencyPayload | null>(null);
  const [openTransparency, setOpenTransparency] = useState<string | null>(null);
  useEffect(() => {
    apiFetch(`/api/wallet/transparency`)
      .then(r => r.json())
      .then(d => setTransparency(d as TransparencyPayload))
      .catch(() => { /* knop toont dan geen badge */ });
  }, []);
  const openTransparencyRequest = () => {
    const req = transparency?.requests[0];
    if (!req) return;
    setOpenTransparency(req.id);
    if (!req.read) {
      apiFetch(`/api/wallet/transparency/${encodeURIComponent(req.id)}/read`, { method: 'POST' })
        .then(r => r.json())
        .then(d => setTransparency(d as TransparencyPayload))
        .catch(() => { /* ignore */ });
    }
  };
  const transparencyUnread = transparency?.unread ?? 0;
  const transparencyRequest = transparency?.requests.find(r => r.id === openTransparency) ?? null;
  const perms = usePermissions();
  const notificationCount = perms.data?.notifications?.length ?? 0;

  const payload = data['/credentials/full'] as { count: number; credentials: FullCredential[]; folders?: WalletFolder[] } | undefined;
  if (!payload) return <GenericServiceView data={data} />;

  const { credentials } = payload;
  const folders = payload.folders ?? [];
  const inFolder = (id: string) => credentials.filter(c => c.folders?.includes(id));
  const folder = folders.find(f => f.id === openFolder);
  const favorites = credentials.filter(c => c.isFavorite);

  return (
    <>
      <AnimatePresence mode="wait">
        {showPermissions ? (
          <motion.div key="permissions" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
            <PermissionsView onBack={() => setShowPermissions(false)} perms={perms} />
          </motion.div>
        ) : !folder ? (
          <motion.div key="folders" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
            <div className="flex items-center justify-end flex-wrap gap-x-3 gap-y-2.5 mb-3">
              <span className="text-[11px] text-slate-400">Totaal <span className="font-semibold text-slate-200 tabular-nums">{DISPLAY_TOTAL_CREDENTIALS.toLocaleString('nl-NL')}</span> credentials</span>
              <button
                onClick={openTransparencyRequest}
                disabled={!transparency?.requests.length}
                title="Transparantie verzoek"
                aria-label={`Transparantie verzoek${transparencyUnread ? ` — ${transparencyUnread} nieuw` : ''}`}
                className="relative flex items-center gap-1.5 text-[11px] text-orange-300 bg-orange-900/20 border border-orange-700/40 rounded-lg px-2.5 py-1.5 hover:brightness-125 transition-all disabled:opacity-50"
              >
                <TransparencyIcon className="w-3.5 h-3.5" />
                Transparantie verzoek
                {transparencyUnread > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center shadow">
                    {transparencyUnread}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowSubsidy(true)}
                title="Subsidie- en toelagenscanner"
                className="flex items-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-900/20 border border-emerald-700/40 rounded-lg px-2.5 py-1.5 hover:brightness-125 transition-all"
              >
                <SubsidyIcon className="w-3.5 h-3.5" />
                Subsidie- en toelagenscanner
              </button>
              <button
                onClick={() => setShowScan(true)}
                title="Credential scan"
                className="flex items-center gap-1.5 text-[11px] text-violet-300 bg-violet-900/20 border border-violet-700/40 rounded-lg px-2.5 py-1.5 hover:brightness-125 transition-all"
              >
                <ScanIcon className="w-3.5 h-3.5" />
                Credential scan
              </button>
              <button
                onClick={() => setShowPermissions(true)}
                title="Permissies beheren"
                aria-label={`Permissies beheren${notificationCount ? ` — ${notificationCount} notificaties` : ''}`}
                className="relative flex items-center gap-1.5 text-[11px] text-cyan-300 bg-cyan-900/20 border border-cyan-700/40 rounded-lg px-2.5 py-1.5 hover:brightness-125 transition-all"
              >
                <PermissionsIcon className="w-3.5 h-3.5" />
                Permissies
                {notificationCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center shadow">
                    {notificationCount}
                  </span>
                )}
              </button>
            </div>
            {favorites.length > 0 && (
              <div className="mb-5">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="text-amber-400">★</span> Favoriet
                </div>
                <div className="space-y-3">
                  {favorites.map(cred => (
                    <CredentialCard key={cred.id} cred={cred} onClick={() => setSelected(cred)} />
                  ))}
                </div>
              </div>
            )}
            <p className="text-[10px] text-slate-500 mb-4">Kies een map</p>
            <div className="grid grid-cols-2 gap-3">
              {folders.map(f => {
                const style = FOLDER_STYLE[f.id] ?? FOLDER_STYLE.archief;
                const items = inFolder(f.id);
                return (
                  <motion.button
                    key={f.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setOpenFolder(f.id)}
                    className={`text-left ${style.bg} ${style.border} border rounded-xl p-4 hover:brightness-125 transition-all cursor-pointer`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={`text-sm font-semibold ${style.color}`}>{f.label}</div>
                      <span className={`text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full bg-slate-900/60 flex-shrink-0 ${style.color}`}>{displayCount(f.id, items.length).toLocaleString('nl-NL')}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{f.description}</div>
                    <div className="text-[10px] text-slate-400 mt-2.5 truncate">
                      {items.slice(0, 3).map(c => credMeta(c.type).label).join(', ')}
                      {displayCount(f.id, items.length) > 3 && ` +${(displayCount(f.id, items.length) - 3).toLocaleString('nl-NL')}`}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div key={folder.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setOpenFolder(null)}
                className="text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800/60 border border-slate-700 rounded-lg px-2.5 py-1"
              >
                ← Mappen
              </button>
              <span className={`text-sm font-semibold ${(FOLDER_STYLE[folder.id] ?? FOLDER_STYLE.archief).color}`}>{folder.label}</span>
              <span className="text-[10px] text-slate-500 ml-auto">{displayCount(folder.id, inFolder(folder.id).length).toLocaleString('nl-NL')} credentials</span>
            </div>
            <div className="space-y-3">
              {inFolder(folder.id).map(cred => (
                <CredentialCard key={cred.id} cred={cred} onClick={() => setSelected(cred)} />
              ))}
              {inFolder(folder.id).length === 0 && (
                <p className="text-[11px] text-slate-500 text-center py-8">Deze map is leeg.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <CredentialDetailOverlay cred={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {transparencyRequest && (
          <TransparencyOverlay request={transparencyRequest} onClose={() => setOpenTransparency(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSubsidy && (
          <SubsidyScanOverlay credentials={credentials} onClose={() => setShowSubsidy(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScan && (
          <CredentialScanOverlay credentials={credentials} perms={perms.data} onClose={() => setShowScan(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ---- Generic JSON view ----

function GenericServiceView({ data }: { data: Record<string, unknown> }) {
  return (
    <>
      {Object.entries(data).map(([path, value]) => (
        <div key={path} className="mb-5">
          <div className="text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider">
            GET {path}
          </div>
          <pre className="text-[11px] font-mono text-slate-200 bg-slate-800/60 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      ))}
    </>
  );
}

function ServiceModal({
  service, onClose, ageProfile, onToggleAge, ageLoading
}: {
  service: typeof SERVICES[number];
  onClose: () => void;
  ageProfile?: 'over18' | 'under18';
  onToggleAge?: () => void;
  ageLoading?: boolean;
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch on mount (and re-fetch when age profile changes for wallet)
  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/service/${service.key}`)
      .then(r => r.json())
      .then(d => { setData(d as Record<string, unknown>); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [service.key, ageProfile]);

  // For triply, extract the JSON-LD payload from the proxied response
  const triplyDataset = (service.key === 'triply' && data)
    ? (data['/rules/jsonld'] as JsonLdDataset | undefined)
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.18 }}
        className={`w-full bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col ${service.key === 'triply' ? 'max-w-4xl max-h-[90vh]' : 'max-w-2xl max-h-[80vh]'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700 flex-shrink-0">
          {service.key !== 'wallet' && <span className="text-xl">{service.icon}</span>}
          <div>
            <h2 className="text-sm font-bold text-slate-100">{service.label}</h2>
            <p className="text-[10px] text-slate-500">
              {service.key === 'triply' ? 'Linked data-dataset (JSON-LD / RDF)' : service.key === 'wallet' ? 'W3C Verifiable Credentials — klik om te bekijken' : 'Live servicestatus'}
            </p>
          </div>
          {/* Age profile toggle — only in wallet modal */}
          {service.key === 'wallet' && onToggleAge && ageProfile && (
            <button
              onClick={onToggleAge}
              disabled={ageLoading}
              className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                ageProfile === 'under18'
                  ? 'border-green-500/50 bg-green-500/10 text-green-400'
                  : 'border-blue-500/50 bg-blue-500/10 text-blue-400'
              } ${ageLoading ? 'opacity-50' : 'hover:opacity-80'}`}
            >
              <span>{ageProfile === 'under18' ? '🧒' : '🎓'}</span>
              {ageProfile === 'under18' ? 'Onder 18 (Jeugd)' : '18+ (Student)'}
            </button>
          )}
          <button
            onClick={onClose}
            className={`${service.key === 'wallet' && onToggleAge ? '' : 'ml-auto '}text-slate-500 hover:text-slate-300 text-lg leading-none`}
          >✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
              Laden...
            </div>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {data && triplyDataset && <TriplyDBView dataset={triplyDataset} />}
          {data && service.key === 'wallet' && !triplyDataset && <WalletView data={data} />}
          {data && service.key !== 'wallet' && !triplyDataset && <GenericServiceView data={data} />}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function CredentialFlow({ currentStep }: { currentStep: FlowStep }) {
  const [openService, setOpenService] = useState<typeof SERVICES[number] | null>(null);
  const [showLLMConfig, setShowLLMConfig] = useState(false);
  const [ageProfile, setAgeProfile] = useState<'over18' | 'under18'>('over18');
  const [ageLoading, setAgeLoading] = useState(false);

  // Fetch current age profile on mount
  useEffect(() => {
    apiFetch(`/api/wallet/profile`)
      .then(r => r.json())
      .then(d => { if (d.ageProfile) setAgeProfile(d.ageProfile); })
      .catch(() => {});
  }, []);

  function toggleAgeProfile() {
    const next = ageProfile === 'over18' ? 'under18' : 'over18';
    setAgeLoading(true);
    apiFetch(`/api/wallet/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ageProfile: next }),
    })
      .then(r => r.json())
      .then(d => { if (d.ageProfile) setAgeProfile(d.ageProfile); })
      .catch(() => {})
      .finally(() => setAgeLoading(false));
  }

  return (
    <>
      <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Journey steps */}
          <div className="flex items-center gap-1 overflow-x-auto flex-1">
            {STEPS.map((step, i) => {
              const complete = isStepComplete(step.key, currentStep);
              const active = step.key === currentStep ||
                (step.key === 'RULES_PRESENTED' && ['RULES_FETCHED', 'RULES_PRESENTED'].includes(currentStep)) ||
                (step.key === 'ELIGIBILITY_RESULT' && ['ELIGIBILITY_CHECKING', 'CONSENT_CHECK_GIVEN', 'ELIGIBILITY_RESULT'].includes(currentStep));

              return (
                <div key={step.key} className="flex items-center gap-1 flex-shrink-0">
                  <motion.div
                    className="flex flex-col items-center gap-1 cursor-default"
                    animate={{ scale: active ? 1.05 : 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm
                      transition-all duration-500
                      ${complete ? 'bg-transport-blue text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800 text-slate-600'}
                      ${active ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-900' : ''}
                    `}>
                      {active && currentStep === 'APPLYING' ? <span className="animate-spin">⚙️</span> : step.icon}
                    </div>
                    <span className={`text-[9px] text-center leading-tight w-12 ${complete ? 'text-slate-300' : 'text-slate-600'}`}>
                      {step.label}
                    </span>
                  </motion.div>
                  {i < STEPS.length - 1 && (
                    <div className={`h-px w-4 flex-shrink-0 mb-4 transition-all duration-500 ${complete ? 'bg-transport-blue' : 'bg-slate-700'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="w-px h-10 bg-slate-700 flex-shrink-0 mx-1" />

          {/* Service inspector icons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* LLM config button */}
            <button
              onClick={() => setShowLLMConfig(true)}
              title="Bekijk assistent- en guardrailsconfiguratie"
              className="flex flex-col items-center gap-1 px-2 py-1 rounded-lg border bg-slate-800/50 transition-all border-violet-700/60 hover:border-violet-500 text-violet-400"
            >
              <span className="text-base leading-none">🧠</span>
              <span className="text-[8px] font-medium whitespace-nowrap">Assistent</span>
            </button>

            {SERVICES.map(svc => (
              <button
                key={svc.key}
                onClick={() => setOpenService(svc)}
                title={`Bekijk ${svc.label}`}
                className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg border bg-slate-800/50 transition-all ${svc.color}`}
              >
                <span className="text-base leading-none">{svc.icon}</span>
                <span className="text-[8px] font-medium whitespace-nowrap">{svc.label}</span>
              </button>
            ))}

          </div>
        </div>

        {currentStep === 'CREDENTIAL_ISSUED' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 p-2 bg-green-900/30 border border-green-700/50 rounded-lg text-center"
          >
            <p className="text-green-400 text-xs font-medium">
              🎫 OV Credential uitgegeven aan je wallet!
            </p>
          </motion.div>
        )}
      </div>

      {/* Service inspector modal */}
      <AnimatePresence>
        {openService && (
          <ServiceModal
            service={openService}
            onClose={() => setOpenService(null)}
            ageProfile={ageProfile}
            onToggleAge={toggleAgeProfile}
            ageLoading={ageLoading}
          />
        )}
        {showLLMConfig && (
          <LLMConfigModal onClose={() => setShowLLMConfig(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
