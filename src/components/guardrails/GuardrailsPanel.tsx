'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckItem as CheckItemType, GuardrailEvent, JudgeResult, ToolCallItem } from '@/lib/types';
import CheckItemComponent from './CheckItem';
import JudgeScorecard from './JudgeScorecard';
import DataFlowViz from './DataFlowViz';

interface GuardrailsPanelProps {
  events: GuardrailEvent[];
  checks: CheckItemType[];
  judgeResult: JudgeResult | null;
  isThinking: boolean;
  activeZone: 'INPUT' | 'LLM' | 'OUTPUT' | 'JUDGE' | null;
  toolCalls: ToolCallItem[];
  lastBlockedZone: string | null;
  modelLabel: string;
  judgeModelLabel: string;
  activeToolName?: string;
}

const EVENT_ICONS: Record<string, string> = {
  CHECK_PASSED: '✓',
  CHECK_FAILED: '✕',
  TOOL_CALL: '→',
  TOOL_RESULT: '←',
  LLM_THINKING: '·',
  OUTPUT_BLOCKED: '!',
  JUDGE_SCORE: '⚖',
};

const EVENT_COLORS: Record<string, string> = {
  CHECK_PASSED: 'text-emerald-500',
  CHECK_FAILED: 'text-red-400',
  TOOL_CALL: 'text-indigo-400',
  TOOL_RESULT: 'text-indigo-400',
  LLM_THINKING: 'text-blue-400',
  OUTPUT_BLOCKED: 'text-red-400',
  JUDGE_SCORE: 'text-cyan-400',
};

export default function GuardrailsPanel({
  events,
  checks,
  judgeResult,
  isThinking,
  activeZone,
  toolCalls,
  lastBlockedZone,
  modelLabel,
  judgeModelLabel,
  activeToolName
}: GuardrailsPanelProps) {
  const inputChecks  = checks.filter(c => c.zone === 'INPUT');
  const outputChecks = checks.filter(c => c.zone === 'OUTPUT' && c.category !== 'ETHICS');
  const ethicsChecks = checks.filter(c => c.category === 'ETHICS');
  const judgeChecks  = checks.filter(c => c.zone === 'JUDGE');

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-y-auto scrollbar-thin">

      {/* Model badges */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 px-2.5 py-2 bg-slate-900/60 border border-slate-800 rounded-xl">
          <span className="text-sm">🧠</span>
          <div className="flex-1 min-w-0">
            <div className="text-[8px] text-slate-600 uppercase tracking-wider font-semibold">Hoofd</div>
            <div className="text-[10px] text-blue-300 font-mono font-medium truncate">{modelLabel}</div>
          </div>
          {isThinking && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />}
        </div>
        <div className="flex-1 flex items-center gap-2 px-2.5 py-2 bg-slate-900/60 border border-slate-800 rounded-xl">
          <span className="text-sm">⚖️</span>
          <div className="flex-1 min-w-0">
            <div className="text-[8px] text-slate-600 uppercase tracking-wider font-semibold">Beoordelaar</div>
            <div className="text-[10px] text-purple-300 font-mono font-medium truncate">{judgeModelLabel}</div>
          </div>
          {activeZone === 'JUDGE' && <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse flex-shrink-0" />}
        </div>
      </div>

      {/* Data flow visualization */}
      <DataFlowViz
        isThinking={isThinking}
        activeZone={activeZone}
        toolCallActive={toolCalls.some(t => t.status === 'calling')}
        lastBlockedZone={lastBlockedZone}
        modelLabel={modelLabel}
        activeToolName={activeToolName}
      />

      {/* Input Shield */}
      {inputChecks.length > 0 && (
        <div className="bg-slate-900/60 border border-violet-500/15 rounded-xl p-2.5">
          <h4 className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Invoerschild
          </h4>
          <AnimatePresence mode="popLayout">
            {inputChecks.map(c => <CheckItemComponent key={c.id} item={c} />)}
          </AnimatePresence>
        </div>
      )}

      {/* Output Filter */}
      {outputChecks.length > 0 && (
        <div className="bg-slate-900/60 border border-amber-500/15 rounded-xl p-2.5">
          <h4 className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Uitvoerfilter
          </h4>
          <AnimatePresence mode="popLayout">
            {outputChecks.map(c => <CheckItemComponent key={c.id} item={c} />)}
          </AnimatePresence>
        </div>
      )}

      {/* Ethical Guardrails */}
      {ethicsChecks.length > 0 && (
        <div className="bg-slate-900/60 border border-rose-500/15 rounded-xl p-2.5">
          <h4 className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Ethische guardrails
          </h4>
          <AnimatePresence mode="popLayout">
            {ethicsChecks.map(c => <CheckItemComponent key={c.id} item={c} />)}
          </AnimatePresence>
        </div>
      )}

      {/* LLM Judge */}
      {(judgeChecks.length > 0 || judgeResult) && (
        <JudgeScorecard result={judgeResult} />
      )}

      {/* Event log */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-2.5">
        <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Gebeurtenislog
        </h4>
        <div className="space-y-px max-h-28 overflow-y-auto scrollbar-thin">
          <AnimatePresence mode="popLayout">
            {[...events].reverse().slice(0, 20).map((ev, i) => (
              <motion.div
                key={`${ev.type}-${i}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-1.5 text-[9px] py-0.5"
              >
                <span className={`flex-shrink-0 font-mono ${EVENT_COLORS[ev.type] || 'text-slate-600'}`}>
                  {EVENT_ICONS[ev.type] || '·'}
                </span>
                <span className={`truncate ${
                  ev.type === 'CHECK_FAILED' || ev.type === 'OUTPUT_BLOCKED' ? 'text-red-400/70' :
                  ev.type === 'CHECK_PASSED' ? 'text-emerald-400/60' :
                  'text-slate-600'
                }`}>
                  {ev.type}{ev.checkName ? ` ${ev.checkName}` : ''}{ev.toolName ? ` ${ev.toolName}` : ''}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
