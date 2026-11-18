'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MessageBubble from './MessageBubble';
import { GUARDRAIL_EXAMPLES } from '@/demo/script';
import { ChatMessage, FlowStep } from '@/lib/types';

type Style = 'professional' | 'rustig' | 'inburgering';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading: boolean;
  flowStep: FlowStep;
  communicationStyle: Style | null;
  onSelectStyle: (style: Style) => void;
  onCachedQuestion: () => void;
}

const QUICK_REPLIES: { label: string; cached?: boolean }[] = [
  { label: "Ik wil graag een OV-credential aanvragen" },
  { label: "Vertel me over de toelatingscriteria" },
  { label: "Wat is een OV-credential?", cached: true },
];

const STYLES = [
  {
    id: 'professional' as const,
    label: 'Zakelijk & Efficiënt',
    desc: 'Focus op feiten en directe antwoorden.',
    icon: '💼',
    color: 'border-blue-500/40 hover:border-blue-400/60 hover:bg-blue-500/5',
  },
  {
    id: 'rustig' as const,
    label: 'Rustig & Uitgebreid',
    desc: 'Stap voor stap uitleg, met extra toelichting bij moeilijke onderdelen. Geschikt voor mensen met bijvoorbeeld een taalachterstand.',
    icon: '🌿',
    color: 'border-emerald-500/40 hover:border-emerald-400/60 hover:bg-emerald-500/5',
  },
  {
    id: 'inburgering' as const,
    label: 'Eenvoudig Nederlands',
    desc: 'Voor inburgeraars die Nederlands leren. Korte zinnen, makkelijke woorden en uitleg van moeilijke woorden.',
    icon: '📖',
    color: 'border-violet-500/40 hover:border-violet-400/60 hover:bg-violet-500/5',
  },
];

// ── Persona SVG avatars ─────────────────────────────────────────────────────

function ProfessionalAvatar({ large }: { large?: boolean }) {
  const sz = large ? 36 : 18;
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      {/* Head */}
      <circle cx="12" cy="7.5" r="4.5" fill="#bfdbfe" />
      {/* Suit body */}
      <path d="M3 23 C3 15.5 7 12.5 12 12.5 C17 12.5 21 15.5 21 23Z" fill="#1d4ed8" />
      {/* Lapels */}
      <path d="M12 12.5 L9.5 16 L12 14.5Z" fill="#1e3a8a" />
      <path d="M12 12.5 L14.5 16 L12 14.5Z" fill="#1e3a8a" />
      {/* Tie */}
      <path d="M11 12.5 L12 18 L13 12.5 L12.6 15 L11.4 15Z" fill="#93c5fd" />
    </svg>
  );
}

function RustigAvatar({ large }: { large?: boolean }) {
  const sz = large ? 36 : 18;
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      {/* Head */}
      <circle cx="12" cy="8" r="5" fill="#a7f3d0" />
      {/* Eyes */}
      <ellipse cx="10" cy="7" rx="0.9" ry="1" fill="#065f46" />
      <ellipse cx="14" cy="7" rx="0.9" ry="1" fill="#065f46" />
      {/* Warm smile */}
      <path d="M9.5 9.5 Q12 12 14.5 9.5" stroke="#059669" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {/* Body — cardigan */}
      <path d="M3 23 C3 15.5 7 13 12 13 C17 13 21 15.5 21 23Z" fill="#059669" />
      {/* Collar */}
      <path d="M10 13 L12 16.5 L14 13" fill="#a7f3d0" opacity="0.4" />
    </svg>
  );
}

function CasualAvatar({ large }: { large?: boolean }) {
  const sz = large ? 36 : 18;
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      {/* Headphone band */}
      <path d="M6.5 10 Q6.5 3 12 3 Q17.5 3 17.5 10" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Headphone cups */}
      <rect x="5" y="8.5" width="3" height="5" rx="1.5" fill="#7c3aed" />
      <rect x="16" y="8.5" width="3" height="5" rx="1.5" fill="#7c3aed" />
      {/* Head */}
      <circle cx="12" cy="12" r="5" fill="#c4b5fd" />
      {/* Cool eyes */}
      <path d="M9.5 11 L11 11" stroke="#4c1d95" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M13 11 L14.5 11" stroke="#4c1d95" strokeWidth="1.3" strokeLinecap="round" />
      {/* Smirk */}
      <path d="M10.5 13.5 Q12 14.5 13.5 13.5" stroke="#4c1d95" strokeWidth="1" strokeLinecap="round" fill="none" />
      {/* Body — hoodie */}
      <path d="M3 23 C3 17 7 15 12 15 C17 15 21 17 21 23Z" fill="#5b21b6" />
      {/* Hoodie strings */}
      <path d="M10.5 15 L12 18 L13.5 15" fill="#7c3aed" opacity="0.5" />
    </svg>
  );
}

// ── Per-persona theme ────────────────────────────────────────────────────────

const THEME: Record<Style, {
  avatarGrad: string;
  headerBorder: string;
  welcomeGrad: string;
  welcomeBorder: string;
  userBubble: string;
  inputFocus: string;
  sendBtn: string;
  name: string;
  subtitle: string;
  onlineDot: string;
  Avatar: React.FC<{ large?: boolean }>;
}> = {
  professional: {
    avatarGrad:   'from-blue-700 to-slate-700',
    headerBorder: 'border-blue-900/60',
    welcomeGrad:  'from-blue-500/15 to-indigo-900/20',
    welcomeBorder:'border-blue-500/25',
    userBubble:   'bg-blue-600 shadow-blue-500/20',
    inputFocus:   'focus-within:border-blue-500/50 focus-within:bg-slate-800/80',
    sendBtn:      'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20',
    name:         'OV Credential Assistent',
    subtitle:     'Nationale Autoriteit Openbaar Vervoer',
    onlineDot:    'bg-blue-400 shadow-blue-400/40',
    Avatar:       ProfessionalAvatar,
  },
  rustig: {
    avatarGrad:   'from-emerald-600 to-teal-700',
    headerBorder: 'border-emerald-900/60',
    welcomeGrad:  'from-emerald-500/15 to-teal-900/20',
    welcomeBorder:'border-emerald-500/25',
    userBubble:   'bg-emerald-700 shadow-emerald-500/20',
    inputFocus:   'focus-within:border-emerald-500/50 focus-within:bg-slate-800/80',
    sendBtn:      'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20',
    name:         'Uw OV-hulpgids',
    subtitle:     'Stap voor stap uitgelegd',
    onlineDot:    'bg-emerald-400 shadow-emerald-400/40',
    Avatar:       RustigAvatar,
  },
  inburgering: {
    avatarGrad:   'from-violet-500 to-purple-700',
    headerBorder: 'border-violet-900/60',
    welcomeGrad:  'from-violet-500/15 to-purple-900/20',
    welcomeBorder:'border-violet-500/25',
    userBubble:   'bg-violet-600 shadow-violet-500/20',
    inputFocus:   'focus-within:border-violet-500/50 focus-within:bg-slate-800/80',
    sendBtn:      'bg-violet-600 hover:bg-violet-500 shadow-violet-500/20',
    name:         'OV-hulp in eenvoudig Nederlands',
    subtitle:     'Korte zinnen, makkelijke woorden',
    onlineDot:    'bg-violet-400 shadow-violet-400/40',
    Avatar:       CasualAvatar,
  },
};

const DEFAULT_THEME = THEME.professional;

export default function ChatInterface({ messages, onSend, isLoading, flowStep, communicationStyle, onSelectStyle, onCachedQuestion }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const theme = communicationStyle ? THEME[communicationStyle] : DEFAULT_THEME;
  const { Avatar } = theme;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    onSend(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-2.5 border-b ${theme.headerBorder} flex-shrink-0`}>
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${theme.avatarGrad} flex items-center justify-center flex-shrink-0 shadow-md`}>
          <Avatar />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[13px] font-semibold text-slate-100">{theme.name}</h2>
          <p className="text-[10px] text-slate-500">{theme.subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full shadow-sm ${theme.onlineDot}`} />
          <span className="text-[10px] text-slate-500">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">

        {/* Style selection (no style chosen yet) */}
        {messages.length === 0 && !communicationStyle && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex flex-col items-center justify-center h-full text-center px-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 flex items-center justify-center mb-4">
              <span className="text-3xl">🎫</span>
            </div>
            <h3 className="text-slate-200 font-semibold mb-1">Welkom bij OV Credential Portaal</h3>
            <p className="text-slate-400 text-sm mb-6 max-w-xs leading-relaxed">
              Om u zo goed mogelijk te helpen: welke manier van communiceren heeft uw voorkeur?
            </p>
            <div className="flex flex-col gap-2.5 w-full max-w-xs">
              {STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => onSelectStyle(s.id)}
                  className={`px-4 py-3 border rounded-xl text-left transition-all ${s.color}`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-base">{s.icon}</span>
                    <span className="text-sm font-semibold text-slate-200">{s.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 pl-6">{s.desc}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Quick-start (style chosen, no messages yet) */}
        {messages.length === 0 && communicationStyle && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex flex-col items-center justify-center h-full text-center px-4"
          >
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${theme.welcomeGrad} border ${theme.welcomeBorder} flex items-center justify-center mb-4 shadow-lg`}>
              <Avatar large />
            </div>
            <h3 className="text-slate-200 font-semibold mb-1">
              {communicationStyle === 'inburgering' ? 'Korting op de bus en trein' : 'OV Credential Portaal'}
            </h3>
            <p className="text-slate-500 text-sm mb-6 max-w-xs leading-relaxed">
              {communicationStyle === 'professional' && 'Jeugd-OV (<18) of Studenten-OV (18+). Vereisten: EU-burgerschap + onderwijsinschrijving.'}
              {communicationStyle === 'rustig' && 'Er zijn twee soorten OV-credentials: Jeugd-OV voor inwoners jonger dan 18 jaar, en Studenten-OV voor studenten van 18 jaar of ouder. Beide vereisen EU-burgerschap en een geldige onderwijsinschrijving. We leggen elke stap uit.'}
              {communicationStyle === 'inburgering' && 'Gaat u naar school of studeert u? Dan krijgt u misschien korting op de bus en de trein. Wij helpen u. Kies hieronder een vraag.'}
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {QUICK_REPLIES.map(qr => (
                <button
                  key={qr.label}
                  onClick={() => qr.cached ? onCachedQuestion() : onSend(qr.label)}
                  className="px-4 py-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl text-sm text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-all text-left"
                >
                  {qr.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => (
            <MessageBubble
              key={`${msg.timestamp}-${i}`}
              message={msg}
              communicationStyle={communicationStyle}
            />
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 mb-3"
          >
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${theme.avatarGrad} flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Avatar />
            </div>
            <div className="bg-slate-800/60 border border-slate-700/40 px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-slate-400"
                    animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.7, delay: i * 0.15, repeat: Infinity }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Contextual quick replies */}
      {messages.length > 0 && !isLoading && (
        <AnimatePresence>
          <div className="px-4 pb-2 flex gap-2 flex-wrap">
            {flowStep === 'CONSENT_CHECK_REQUESTED' && (
              <>
                <motion.button
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => onSend('Ja, controleer mijn geschiktheid')}
                  className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 hover:bg-blue-500/20 transition-all"
                >
                  Ja, controleer mijn geschiktheid
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  onClick={() => onSend('Nee, nu niet')}
                  className="px-3 py-1.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-xs text-slate-400 hover:bg-slate-800 transition-all"
                >
                  Nee, nu niet
                </motion.button>
              </>
            )}
            {flowStep === 'CONSENT_APPLY_REQUESTED' && (
              <>
                <motion.button
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => onSend('Ja, vraag het aan')}
                  className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 hover:bg-emerald-500/20 transition-all"
                >
                  Ja, vraag het aan
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  onClick={() => onSend('Nee, nog niet')}
                  className="px-3 py-1.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-xs text-slate-400 hover:bg-slate-800 transition-all"
                >
                  Nee, nog niet
                </motion.button>
              </>
            )}
          </div>
        </AnimatePresence>
      )}

      {/* Guardrails testen (demo) */}
      {communicationStyle && (
        <div className="px-3 pb-2 flex-shrink-0">
          <button
            onClick={() => setShowExamples(v => !v)}
            className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1.5"
          >
            <span className={`inline-block transition-transform ${showExamples ? 'rotate-90' : ''}`}>▶</span>
            Guardrails testen
          </button>
          {showExamples && (
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {GUARDRAIL_EXAMPLES.map(ex => (
                <button
                  key={ex.label}
                  disabled={isLoading}
                  onClick={() => onSend(ex.message)}
                  title={ex.message}
                  className="text-left px-2.5 py-1.5 bg-slate-800/40 border border-slate-700/50 rounded-lg hover:bg-slate-800 hover:border-slate-600 transition-all disabled:opacity-40"
                >
                  <div className="text-[11px] text-slate-300 font-medium">{ex.label}</div>
                  <div className="text-[9px] text-slate-500">{ex.zone}{ex.note ? ` · ${ex.note}` : ''}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 flex-shrink-0">
        <div className={`flex gap-2 items-end bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2 transition-all ${theme.inputFocus}`}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Typ je bericht..."
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-600 resize-none focus:outline-none leading-5 max-h-24 scrollbar-thin"
            style={{ height: 'auto' }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className={`w-8 h-8 rounded-lg text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0 shadow-sm ${theme.sendBtn}`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.903 6.557H13.5a.75.75 0 010 1.5H4.182l-1.903 6.557a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z"/>
            </svg>
          </button>
        </div>
        <p className="text-[9px] text-slate-600 mt-1.5 text-center">
          Credentials worden priv&#233; geverifieerd — de assistent ontvangt alleen ja of nee
        </p>
      </div>
    </div>
  );
}
