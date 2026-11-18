'use client';
import { apiFetch } from '@/demo/api';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';


// ── Types (spiegelen wallet/src/credentials/transparency.ts) ───────────────────

interface Actor { id: string; label: string; sublabel: string }
interface Step {
  n: number;
  phase: string;
  from: string;
  to: string;
  label: string;
  protocol: string;
  timestamp: string;
  payload: unknown;
  ruleIds?: string[];
  outcome?: 'ok' | 'afgewezen' | 'info';
  guardrails?: string[];
  note?: string;
}
export interface TransparencyRequest {
  id: string;
  title: string;
  credentialType: string;
  issuer: string;
  requestedAt: string;
  decidedAt: string;
  read: boolean;
  decision: {
    result: string;
    summary: string;
    components: Array<{ label: string; granted: boolean; reason: string }>;
    reference: string;
    humanReview: string;
    objection: string;
  };
  ruleOutcomes: Record<string, string>;
  actors: Actor[];
  steps: Step[];
}
export interface TransparencyPayload { unread: number; requests: TransparencyRequest[] }

interface SfRule {
  id: string;
  iri: string;
  title: string;
  description: string;
  credentialType: string;
  requiredClaim: string;
  legalBasis: string;
  isRequired: boolean;
  order: number;
  sameAsRule?: string;
}
interface SfRules {
  rules: SfRule[];
  source?: string;
  dataset?: string;
  lastUpdated?: string;
  version?: string;
  sparqlQuery?: string;
  endpoint?: string;
}

// ── Styling ────────────────────────────────────────────────────────────────────

const ACTOR_STYLE: Record<string, { text: string; border: string; bg: string; line: string }> = {
  student:         { text: 'text-sky-300',     border: 'border-sky-700/60',     bg: 'bg-sky-900/30',     line: 'bg-sky-700/30' },
  assistent:       { text: 'text-blue-300',    border: 'border-blue-700/60',    bg: 'bg-blue-900/30',    line: 'bg-blue-700/30' },
  mcp:             { text: 'text-indigo-300',  border: 'border-indigo-700/60',  bg: 'bg-indigo-900/30',  line: 'bg-indigo-700/30' },
  triply:          { text: 'text-teal-300',    border: 'border-teal-700/60',    bg: 'bg-teal-900/30',    line: 'bg-teal-700/30' },
  wallet:          { text: 'text-cyan-300',    border: 'border-cyan-700/60',    bg: 'bg-cyan-900/30',    line: 'bg-cyan-700/30' },
  duo:             { text: 'text-orange-300',  border: 'border-orange-700/60',  bg: 'bg-orange-900/30',  line: 'bg-orange-700/30' },
  belastingdienst: { text: 'text-yellow-300',  border: 'border-yellow-700/60',  bg: 'bg-yellow-900/30',  line: 'bg-yellow-700/30' },
};
const actorStyle = (id: string) => ACTOR_STYLE[id] ?? ACTOR_STYLE.mcp;

const OUTCOME_STYLE: Record<string, { arrow: string; head: string; text: string; badge: string; label: string }> = {
  ok:        { arrow: 'bg-emerald-500',  head: 'border-l-emerald-500', text: 'text-emerald-300', badge: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50', label: 'OK' },
  afgewezen: { arrow: 'bg-red-500',      head: 'border-l-red-500',     text: 'text-red-300',     badge: 'bg-red-900/40 text-red-300 border-red-700/50',             label: 'Niet voldaan' },
  info:      { arrow: 'bg-slate-400',    head: 'border-l-slate-400',   text: 'text-slate-200',   badge: 'bg-slate-800 text-slate-300 border-slate-600',             label: 'Bericht' },
};

const RULE_OUTCOME_STYLE: Record<string, string> = {
  'voldaan':             'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  'niet voldaan':        'bg-red-900/40 text-red-300 border-red-700/50',
  'niet van toepassing': 'bg-slate-800 text-slate-400 border-slate-600',
};

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

// ── Sequence diagram ───────────────────────────────────────────────────────────

function SequenceDiagram({
  actors, steps, selected, onSelect, highlightRule, activePhase,
}: {
  actors: Actor[];
  steps: Step[];
  selected: number | null;
  onSelect: (n: number) => void;
  highlightRule: string | null;
  activePhase: string | null;
}) {
  const col = (id: string) => Math.max(0, actors.findIndex(a => a.id === id));
  const center = (i: number) => ((i + 0.5) / actors.length) * 100;
  let lastPhase = '';

  return (
    <div className="relative">
      {/* Actor headers */}
      <div className="grid gap-1.5 pl-9 sticky top-0 z-10 bg-slate-900 pb-2" style={{ gridTemplateColumns: `repeat(${actors.length}, minmax(0, 1fr))` }}>
        {actors.map(a => {
          const st = actorStyle(a.id);
          return (
            <div key={a.id} className={`${st.bg} ${st.border} border rounded-lg px-1.5 py-1.5 text-center`}>
              <div className={`text-[11px] font-semibold ${st.text} truncate`}>{a.label}</div>
              <div className="text-[9px] text-slate-500 truncate">{a.sublabel}</div>
            </div>
          );
        })}
      </div>

      {/* Body with lifelines */}
      <div className="relative pl-9">
        <div className="absolute inset-0 left-9 pointer-events-none">
          {actors.map((a, i) => (
            <div key={a.id} className={`absolute top-0 bottom-0 w-px ${actorStyle(a.id).line}`} style={{ left: `${center(i)}%` }} />
          ))}
        </div>

        {steps.map((s, idx) => {
          const a = col(s.from);
          const b = col(s.to);
          const left = Math.min(center(a), center(b));
          const width = Math.abs(center(b) - center(a));
          const rightward = b >= a;
          const self = a === b;
          const oc = OUTCOME_STYLE[s.outcome ?? 'info'];
          const isSel = selected === s.n;
          const ruleHit = highlightRule ? s.ruleIds?.includes(highlightRule) : false;
          const dimmed = (activePhase && s.phase !== activePhase) || (highlightRule && !ruleHit);
          const showPhase = s.phase !== lastPhase;
          lastPhase = s.phase;

          return (
            <div key={s.n}>
              {showPhase && (
                <div className="relative -ml-9 flex items-center gap-2 pt-3 pb-1">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-900 pr-2 relative z-[1]">{s.phase}</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>
              )}
              <motion.button
                type="button"
                onClick={() => onSelect(s.n)}
                initial={{ opacity: 0 }}
                animate={{ opacity: dimmed ? 0.25 : 1 }}
                transition={{ delay: idx * 0.05, duration: 0.25 }}
                className={`relative block w-full h-12 rounded-lg text-left transition-colors ${isSel ? 'bg-slate-800/80 ring-1 ring-slate-600' : ruleHit ? 'bg-amber-900/10' : 'hover:bg-slate-800/40'}`}
              >
                {/* Step number */}
                <span className={`absolute -left-8 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border text-[10px] font-bold flex items-center justify-center tabular-nums ${isSel ? 'bg-slate-200 text-slate-900 border-slate-200' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>
                  {s.n}
                </span>

                {self ? (
                  <>
                    {/* Self-message loop */}
                    <div className={`absolute top-2 h-6 w-8 border-2 border-l-0 rounded-r-md ${s.outcome === 'ok' ? 'border-emerald-500' : s.outcome === 'afgewezen' ? 'border-red-500' : 'border-slate-400'}`}
                      style={{ left: `${center(a)}%` }} />
                    <div className={`absolute top-1.5 text-[10px] font-medium whitespace-nowrap ${oc.text}`} style={{ right: `${100 - center(a) + 1}%` }}>
                      {s.label}
                    </div>
                    <div className="absolute bottom-0.5 text-[9px] text-slate-500 whitespace-nowrap" style={{ right: `${100 - center(a) + 1}%` }}>
                      {s.protocol}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Label */}
                    <div className={`absolute top-1 text-[10px] font-medium truncate text-center ${oc.text}`} style={{ left: `${left}%`, width: `${Math.max(width, 14)}%` }}>
                      {s.label}
                    </div>
                    {/* Arrow */}
                    <motion.div
                      className="absolute top-[22px] h-[2px]"
                      style={{ left: `${left}%`, width: `${width}%`, transformOrigin: rightward ? 'left' : 'right' }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: idx * 0.05 + 0.1, duration: 0.3 }}
                    >
                      <div className={`h-full w-full ${oc.arrow} ${s.outcome === 'info' ? 'opacity-70' : ''}`} />
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 w-0 h-0 border-y-[5px] border-y-transparent ${rightward ? `right-0 border-l-[7px] ${oc.head}` : 'left-0 border-r-[7px]'}`}
                        style={!rightward ? { borderRightColor: s.outcome === 'ok' ? '#10b981' : s.outcome === 'afgewezen' ? '#ef4444' : '#94a3b8' } : undefined}
                      />
                    </motion.div>
                    {/* Endpoints */}
                    <div className={`absolute top-[19px] w-2 h-2 rounded-full ${oc.arrow}`} style={{ left: `calc(${center(a)}% - 4px)` }} />
                    {/* Protocol */}
                    <div className="absolute top-[27px] text-[9px] text-slate-500 truncate text-center" style={{ left: `${left}%`, width: `${Math.max(width, 14)}%` }}>
                      {s.protocol}
                    </div>
                  </>
                )}
              </motion.button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Step detail ────────────────────────────────────────────────────────────────

function StepDetail({ step, actors, onRuleHover }: { step: Step; actors: Actor[]; onRuleHover: (id: string | null) => void }) {
  const fromA = actors.find(a => a.id === step.from);
  const toA = actors.find(a => a.id === step.to);
  const oc = OUTCOME_STYLE[step.outcome ?? 'info'];
  return (
    <motion.div
      key={step.n}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800/50 border border-slate-700 rounded-xl p-4"
    >
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-[10px] font-bold text-slate-400 tabular-nums">Stap {step.n}</span>
        <span className={`text-[11px] font-semibold ${actorStyle(step.from).text}`}>{fromA?.label}</span>
        <span className="text-slate-600 text-[10px]">→</span>
        <span className={`text-[11px] font-semibold ${actorStyle(step.to).text}`}>{toA?.label}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${oc.badge}`}>{oc.label}</span>
        <span className="ml-auto text-[10px] text-slate-500 tabular-nums">{fmtDate(step.timestamp)} · {fmtTime(step.timestamp)}</span>
      </div>
      <div className="text-[12px] text-slate-200 font-medium">{step.label}</div>
      <div className="text-[10px] text-slate-500 mb-3">Protocol: {step.protocol} · Fase: {step.phase}</div>

      {step.note && (
        <p className="text-[11px] text-cyan-200/90 bg-cyan-900/15 border border-cyan-800/40 rounded-lg px-3 py-2 mb-3">{step.note}</p>
      )}

      {(step.guardrails?.length || step.ruleIds?.length) ? (
        <div className="flex flex-wrap gap-3 mb-3">
          {step.guardrails?.length ? (
            <div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Guardrails doorlopen</div>
              <div className="flex flex-wrap gap-1">
                {step.guardrails.map(g => (
                  <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-300 border border-emerald-700/40">✓ {g}</span>
                ))}
              </div>
            </div>
          ) : null}
          {step.ruleIds?.length ? (
            <div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Toegepaste regels</div>
              <div className="flex flex-wrap gap-1">
                {step.ruleIds.map(r => (
                  <a
                    key={r}
                    href={`#rule-${r}`}
                    onMouseEnter={() => onRuleHover(r)}
                    onMouseLeave={() => onRuleHover(null)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-900/30 text-teal-300 border border-teal-700/40 hover:brightness-125"
                  >
                    {r}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Bericht</div>
      <pre className="text-[10px] font-mono text-slate-300 bg-slate-900/80 border border-slate-700/50 rounded-lg p-3 whitespace-pre-wrap break-words max-h-48 overflow-auto">
        {JSON.stringify(step.payload, null, 2)}
      </pre>
    </motion.div>
  );
}

// ── Main overlay ───────────────────────────────────────────────────────────────

export default function TransparencyOverlay({
  request, onClose,
}: {
  request: TransparencyRequest;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(1);
  const [highlightRule, setHighlightRule] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rules, setRules] = useState<SfRules | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    apiFetch(`/api/triply/studiefinanciering/rules`)
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setRules(await r.json() as SfRules);
      })
      .catch(e => setRulesError(String(e)));
  }, []);

  useEffect(() => () => { if (playRef.current) clearInterval(playRef.current); }, []);

  const phases = useMemo(() => {
    const seen: Array<{ name: string; count: number; first: number }> = [];
    for (const s of request.steps) {
      const p = seen.find(x => x.name === s.phase);
      if (p) p.count++; else seen.push({ name: s.phase, count: 1, first: s.n });
    }
    return seen;
  }, [request.steps]);

  const stepsByRule = useMemo(() => {
    const m: Record<string, number[]> = {};
    for (const s of request.steps) for (const r of s.ruleIds ?? []) (m[r] ??= []).push(s.n);
    return m;
  }, [request.steps]);

  const play = () => {
    if (playRef.current) clearInterval(playRef.current);
    setActivePhase(null);
    setHighlightRule(null);
    setPlaying(true);
    let i = 0;
    setSelected(request.steps[0].n);
    playRef.current = setInterval(() => {
      i++;
      if (i >= request.steps.length) {
        if (playRef.current) clearInterval(playRef.current);
        setPlaying(false);
        return;
      }
      setSelected(request.steps[i].n);
    }, 900);
  };

  const selectedStep = request.steps.find(s => s.n === selected) ?? null;
  const currentPhase = selectedStep?.phase;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Transparantieverzoek</div>
            <h3 className="text-sm font-bold text-slate-100">{request.title}</h3>
            <p className="text-[10px] text-slate-500">{request.issuer} · aangevraagd op {fmtDate(request.requestedAt)}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Besluit */}
          <section className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Besluit</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-700/50 uppercase">{request.decision.result}</span>
              <span className="ml-auto text-[10px] text-slate-500 font-mono">{request.decision.reference}</span>
            </div>
            <p className="text-[12px] text-slate-200 leading-relaxed mb-3">{request.decision.summary}</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {request.decision.components.map(c => (
                <div key={c.label} className={`border rounded-lg px-3 py-2 ${c.granted ? 'bg-emerald-900/15 border-emerald-700/40' : 'bg-red-900/15 border-red-700/40'}`}>
                  <div className={`text-[11px] font-semibold ${c.granted ? 'text-emerald-300' : 'text-red-300'}`}>{c.granted ? '✓' : '✕'} {c.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{c.reason}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="text-slate-400"><span className="text-slate-500">Menselijke beoordeling: </span>{request.decision.humanReview}</div>
              <div className="text-slate-400"><span className="text-slate-500">Bezwaar: </span>{request.decision.objection}</div>
            </div>
          </section>

          {/* Fases */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Verloop van de aanvraag — {request.steps.length} berichten</div>
              <div className="flex items-center gap-2">
                {(activePhase || highlightRule) && (
                  <button onClick={() => { setActivePhase(null); setHighlightRule(null); }} className="text-[10px] text-slate-400 hover:text-slate-200">Filter wissen</button>
                )}
                <button
                  onClick={play}
                  disabled={playing}
                  className="text-[11px] font-medium px-3 py-1 rounded-lg border bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  {playing ? 'Bezig met afspelen…' : '▶ Afspelen'}
                </button>
              </div>
            </div>
            <div className="flex items-stretch gap-1 mb-4">
              {phases.map((p, i) => {
                const isActive = activePhase === p.name;
                const isCurrent = !activePhase && currentPhase === p.name;
                return (
                  <button
                    key={p.name}
                    onClick={() => { setActivePhase(isActive ? null : p.name); setSelected(p.first); }}
                    className={`flex-1 relative px-2 py-1.5 text-left border transition-colors ${i === 0 ? 'rounded-l-lg' : ''} ${i === phases.length - 1 ? 'rounded-r-lg' : ''} ${
                      isActive ? 'bg-violet-900/40 border-violet-600/60' : isCurrent ? 'bg-slate-700/60 border-slate-500' : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-[9px] text-slate-500 tabular-nums">{i + 1}</div>
                    <div className={`text-[11px] font-medium ${isActive ? 'text-violet-200' : 'text-slate-300'}`}>{p.name}</div>
                    <div className="text-[9px] text-slate-500">{p.count} {p.count === 1 ? 'bericht' : 'berichten'}</div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 overflow-x-auto">
                <div className="min-w-[640px]">
                  <SequenceDiagram
                    actors={request.actors}
                    steps={request.steps}
                    selected={selected}
                    onSelect={n => { setSelected(n); setPlaying(false); if (playRef.current) clearInterval(playRef.current); }}
                    highlightRule={highlightRule}
                    activePhase={activePhase}
                  />
                </div>
                <div className="flex items-center gap-4 mt-3 pt-2 border-t border-slate-800 text-[9px] text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-slate-400 inline-block" /> Bericht</span>
                  <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-emerald-500 inline-block" /> Voldaan / gelukt</span>
                  <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-red-500 inline-block" /> Niet voldaan</span>
                  <span className="ml-auto">Klik op een stap voor het volledige bericht</span>
                </div>
              </div>
              <div className="lg:sticky lg:top-0">
                <AnimatePresence mode="wait">
                  {selectedStep && <StepDetail step={selectedStep} actors={request.actors} onRuleHover={setHighlightRule} />}
                </AnimatePresence>
              </div>
            </div>
          </section>

          {/* Regels */}
          <section>
            <div className="flex items-end justify-between mb-2">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Regels die golden voor dit besluit</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Live opgehaald uit Triply DB (SPARQL) · beweeg over een regel om de stappen te zien waarin deze is toegepast</div>
              </div>
              {rules && (
                <div className="text-right text-[10px] text-slate-500">
                  <div><span className="text-slate-400">{rules.dataset}</span> v{rules.version}</div>
                  <div>{rules.source} · bijgewerkt {rules.lastUpdated ? fmtDate(rules.lastUpdated) : '—'}</div>
                </div>
              )}
            </div>

            {rulesError && <p className="text-[11px] text-red-400">Regels konden niet worden opgehaald uit Triply: {rulesError}</p>}
            {!rules && !rulesError && <p className="text-[11px] text-slate-500">Regels ophalen…</p>}

            {rules && (
              <div className="space-y-2">
                {rules.rules.map(r => {
                  const outcome = request.ruleOutcomes[r.id] ?? 'niet van toepassing';
                  const usedIn = stepsByRule[r.id] ?? [];
                  const isHl = highlightRule === r.id;
                  return (
                    <div
                      key={r.id}
                      id={`rule-${r.id}`}
                      onMouseEnter={() => setHighlightRule(r.id)}
                      onMouseLeave={() => setHighlightRule(null)}
                      className={`border rounded-xl px-4 py-3 transition-colors ${isHl ? 'bg-amber-900/15 border-amber-600/50' : 'bg-slate-800/40 border-slate-700/60'}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-slate-500 tabular-nums">{r.order}.</span>
                        <span className="text-[12px] font-semibold text-slate-100">{r.title}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${r.isRequired ? 'bg-slate-800 text-slate-300 border-slate-600' : 'bg-slate-900 text-slate-500 border-slate-700'}`}>
                          {r.isRequired ? 'Verplicht' : 'Optioneel'}
                        </span>
                        <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border ${RULE_OUTCOME_STYLE[outcome] ?? RULE_OUTCOME_STYLE['niet van toepassing']}`}>
                          {outcome}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-snug">{r.description}</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[10px]">
                        <div><span className="text-slate-500">Bewijs: </span><span className="text-slate-300 font-mono">{r.credentialType}</span></div>
                        <div><span className="text-slate-500">Voorwaarde: </span><span className="text-slate-300 font-mono">{r.requiredClaim}</span></div>
                        <div><span className="text-slate-500">Wettelijke grondslag: </span><span className="text-slate-300">{r.legalBasis}</span></div>
                        <div>
                          <span className="text-slate-500">Toegepast in stap: </span>
                          <span className="text-slate-300 tabular-nums">{usedIn.length ? usedIn.join(', ') : '—'}</span>
                        </div>
                        {r.sameAsRule && (
                          <div className="col-span-2 text-slate-500">Zelfde regel als OV-regel <span className="font-mono text-teal-300">{r.sameAsRule}</span> in Triply</div>
                        )}
                        <div className="col-span-2 text-slate-600 font-mono truncate">{r.iri}</div>
                      </div>
                    </div>
                  );
                })}

                {rules.sparqlQuery && (
                  <details className="group mt-2">
                    <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300 select-none list-none flex items-center gap-1.5">
                      <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                      Bekijk SPARQL-query ({rules.endpoint})
                    </summary>
                    <pre className="mt-2 text-[10px] font-mono text-slate-300 bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">{rules.sparqlQuery}</pre>
                  </details>
                )}
              </div>
            )}
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
}
