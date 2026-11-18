'use client';
import { motion, AnimatePresence } from 'framer-motion';

interface DataFlowVizProps {
  isThinking: boolean;
  activeZone: 'INPUT' | 'LLM' | 'OUTPUT' | 'JUDGE' | null;
  toolCallActive: boolean;
  lastBlockedZone: string | null;
  modelLabel: string;
  activeToolName?: string;
}

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  get_eligibility_rules:          { label: 'Regels ophalen bij Triply',              icon: '🗄️' },
  check_user_eligibility:         { label: 'Leeftijdsgebaseerde geschiktheidscontrole', icon: '🔀' },
  apply_for_transport_credential: { label: 'OV-credential aanvragen',                icon: '🚌' },
  verify_rules_current:           { label: 'Regels controleren op actualiteit',      icon: '✅' },
};

const Particle = ({ delay, color }: { delay: number; color: string }) => (
  <motion.div
    className={`absolute w-1 h-1 rounded-full ${color}`}
    initial={{ left: '0%', opacity: 0 }}
    animate={{ left: '100%', opacity: [0, 0.8, 0.8, 0] }}
    transition={{ duration: 1, delay, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.6 }}
  />
);

function ZoneBox({
  label, color, active, blocked, icon, glowColor
}: {
  label: string;
  color: string;
  active: boolean;
  blocked?: boolean;
  icon: string;
  glowColor: string;
}) {
  return (
    <motion.div
      animate={{
        boxShadow: active
          ? blocked
            ? '0 0 16px rgba(239,68,68,0.35)'
            : `0 0 16px ${glowColor}`
          : '0 0 0px transparent',
        borderColor: active
          ? blocked ? '#ef4444' : color
          : '#1e293b',
      }}
      transition={{ duration: 0.3 }}
      className="relative flex-1 border rounded-xl p-2 text-center bg-slate-900/80"
    >
      <div className="text-base mb-0.5">{icon}</div>
      <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
      {active && (
        <motion.div
          className={`absolute inset-0 rounded-xl ${blocked ? 'bg-red-500' : 'bg-blue-500'}`}
          animate={{ opacity: [0.03, 0.08, 0.03] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
      {blocked && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-[8px] shadow-md shadow-red-500/30"
        >
          ✕
        </motion.div>
      )}
    </motion.div>
  );
}

function Connector({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="relative h-0.5 w-4 bg-slate-800 rounded overflow-hidden flex-shrink-0">
      {active && (
        <>
          <Particle delay={0} color={color} />
          <Particle delay={0.4} color={color} />
        </>
      )}
    </div>
  );
}

export default function DataFlowViz({ isThinking, activeZone, toolCallActive, lastBlockedZone, modelLabel, activeToolName }: DataFlowVizProps) {
  const toolMeta = activeToolName ? TOOL_LABELS[activeToolName] : null;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
      <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
        Gegevensstroom
      </h4>

      <div className="flex items-center gap-1">
        <ZoneBox label="Invoer" color="#8b5cf6" glowColor="rgba(139,92,246,0.25)" icon="📥" active={activeZone === 'INPUT'} blocked={lastBlockedZone === 'INPUT'} />
        <Connector active={activeZone === 'INPUT' && !lastBlockedZone} color="bg-violet-400" />
        <ZoneBox label="LLM" color="#3b82f6" glowColor="rgba(59,130,246,0.25)" icon="🤖" active={activeZone === 'LLM' || isThinking} blocked={false} />
        <Connector active={(activeZone === 'OUTPUT' || activeZone === 'JUDGE') && !lastBlockedZone} color="bg-amber-400" />
        <ZoneBox label="Uitvoer" color="#f59e0b" glowColor="rgba(245,158,11,0.25)" icon="📤" active={activeZone === 'OUTPUT'} blocked={lastBlockedZone === 'OUTPUT'} />
        <Connector active={activeZone === 'JUDGE' && !lastBlockedZone} color="bg-cyan-400" />
        <ZoneBox label="Beoordelaar" color="#06b6d4" glowColor="rgba(6,182,212,0.25)" icon="⚖️" active={activeZone === 'JUDGE'} blocked={lastBlockedZone === 'JUDGE'} />
      </div>

      {/* Tool call indicator */}
      <AnimatePresence>
        {toolCallActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 flex items-center gap-2 px-2.5 py-1.5 bg-indigo-500/8 border border-indigo-500/20 rounded-lg"
          >
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-indigo-300 text-[10px] font-medium">
                {toolMeta ? `${toolMeta.icon} ${toolMeta.label}` : 'MCP tool-aanroep bezig'}
              </div>
              {activeToolName && (
                <div className="text-[9px] text-indigo-400/50 font-mono truncate">{activeToolName}()</div>
              )}
            </div>
            {activeToolName === 'check_user_eligibility' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-teal-500/10 border border-teal-500/20 text-teal-400 font-mono flex-shrink-0">
                age-route
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* LLM thinking indicator */}
      <AnimatePresence>
        {isThinking && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 flex items-center gap-2 px-2 py-1.5 bg-blue-500/8 border border-blue-500/20 rounded-lg"
          >
            <div className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1 h-1 rounded-full bg-blue-400"
                  animate={{ y: [0, -3, 0], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.6, delay: i * 0.12, repeat: Infinity }}
                />
              ))}
            </div>
            <span className="text-blue-400/70 text-[10px] font-medium">{modelLabel} denkt na...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
