'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessage, JudgeCheck, JudgeResult } from '@/lib/types';
import { judgeLabel, splitJudgeChecks } from '@/lib/judgeLabels';

type Style = 'professional' | 'rustig' | 'inburgering';


// Persona-specific avatar SVGs (small, for inline use in bubbles)
function ProfessionalAvatar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="7.5" r="4.5" fill="#bfdbfe" />
      <path d="M3 23 C3 15.5 7 12.5 12 12.5 C17 12.5 21 15.5 21 23Z" fill="#1d4ed8" />
      <path d="M12 12.5 L9.5 16 L12 14.5Z" fill="#1e3a8a" />
      <path d="M12 12.5 L14.5 16 L12 14.5Z" fill="#1e3a8a" />
      <path d="M11 12.5 L12 18 L13 12.5 L12.6 15 L11.4 15Z" fill="#93c5fd" />
    </svg>
  );
}

function RustigAvatar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="5" fill="#a7f3d0" />
      <ellipse cx="10" cy="7" rx="0.9" ry="1" fill="#065f46" />
      <ellipse cx="14" cy="7" rx="0.9" ry="1" fill="#065f46" />
      <path d="M9.5 9.5 Q12 12 14.5 9.5" stroke="#059669" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M3 23 C3 15.5 7 13 12 13 C17 13 21 15.5 21 23Z" fill="#059669" />
      <path d="M10 13 L12 16.5 L14 13" fill="#a7f3d0" opacity="0.4" />
    </svg>
  );
}

function CasualAvatar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M6.5 10 Q6.5 3 12 3 Q17.5 3 17.5 10" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" fill="none" />
      <rect x="5" y="8.5" width="3" height="5" rx="1.5" fill="#7c3aed" />
      <rect x="16" y="8.5" width="3" height="5" rx="1.5" fill="#7c3aed" />
      <circle cx="12" cy="12" r="5" fill="#c4b5fd" />
      <path d="M9.5 11 L11 11" stroke="#4c1d95" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M13 11 L14.5 11" stroke="#4c1d95" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M10.5 13.5 Q12 14.5 13.5 13.5" stroke="#4c1d95" strokeWidth="1" strokeLinecap="round" fill="none" />
      <path d="M3 23 C3 17 7 15 12 15 C17 15 21 17 21 23Z" fill="#5b21b6" />
      <path d="M10.5 15 L12 18 L13.5 15" fill="#7c3aed" opacity="0.5" />
    </svg>
  );
}

const BUBBLE_THEME: Record<Style, { avatarGrad: string; userBubble: string; Avatar: React.FC }> = {
  professional: {
    avatarGrad: 'from-blue-700 to-slate-700',
    userBubble: 'bg-blue-600 shadow-blue-500/20',
    Avatar: ProfessionalAvatar,
  },
  rustig: {
    avatarGrad: 'from-emerald-600 to-teal-700',
    userBubble: 'bg-emerald-700 shadow-emerald-500/20',
    Avatar: RustigAvatar,
  },
  inburgering: {
    avatarGrad: 'from-violet-500 to-purple-700',
    userBubble: 'bg-violet-600 shadow-violet-500/20',
    Avatar: CasualAvatar,
  },
};

function PopupRow({ id, check }: { id: string; check: JudgeCheck }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`flex-shrink-0 text-[11px] mt-0.5 ${check.pass ? 'text-emerald-400' : 'text-red-400'}`}>
        {check.pass ? '✓' : '✕'}
      </span>
      <div className="min-w-0">
        <span className="text-[10px] text-slate-300 font-medium">{judgeLabel(id)}</span>
        {check.reason && (
          <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">{check.reason}</p>
        )}
      </div>
    </div>
  );
}

function JudgePopup({ result }: { result: JudgeResult }) {
  const { quality, ethics } = splitJudgeChecks(result);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full left-0 mb-2 w-64 z-50 bg-slate-800/95 border border-slate-700/80 rounded-xl shadow-2xl shadow-black/30 p-3 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Beoordeling door Judge</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md
          ${result.recommendation === 'PASS' ? 'bg-emerald-900/60 text-emerald-400' :
            result.recommendation === 'WARN' ? 'bg-amber-900/60 text-amber-400' :
            'bg-red-900/60 text-red-400'}`}>
          {result.recommendation} {result.overall_score}/10
        </span>
      </div>
      <div className="space-y-1.5">
        {quality.map(([key, check]) => <PopupRow key={key} id={key} check={check} />)}
      </div>
      {ethics.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-700">
          <div className="text-[9px] font-bold text-rose-400 uppercase tracking-wider mb-1.5">Ethische guardrails</div>
          <div className="space-y-1.5">
            {ethics.map(([key, check]) => <PopupRow key={key} id={key} check={check} />)}
          </div>
        </div>
      )}
      {result.block_reason && (
        <div className="mt-2 pt-2 border-t border-slate-700 text-[10px] text-red-400">
          Geblokkeerd: {result.block_reason}
        </div>
      )}
      <div className="absolute -bottom-1.5 left-3 w-3 h-3 bg-slate-800/95 border-r border-b border-slate-700/80 rotate-45" />
    </motion.div>
  );
}

export default function MessageBubble({
  message,
  communicationStyle,
}: {
  message: ChatMessage;
  communicationStyle?: Style | null;
}) {
  const isUser = message.role === 'user';
  const [showJudge, setShowJudge] = useState(false);

  const t = BUBBLE_THEME[communicationStyle ?? 'professional'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      {!isUser && (
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${t.avatarGrad} flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 shadow-sm`}>
          <t.Avatar />
        </div>
      )}
      <div className="max-w-[80%]">
        <div className={`
          px-3.5 py-2.5 text-[13px] leading-relaxed
          ${isUser
            ? `${t.userBubble} text-white rounded-2xl rounded-br-md shadow-sm`
            : 'bg-slate-800/60 text-slate-100 rounded-2xl rounded-bl-md border border-slate-700/40'
          }
          ${message.blocked ? 'opacity-70 border-red-700/50 bg-red-900/20' : ''}
        `}>
          {message.blocked && (
            <div className="flex items-center gap-1.5 mb-1.5 text-red-400 text-[10px] font-semibold">
              <span>🚫</span>
              <span>GEBLOKKEERD door {message.blockZone} guardrail</span>
            </div>
          )}
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {message.judgeScore !== undefined && !isUser && (
          <div className="relative flex items-center gap-1.5 mt-1 ml-1">
            <button
              onMouseEnter={() => setShowJudge(true)}
              onMouseLeave={() => setShowJudge(false)}
              onClick={() => setShowJudge(v => !v)}
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium cursor-pointer transition-all hover:scale-105
                ${message.judgeRecommendation === 'PASS' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/30' :
                  message.judgeRecommendation === 'WARN' ? 'bg-amber-900/40 text-amber-400 border border-amber-800/30' :
                  'bg-red-900/40 text-red-400 border border-red-800/30'}`}
            >
              {message.judgeScore}/10 {message.judgeRecommendation}
            </button>
            <AnimatePresence>
              {showJudge && message.judgeResult && (
                <JudgePopup result={message.judgeResult} />
              )}
            </AnimatePresence>
          </div>
        )}

        <p className="text-[9px] text-slate-600 mt-1 px-1">
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-lg bg-slate-700/60 flex items-center justify-center text-xs flex-shrink-0 ml-2 mt-0.5">
          👤
        </div>
      )}
    </motion.div>
  );
}
