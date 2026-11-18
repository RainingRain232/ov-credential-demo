'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToolCallItem } from '@/lib/types';

// Maps tool name → which downstream service MCP calls
const TOOL_META: Record<string, { label: string; target: string; targetColor: string; icon: string }> = {
  get_eligibility_rules:         { label: 'Geschiktheidsregels ophalen',    target: 'Triply DB',      targetColor: 'text-teal-400 border-teal-700/50 bg-teal-900/20',   icon: '🗄️' },
  get_rules:                     { label: 'Regels ophalen',                target: 'Triply DB',      targetColor: 'text-teal-400 border-teal-700/50 bg-teal-900/20',   icon: '🗄️' },
  check_user_eligibility:        { label: 'Geschiktheid controleren',      target: 'Wallet',         targetColor: 'text-cyan-400 border-cyan-700/50 bg-cyan-900/20',   icon: '👜' },
  check_eligibility:             { label: 'Geschiktheid controleren',      target: 'Wallet',         targetColor: 'text-cyan-400 border-cyan-700/50 bg-cyan-900/20',   icon: '👜' },
  apply_for_transport_credential:{ label: 'Credential aanvragen',          target: 'Vervoerder',     targetColor: 'text-orange-400 border-orange-700/50 bg-orange-900/20', icon: '🚌' },
  apply_credential:              { label: 'Credential aanvragen',          target: 'Vervoerder',     targetColor: 'text-orange-400 border-orange-700/50 bg-orange-900/20', icon: '🚌' },
  verify_rules_current:          { label: 'Regels controleren op actualiteit', target: 'Triply + Vervoerder', targetColor: 'text-yellow-400 border-yellow-700/50 bg-yellow-900/20', icon: '✅' },
  verify_rules:                  { label: 'Regels verifi\u00EBren',        target: 'Triply + Vervoerder', targetColor: 'text-yellow-400 border-yellow-700/50 bg-yellow-900/20', icon: '✅' },
};

interface RouteStep {
  ruleId: string;
  title: string;
  credentialType: string;
  claimName: string;
  passed: boolean;
}

interface EligibilityResult {
  eligible?: boolean;
  route?: string;
  routeLabel?: string;
  credentialType?: string;
  routeSteps?: RouteStep[];
  checkedAt?: string;
}

function formatValue(val: unknown, maxLen = 5000): string {
  if (val === null || val === undefined) return '—';
  const s = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

function filterArgs(args?: Record<string, unknown>): Record<string, unknown> {
  if (!args) return {};
  const { sessionId: _, ...rest } = args;
  return rest;
}

function ServiceBadge({ label, color, icon }: { label: string; color: string; icon: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${color}`}>
      <span>{icon}</span>{label}
    </span>
  );
}

function Arrow({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-1 pl-3 py-0.5">
      <motion.div
        className={`h-px flex-1 max-w-[32px] ${active ? 'bg-indigo-500' : 'bg-slate-700'}`}
        animate={{ scaleX: active ? [0, 1] : 1 }}
        transition={{ duration: 0.3 }}
      />
      <span className={`text-[9px] ${active ? 'text-indigo-400' : 'text-slate-600'}`}>▼</span>
    </div>
  );
}

function MessageRow({
  from, fromColor, fromIcon,
  to,   toColor,   toIcon,
  payload, payloadLabel,
  status,
  defaultOpen = false,
}: {
  from: string; fromColor: string; fromIcon: string;
  to:   string; toColor:   string; toIcon:   string;
  payload: string; payloadLabel: string;
  status: 'sending' | 'done' | 'idle';
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [expanded, setExpanded] = useState(false);
  const previewLen = 200;
  const isLong = payload.length > previewLen;
  const preview = isLong ? payload.slice(0, previewLen) + '…' : payload;

  return (
    <div className="pl-3 border-l-2 border-slate-700/60 py-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left"
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <ServiceBadge label={from} color={fromColor} icon={fromIcon} />
          <span className="text-slate-600 text-[10px]">→</span>
          <ServiceBadge label={to} color={toColor} icon={toIcon} />
          {status === 'sending' && (
            <div className="w-2.5 h-2.5 rounded-full border border-indigo-400 border-t-transparent animate-spin ml-auto" />
          )}
          {status === 'done' && (
            <span className="text-[10px] text-slate-500 ml-auto">{open ? '▲' : '▼'}</span>
          )}
        </div>
        <div className="mt-0.5 text-[10px] text-slate-500 pl-0.5">{payloadLabel}</div>
      </button>

      <AnimatePresence>
        {open && status === 'done' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <pre
              className={`mt-1.5 text-[10px] font-mono text-slate-300 bg-slate-800/60 rounded-lg px-2.5 py-2 whitespace-pre-wrap break-words ${
                expanded ? 'overflow-auto max-h-[400px]' : ''
              }`}
            >
              {expanded ? payload : preview}
            </pre>
            {isLong && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(ex => !ex); }}
                className="mt-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-medium pl-1"
              >
                {expanded ? '▲ Inklappen' : '▼ Alles tonen'}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Visual Triply route decision tree for check_user_eligibility results
function TriplyRoutePath({ result }: { result: EligibilityResult }) {
  if (!result.route || !result.routeSteps) return null;

  const isUnder18Route = result.route === 'under18';
  const isOver18Route  = result.route === 'over18';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 rounded-lg border border-teal-700/40 bg-teal-900/10 p-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">🗺️</span>
        <span className="text-[11px] font-bold text-teal-300 uppercase tracking-widest">Triply Regelpad</span>
        <span className="ml-auto text-[10px] text-teal-500 font-mono">age-routes query</span>
      </div>

      {/* Age decision node */}
      <div className="flex flex-col items-center mb-2">
        <div className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-800/60 text-[10px] text-slate-200 font-semibold">
          🔍 Leeftijdscontrole
        </div>
        <div className="flex items-start gap-6 mt-1.5 w-full justify-center">
          {/* Under-18 branch */}
          <div className="flex flex-col items-center gap-1 min-w-[80px]">
            <div className="h-4 w-px bg-slate-600" />
            <div className={`px-2 py-1 rounded border text-[9px] font-semibold ${
              isUnder18Route
                ? 'border-green-500/60 bg-green-900/30 text-green-300'
                : 'border-slate-700/50 bg-slate-800/30 text-slate-500'
            }`}>
              Onder 18
            </div>
            {isUnder18Route && <span className="text-[9px] text-green-400">← gekozen</span>}
            {!isUnder18Route && <span className="text-[9px] text-slate-600">✗ overgeslagen</span>}
          </div>

          {/* Over-18 branch */}
          <div className="flex flex-col items-center gap-1 min-w-[80px]">
            <div className="h-4 w-px bg-slate-600" />
            <div className={`px-2 py-1 rounded border text-[9px] font-semibold ${
              isOver18Route
                ? 'border-green-500/60 bg-green-900/30 text-green-300'
                : 'border-slate-700/50 bg-slate-800/30 text-slate-500'
            }`}>
              18 of ouder
            </div>
            {isOver18Route && <span className="text-[9px] text-green-400">← gekozen</span>}
            {!isOver18Route && <span className="text-[9px] text-slate-600">✗ overgeslagen</span>}
          </div>
        </div>
      </div>

      {/* Route label */}
      <div className="text-center mb-2">
        <span className="text-[10px] text-teal-400 font-semibold">{result.routeLabel}</span>
      </div>

      {/* Rule steps for the chosen route */}
      <div className="space-y-1.5">
        {result.routeSteps.map((step, i) => (
          <motion.div
            key={step.ruleId}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-[10px] ${
              step.passed
                ? 'border-green-700/40 bg-green-900/15 text-green-300'
                : 'border-red-700/40 bg-red-900/15 text-red-300'
            }`}
          >
            <span className="text-[11px]">{step.passed ? '✓' : '✗'}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{step.title}</div>
              <div className="text-[9px] opacity-60 font-mono truncate">{step.credentialType}.{step.claimName}</div>
            </div>
            <span className={`text-[9px] font-bold shrink-0 ${step.passed ? 'text-green-400' : 'text-red-400'}`}>
              {step.passed ? 'PASS' : 'FAIL'}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Final credential outcome */}
      <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] font-bold ${
        result.eligible
          ? 'border-green-600/50 bg-green-900/20 text-green-300'
          : 'border-red-600/50 bg-red-900/20 text-red-300'
      }`}>
        <span className="text-base">{result.eligible ? '🎫' : '🚫'}</span>
        <div>
          <div>{result.eligible ? 'In aanmerking voor' : 'Niet in aanmerking —'} {result.credentialType}</div>
          <div className="text-[9px] opacity-60 font-normal font-mono">{result.route} route · wallet check</div>
        </div>
      </div>
    </motion.div>
  );
}

export default function ServiceMessageFlow({ toolCalls }: { toolCalls: ToolCallItem[] }) {
  if (toolCalls.length === 0) return (
    <div className="flex items-center justify-center h-24 text-[11px] text-slate-600 italic">
      Nog geen serviceberichten
    </div>
  );

  return (
    <div className="space-y-3 pb-2">
        <AnimatePresence mode="popLayout">
          {toolCalls.map((tc) => {
            if (tc.toolName === 'standaard_antwoord') {
              return (
                <motion.div
                  key={tc.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-slate-600/50 bg-slate-800/40 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📋</span>
                    <span className="text-[11px] font-semibold text-slate-300">Standaardantwoord gegeven</span>
                    <span className="ml-auto text-[10px] text-emerald-400">✓ direct</span>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-500 pl-6">
                    Gecached antwoord — geen LLM of judge gebruikt
                  </p>
                </motion.div>
              );
            }

            const meta = TOOL_META[tc.toolName] ?? {
              label: tc.toolName,
              target: 'Extern',
              targetColor: 'text-slate-400 border-slate-600 bg-slate-800/30',
              icon: '🔧',
            };
            const argStr = formatValue(filterArgs(tc.args));
            const hasArgs = argStr !== '{}' && argStr !== '—';
            const resultStr = formatValue(tc.result);

            // Detect eligibility results with route info
            const eligibilityResult = (
              (tc.toolName === 'check_user_eligibility' || tc.toolName === 'check_eligibility') &&
              tc.status === 'complete' &&
              tc.result &&
              typeof tc.result === 'object' &&
              'route' in (tc.result as object)
            ) ? tc.result as EligibilityResult : null;

            return (
              <motion.div
                key={tc.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-2.5"
              >
                {/* Tool header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{meta.icon}</span>
                  <span className="text-[11px] font-semibold text-slate-200">{meta.label}</span>
                  {tc.status === 'calling' && (
                    <span className="ml-auto text-[10px] text-indigo-400 animate-pulse">bezig...</span>
                  )}
                  {tc.status === 'complete' && (
                    <span className="ml-auto text-[10px] text-green-400">✓ klaar</span>
                  )}
                </div>

                {/* Message 1: LLM → MCP */}
                <MessageRow
                  from="LLM" fromColor="text-blue-400 border-blue-700/50 bg-blue-900/20" fromIcon="🧠"
                  to="MCP"   toColor="text-indigo-400 border-indigo-700/50 bg-indigo-900/20" toIcon="⚙️"
                  payload={hasArgs ? argStr : '(no extra args)'}
                  payloadLabel={`call: ${tc.toolName}(${hasArgs ? '…' : ''})`}
                  status="done"
                />

                <Arrow active={tc.status === 'calling'} />

                {/* Message 2: MCP → target service */}
                <MessageRow
                  from="MCP"         fromColor="text-indigo-400 border-indigo-700/50 bg-indigo-900/20" fromIcon="⚙️"
                  to={meta.target}   toColor={meta.targetColor} toIcon={meta.icon}
                  payload={hasArgs ? argStr : '(forwarded request)'}
                  payloadLabel={`verzoek aan ${meta.target}`}
                  status={tc.status === 'calling' ? 'sending' : 'done'}
                />

                <Arrow active={tc.status === 'complete'} />

                {/* Message 3: target service → MCP → LLM (result) */}
                {tc.status === 'complete' && (
                  <MessageRow
                    from={meta.target} fromColor={meta.targetColor} fromIcon={meta.icon}
                    to="LLM"           toColor="text-blue-400 border-blue-700/50 bg-blue-900/20" toIcon="🧠"
                    payload={resultStr}
                    payloadLabel="antwoord"
                    status="done"
                    defaultOpen={!eligibilityResult}
                  />
                )}

                {/* Triply route decision tree — only for eligibility checks with route data */}
                {eligibilityResult && <TriplyRoutePath result={eligibilityResult} />}
              </motion.div>
            );
          })}
        </AnimatePresence>
    </div>
  );
}
