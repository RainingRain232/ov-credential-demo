'use client';
import { motion } from 'framer-motion';
import { JudgeCheck, JudgeResult } from '@/lib/types';
import { judgeLabel, splitJudgeChecks } from '@/lib/judgeLabels';

function CheckRow({ id, check }: { id: string; check: JudgeCheck }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`px-2 py-1.5 rounded-lg text-[10px] ${
        check.pass
          ? 'bg-emerald-500/8 text-emerald-300'
          : 'bg-red-500/10 text-red-300'
      }`}
    >
      <div className="flex items-center gap-1.5 font-medium">
        <span className="text-[9px]">{check.pass ? '✓' : '✕'}</span>
        <span>{judgeLabel(id)}</span>
      </div>
      {check.reason && (
        <p className="mt-0.5 ml-4 text-[9px] text-slate-500 leading-snug">{check.reason}</p>
      )}
    </motion.div>
  );
}


export default function JudgeScorecard({ result }: { result: JudgeResult | null }) {
  if (!result) return null;
  const { quality, ethics } = splitJudgeChecks(result);

  const scoreColor = result.overall_score >= 8
    ? 'text-emerald-400'
    : result.overall_score >= 5
    ? 'text-amber-400'
    : 'text-red-400';

  const barColor = result.overall_score >= 8
    ? 'bg-emerald-500'
    : result.overall_score >= 5
    ? 'bg-amber-500'
    : 'bg-red-500';

  const recColor = {
    PASS: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400',
    WARN: 'bg-amber-500/15 border-amber-500/25 text-amber-400',
    BLOCK: 'bg-red-500/15 border-red-500/25 text-red-400',
  }[result.recommendation];

  return (
    <motion.div
      key={result.overall_score + result.recommendation}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900/60 border border-cyan-500/15 rounded-xl p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> LLM Beoordelaar
        </h4>
        <div className="flex items-center gap-2">
          <span className={`text-base font-bold tabular-nums ${scoreColor}`}>
            {result.overall_score}<span className="text-[10px] text-slate-600">/10</span>
          </span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${recColor}`}>
            {result.recommendation}
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1 bg-slate-800 rounded-full mb-3 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${result.overall_score * 10}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>

      {/* Individual checks */}
      <div className="grid grid-cols-1 gap-1">
        {quality.map(([key, check]) => <CheckRow key={key} id={key} check={check} />)}
      </div>

      {/* Ethical guardrails */}
      {ethics.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-rose-500/15">
          <h5 className="text-[9px] font-semibold text-rose-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-rose-400" /> Ethische guardrails
          </h5>
          <div className="grid grid-cols-1 gap-1">
            {ethics.map(([key, check]) => <CheckRow key={key} id={key} check={check} />)}
          </div>
        </div>
      )}

      {result.block_reason && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-1.5"
        >
          Geblokkeerd: {result.block_reason}
        </motion.p>
      )}
    </motion.div>
  );
}
