'use client';
import { useState, useEffect } from 'react';
import { ChatMessage, FlowStep, ToolCallItem } from '@/lib/types';

interface MedewerkerPanelProps {
  sessionId: string;
  messages: ChatMessage[];
  toolCallLog: ToolCallItem[];
  flowStep: FlowStep;
  isPending: boolean;
  onDecision: (decision: 'approved' | 'rejected') => void;
  maximized: boolean;
  onToggleMaximize: () => void;
}

const REVIEW_CHECKS = [
  { id: 'gelezen',       label: 'Gesprek gelezen',              desc: 'Het volledige gesprek is doorgenomen' },
  { id: 'stappen',       label: 'Processtappen gecontroleerd',  desc: 'Alle credential-stappen zijn correct doorlopen' },
  { id: 'geschiktheid',  label: 'Geschiktheid bevestigd',       desc: 'Eligibility-resultaat is geverifieerd en klopt' },
  { id: 'toestemming',   label: 'Toestemming aanwezig',         desc: 'Gebruiker heeft expliciet toestemming gegeven' },
  { id: 'identiteit',    label: 'Identiteit geverifieerd',      desc: 'Wallet-credentials zijn gecontroleerd via MCP' },
];

export default function MedewerkerPanel({
  sessionId,
  messages,
  toolCallLog,
  flowStep,
  isPending,
  onDecision,
  maximized,
  onToggleMaximize,
}: MedewerkerPanelProps) {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // Reset checkboxes whenever a new review request arrives
  useEffect(() => {
    if (isPending) setCheckedItems(new Set());
  }, [isPending]);

  const allChecked = checkedItems.size === REVIEW_CHECKS.length;

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleTool = (id: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Extract eligibility info from tool call log
  const eligibilityCall = toolCallLog.find(tc => tc.toolName === 'check_user_eligibility' && tc.status === 'complete');
  const eligibilityResult = eligibilityCall?.result as Record<string, unknown> | undefined;

  // Dutch display names for tool calls
  // Dutch display names for tool calls
  const toolDisplayNames: Record<string, string> = {
    'get_eligibility_rules': 'Geschiktheidsregels ophalen',
    'check_user_eligibility': 'Geschiktheid controleren',
    'apply_for_transport_credential': 'Credential aanvragen',
    'verify_rules_current': 'Regels verifiëren',
  };

  // Dutch display names for flow steps
  const flowStepLabels: Record<string, string> = {
    'GREETING': 'Welkom',
    'RULES_FETCHED': 'Regels opgehaald',
    'RULES_PRESENTED': 'Regels uitgelegd',
    'CONSENT_CHECK_REQUESTED': 'Toestemming controle gevraagd',
    'CONSENT_CHECK_GIVEN': 'Toestemming controle gegeven',
    'ELIGIBILITY_CHECKING': 'Geschiktheid controleren',
    'ELIGIBILITY_RESULT': 'Geschiktheid resultaat',
    'CONSENT_APPLY_REQUESTED': 'Toestemming aanvraag gevraagd',
    'CONSENT_APPLY_GIVEN': 'Toestemming aanvraag gegeven',
    'APPLYING': 'Aanvragen',
    'MEDEWERKER_PENDING': 'Wacht op medewerker',
    'MEDEWERKER_APPROVED': 'Goedgekeurd door medewerker',
    'MEDEWERKER_REJECTED': 'Afgewezen door medewerker',
    'CREDENTIAL_ISSUED': 'Credential uitgegeven',
  };

  const statusBanner = () => {
    if (isPending) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-600/30">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[11px] font-medium text-amber-300">Wacht op beoordeling...</span>
        </div>
      );
    }
    if (flowStep === 'MEDEWERKER_APPROVED') {
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-600/30">
          <span className="text-[11px] font-medium text-emerald-300">Goedgekeurd</span>
        </div>
      );
    }
    if (flowStep === 'MEDEWERKER_REJECTED') {
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/15 border border-red-600/30">
          <span className="text-[11px] font-medium text-red-300">Afgewezen</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/30">
        <span className="text-[11px] font-medium text-slate-500">Geen review actief</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <span className="text-amber-400">&#9679;</span> Medewerker in de loop
        </h2>
        <button
          onClick={onToggleMaximize}
          title={maximized ? 'Verkleinen' : 'Maximaliseren'}
          className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded"
        >
          {maximized ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M9 15H4.5M9 15v4.5M9 15l-5.25 5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          )}
        </button>
      </div>

      {/* Status banner */}
      <div className="flex-shrink-0">
        {statusBanner()}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-4">

        {/* Summary */}
        <div>
          <h3 className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider mb-2">Samenvatting</h3>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between text-slate-400">
              <span>Sessie</span>
              <span className="font-mono text-slate-500">{sessionId.slice(0, 12)}...</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Berichten</span>
              <span className="text-slate-300">{messages.length}</span>
            </div>
            {eligibilityResult && (
              <>
                <div className="flex justify-between text-slate-400">
                  <span>Credential type</span>
                  <span className="text-slate-300">{String(eligibilityResult.credentialType || eligibilityResult.credential_type || '-')}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Geschikt</span>
                  <span className={eligibilityResult.eligible ? 'text-emerald-400' : 'text-red-400'}>
                    {eligibilityResult.eligible ? 'Ja' : 'Nee'}
                  </span>
                </div>
              </>
            )}
            {eligibilityCall?.args?.route != null && (
              <div className="flex justify-between text-slate-400">
                <span>Route</span>
                <span className="text-slate-300">{String(eligibilityCall.args.route)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-400">
              <span>Flow stap</span>
              <span className="text-amber-300/70">{flowStepLabels[flowStep] || flowStep}</span>
            </div>
          </div>
        </div>

        {/* Conversation log */}
        <div>
          <h3 className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider mb-2">Gesprekslog</h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`px-2 py-1.5 rounded-md text-[10px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-900/20 border border-blue-800/20 text-blue-200'
                    : 'bg-slate-800/40 border border-slate-700/20 text-slate-300'
                }`}
              >
                <span className="font-semibold text-[9px] uppercase tracking-wider opacity-60">
                  {msg.role === 'user' ? 'Gebruiker' : 'Assistent'}
                </span>
                <p className="mt-0.5 line-clamp-3">{msg.content}</p>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-[10px] text-slate-600 italic">Nog geen berichten</p>
            )}
          </div>
        </div>

        {/* Service message log */}
        <div>
          <h3 className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider mb-2">Serviceberichten log</h3>
          <div className="space-y-1">
            {toolCallLog.map((tc) => (
              <div key={tc.id} className="border border-slate-700/30 rounded-md overflow-hidden">
                <button
                  onClick={() => toggleTool(tc.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      tc.status === 'complete' ? 'bg-emerald-400' : tc.status === 'error' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'
                    }`} />
                    <span className="font-mono text-slate-300">{toolDisplayNames[tc.toolName] || tc.toolName}</span>
                  </div>
                  <span className="text-slate-600">{expandedTools.has(tc.id) ? '▲' : '▼'}</span>
                </button>
                {expandedTools.has(tc.id) && (
                  <div className="px-2 py-1.5 border-t border-slate-700/30 bg-slate-900/30 text-[9px] font-mono space-y-1">
                    {tc.args && (
                      <div>
                        <span className="text-slate-500">Invoer: </span>
                        <span className="text-slate-400">{JSON.stringify(tc.args, null, 0).slice(0, 200)}</span>
                      </div>
                    )}
                    {tc.result !== undefined && (
                      <div>
                        <span className="text-slate-500">Resultaat: </span>
                        <span className="text-slate-400">{JSON.stringify(tc.result, null, 0).slice(0, 200)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {toolCallLog.length === 0 && (
              <p className="text-[10px] text-slate-600 italic">Nog geen service calls</p>
            )}
          </div>
        </div>
      </div>

      {/* Review checklist + action buttons */}
      {isPending && (
        <div className="flex-shrink-0 space-y-3">
          <div className="rounded-lg border border-amber-700/30 bg-amber-900/10 p-2.5 space-y-2">
            <p className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider mb-1">
              Beoordelingslijst — {checkedItems.size}/{REVIEW_CHECKS.length}
            </p>
            {REVIEW_CHECKS.map(item => {
              const checked = checkedItems.has(item.id);
              return (
                <label
                  key={item.id}
                  className="flex items-start gap-2.5 cursor-pointer group"
                >
                  <div
                    onClick={() => toggleCheck(item.id)}
                    className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 border transition-all flex items-center justify-center ${
                      checked
                        ? 'bg-amber-500 border-amber-400'
                        : 'bg-slate-800 border-slate-600 group-hover:border-amber-600/60'
                    }`}
                  >
                    {checked && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div onClick={() => toggleCheck(item.id)} className="min-w-0">
                    <p className={`text-[10px] font-medium leading-tight ${checked ? 'text-slate-300' : 'text-slate-500'}`}>
                      {item.label}
                    </p>
                    <p className="text-[9px] text-slate-600 mt-0.5 leading-snug">{item.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => allChecked && onDecision('approved')}
              disabled={!allChecked}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-[11px] font-semibold transition-all border ${
                allChecked
                  ? 'bg-emerald-600/80 hover:bg-emerald-500/80 text-white border-emerald-500/30 cursor-pointer'
                  : 'bg-slate-800/40 text-slate-600 border-slate-700/30 cursor-not-allowed'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Goedkeuren
            </button>
            <button
              onClick={() => allChecked && onDecision('rejected')}
              disabled={!allChecked}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-[11px] font-semibold transition-all border ${
                allChecked
                  ? 'bg-red-600/80 hover:bg-red-500/80 text-white border-red-500/30 cursor-pointer'
                  : 'bg-slate-800/40 text-slate-600 border-slate-700/30 cursor-not-allowed'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Afwijzen
            </button>
          </div>

          {!allChecked && (
            <p className="text-[9px] text-slate-600 text-center">
              Vink alle {REVIEW_CHECKS.length} punten aan om een beslissing te nemen
            </p>
          )}
        </div>
      )}
    </div>
  );
}
