'use client';
import { motion } from 'framer-motion';
import { CheckItem as CheckItemType } from '@/lib/types';

const ZONE_COLORS = {
  INPUT:  { bg: 'bg-violet-500/8',  border: 'border-violet-500/20', text: 'text-violet-400', dot: 'border-violet-400' },
  OUTPUT: { bg: 'bg-amber-500/8',   border: 'border-amber-500/20',  text: 'text-amber-400',  dot: 'border-amber-400'  },
  JUDGE:  { bg: 'bg-cyan-500/8',    border: 'border-cyan-500/20',   text: 'text-cyan-400',   dot: 'border-cyan-400'   },
  ETHICS: { bg: 'bg-rose-500/8',    border: 'border-rose-500/20',   text: 'text-rose-400',   dot: 'border-rose-400'   },
};

export default function CheckItemComponent({ item }: { item: CheckItemType }) {
  const colors = ZONE_COLORS[item.category === 'ETHICS' ? 'ETHICS' : item.zone];

  return (
    <motion.div
      initial={{ opacity: 0, x: -8, height: 0 }}
      animate={{ opacity: 1, x: 0, height: 'auto' }}
      exit={{ opacity: 0, x: 8, height: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg border ${colors.bg} ${colors.border} mb-1.5`}
    >
      {/* Status icon */}
      <div className="flex-shrink-0 mt-0.5">
        {item.status === 'running' && (
          <div className={`w-3 h-3 rounded-full border-[1.5px] ${colors.dot} border-t-transparent animate-spin`} />
        )}
        {item.status === 'passed' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center"
          >
            <svg viewBox="0 0 10 10" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="2,5 4,7.5 8,2.5" />
            </svg>
          </motion.div>
        )}
        {item.status === 'failed' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-3 h-3 rounded-full bg-red-500 flex items-center justify-center"
          >
            <span className="text-white text-[7px] font-bold leading-none">✕</span>
          </motion.div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-semibold uppercase tracking-wide ${colors.text}`}>
            {item.category === 'ETHICS' ? 'ETHIEK' : item.zone === 'INPUT' ? 'INVOER' : item.zone === 'OUTPUT' ? 'UITVOER' : item.zone === 'JUDGE' ? 'BEOORDELAAR' : item.zone}
          </span>
          <span className="text-slate-300 text-[10px] font-medium truncate">{item.name}</span>
        </div>
        {item.status === 'failed' && item.reason && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-400/80 text-[9px] mt-0.5 leading-tight"
          >
            {item.reason}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
