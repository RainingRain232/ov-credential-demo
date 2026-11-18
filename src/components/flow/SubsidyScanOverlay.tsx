'use client';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SUBSIDY_SCAN_TYPES, SubsidyScanType, SubsidyScanReport, SubsidyStatus, SubsidyResult,
  deriveWalletFacts, runSubsidyScan,
} from '@/lib/subsidyScan';

const SCAN_DURATION_MS = 5000;

const STEPS: Record<SubsidyScanType, string[]> = {
  alles:      ['Credentials inlezen…', 'Studieregelingen toetsen…', 'Zorgregelingen toetsen…', 'Woonregelingen toetsen…', 'Gezinsregelingen toetsen…', 'Inkomensregelingen toetsen…'],
  studie:     ['Credentials inlezen…', 'Inschrijving en studiefinanciering controleren…', 'Regelingen DUO toetsen…'],
  gezondheid: ['Credentials inlezen…', 'Zorgverzekering controleren…', 'Toeslagen en gemeentelijke regelingen toetsen…'],
  wonen:      ['Credentials inlezen…', 'Woonadres (BRP) controleren…', 'Huurtoeslag en lokale lasten toetsen…'],
  gezin:      ['Credentials inlezen…', 'Ouderlijk gezag en leeftijd kind controleren…', 'Regelingen SVB en Toeslagen toetsen…'],
  werk:       ['Credentials inlezen…', 'Inkomensgegevens controleren…', 'Kortingen en gemeentelijke regelingen toetsen…'],
};

const STATUS_STYLE: Record<SubsidyStatus, { box: string; text: string; badge: string; label: string }> = {
  'in aanmerking':      { box: 'bg-emerald-900/15 border-emerald-700/40', text: 'text-emerald-300', badge: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50', label: 'In aanmerking' },
  'mogelijk':           { box: 'bg-amber-900/10 border-amber-700/40',     text: 'text-amber-300',   badge: 'bg-amber-900/40 text-amber-300 border-amber-700/50',       label: 'Mogelijk' },
  'al ontvangen':       { box: 'bg-sky-900/10 border-sky-700/40',         text: 'text-sky-300',     badge: 'bg-sky-900/40 text-sky-300 border-sky-700/50',             label: 'Al ontvangen' },
  'niet in aanmerking': { box: 'bg-slate-800/40 border-slate-700/60',     text: 'text-slate-400',   badge: 'bg-slate-800 text-slate-400 border-slate-600',             label: 'Niet in aanmerking' },
};

const CATEGORY_LABEL: Record<string, string> = {
  studie: 'Studie', gezondheid: 'Gezondheid', wonen: 'Wonen', gezin: 'Gezin & kinderen', werk: 'Werk & inkomen',
};

interface Cred { type: string[]; validUntil?: string; raw: Record<string, unknown> }

function ResultCard({ r }: { r: SubsidyResult }) {
  const st = STATUS_STYLE[r.status];
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`${st.box} border rounded-xl px-4 py-3`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[12px] font-semibold ${st.text}`}>{r.name}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${st.badge}`}>{st.label}</span>
        <span className="ml-auto text-[10px] text-slate-500">{r.provider} · {CATEGORY_LABEL[r.category]}</span>
      </div>
      <p className="text-[11px] text-slate-300 mt-1 leading-snug">{r.reason}</p>
      {r.rules && r.rules.length > 0 && (
        <details className="group mt-2" open={r.status !== 'niet in aanmerking'}>
          <summary className="cursor-pointer text-[10px] text-slate-400 hover:text-slate-200 select-none list-none flex items-center gap-1.5">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            Voorwaarden ({r.rules.filter(x => x.met).length} van {r.rules.length} voldaan)
          </summary>
          <div className="mt-1.5 space-y-1">
            {r.rules.map(rule => (
              <div key={rule.label} className="flex items-start gap-2 text-[10px]">
                <span className={`flex-shrink-0 w-3.5 h-3.5 mt-px rounded-full flex items-center justify-center text-[8px] font-bold ${rule.met ? 'bg-emerald-500 text-white' : 'bg-red-500/80 text-white'}`}>
                  {rule.met ? '✓' : '✕'}
                </span>
                <div className="min-w-0">
                  <div className={rule.met ? 'text-slate-200' : 'text-red-300'}>{rule.label}</div>
                  <div className="text-slate-500 leading-snug">{rule.evidence}</div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      {r.basedOn.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mt-2">
          <span className="text-[9px] text-slate-500">Gebaseerd op:</span>
          {r.basedOn.map(b => (
            <span key={b} className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">{b}</span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function SubsidyScanOverlay({ credentials, onClose }: { credentials: Cred[]; onClose: () => void }) {
  const [type, setType] = useState<SubsidyScanType>('alles');
  const [scanning, setScanning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [report, setReport] = useState<SubsidyScanReport | null>(null);

  const facts = useMemo(() => deriveWalletFacts(credentials), [credentials]);

  useEffect(() => {
    if (!scanning) return;
    const start = Date.now();
    const timer = setInterval(() => {
      const ms = Math.min(SCAN_DURATION_MS, Date.now() - start);
      setElapsed(ms);
      if (ms >= SCAN_DURATION_MS) {
        clearInterval(timer);
        setReport(runSubsidyScan(type, facts));
        setScanning(false);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [scanning, type, facts]);

  const start = () => {
    setReport(null);
    setElapsed(0);
    setScanning(true);
  };

  const progress = (elapsed / SCAN_DURATION_MS) * 100;
  const remaining = Math.ceil((SCAN_DURATION_MS - elapsed) / 1000);
  const steps = STEPS[type];
  const stepText = steps[Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length))];
  const typeLabel = SUBSIDY_SCAN_TYPES.find(t => t.id === type)?.label;

  const relevant = report?.results.filter(r => r.status !== 'niet in aanmerking') ?? [];
  const notEligible = report?.results.filter(r => r.status === 'niet in aanmerking') ?? [];

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
        className="w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-100">Subsidie- en toelagenscanner</h3>
            <p className="text-[10px] text-slate-500">Ontdek op basis van uw credentials voor welke regelingen u in aanmerking komt</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Scantypes */}
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Kies een scan</div>
            <div className="grid grid-cols-3 gap-2">
              {SUBSIDY_SCAN_TYPES.map(t => {
                const active = t.id === type;
                return (
                  <button
                    key={t.id}
                    disabled={scanning}
                    onClick={() => { setType(t.id); setReport(null); }}
                    className={`text-left border rounded-xl px-3 py-2.5 transition-colors disabled:cursor-not-allowed ${
                      active ? 'bg-emerald-900/25 border-emerald-600/60' : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800'
                    }`}
                  >
                    <div className={`text-[12px] font-semibold ${active ? 'text-emerald-200' : 'text-slate-200'}`}>{t.label}</div>
                    <div className="text-[10px] text-slate-500 leading-snug mt-0.5">{t.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start + timer */}
          <div className="bg-emerald-900/10 border border-emerald-800/40 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[12px] text-emerald-200 font-semibold">{typeLabel}</div>
                <div className="text-[10px] text-slate-500">Uw gegevens blijven in de wallet; de scan gebeurt lokaal.</div>
              </div>
              <button
                onClick={start}
                disabled={scanning}
                className="flex-shrink-0 text-[11px] font-medium px-3.5 py-2 rounded-lg border bg-emerald-600/80 hover:bg-emerald-500 text-white border-emerald-500/60 disabled:opacity-50 disabled:cursor-wait"
              >
                {scanning ? 'Bezig met scannen…' : report ? 'Opnieuw scannen' : 'Start scan'}
              </button>
            </div>
            {scanning && (
              <div className="mt-4">
                <div className="flex items-end justify-between mb-1.5">
                  <span className="text-[10px] text-slate-400">{stepText}</span>
                  <span className="text-[18px] font-bold text-emerald-300 tabular-nums leading-none">
                    0:0{remaining}
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-300 rounded-full transition-[width] duration-75" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between mt-1 text-[9px] text-slate-600 tabular-nums">
                  <span>{(elapsed / 1000).toFixed(1)} s verstreken</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Resultaat */}
          <AnimatePresence>
            {!scanning && report && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Resultaat {typeLabel?.toLowerCase()}</div>
                    <div className="text-[11px] text-slate-400">{report.checked} regelingen getoetst op {new Date(report.scannedAt).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {(['in aanmerking', 'mogelijk', 'al ontvangen', 'niet in aanmerking'] as SubsidyStatus[]).map(s => (
                    <div key={s} className={`${STATUS_STYLE[s].box} border rounded-lg px-3 py-2`}>
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider">{STATUS_STYLE[s].label}</div>
                      <div className={`text-lg font-bold tabular-nums ${STATUS_STYLE[s].text}`}>{report.counts[s]}</div>
                    </div>
                  ))}
                </div>

                {relevant.length === 0 ? (
                  <p className="text-[11px] text-slate-400">Geen regelingen gevonden waarvoor u in aanmerking komt in deze categorie.</p>
                ) : (
                  <div className="space-y-2">
                    {relevant.map(r => <ResultCard key={r.id} r={r} />)}
                  </div>
                )}

                {notEligible.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300 select-none list-none flex items-center gap-1.5">
                      <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                      Niet in aanmerking ({notEligible.length}) — bekijk waarom
                    </summary>
                    <div className="space-y-2 mt-2">
                      {notEligible.map(r => <ResultCard key={r.id} r={r} />)}
                    </div>
                  </details>
                )}

                <p className="text-[10px] text-slate-500 leading-snug">
                  Deze uitkomst is indicatief en gebaseerd op de credentials in uw wallet. Inkomen, huur en vermogen zijn niet bekend in de wallet;
                  de uitvoerende instantie neemt het definitieve besluit na uw aanvraag.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
