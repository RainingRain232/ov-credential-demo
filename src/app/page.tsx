'use client';
import { apiFetch } from '@/demo/api';
import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ChatInterface from '@/components/chat/ChatInterface';
import GuardrailsPanel from '@/components/guardrails/GuardrailsPanel';
import ServiceMessageFlow from '@/components/guardrails/ServiceMessageFlow';
import CredentialFlow from '@/components/flow/CredentialFlow';
import MedewerkerPanel from '@/components/medewerker/MedewerkerPanel';
import { getSocket, joinSession } from '@/lib/socket';
import {
  ChatMessage, GuardrailEvent, JudgeResult,
  CheckItem, FlowStep, ToolCallItem
} from '@/lib/types';


type CommunicationStyle = 'professional' | 'rustig' | 'inburgering';

export default function Home() {
  const [sessionId, setSessionId]  = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [flowStep, setFlowStep] = useState<FlowStep>('GREETING');
  const [communicationStyle, setCommunicationStyle] = useState<CommunicationStyle | null>(null);
  const [duoMode, setDuoMode] = useState(false);

  // Guardrail state
  const [events, setEvents] = useState<GuardrailEvent[]>([]);
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [activeZone, setActiveZone] = useState<'INPUT' | 'LLM' | 'OUTPUT' | 'JUDGE' | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCallItem[]>([]);
  const [toolCallLog, setToolCallLog] = useState<ToolCallItem[]>([]); // cumulative across all messages
  const [lastBlockedZone, setLastBlockedZone] = useState<string | null>(null);
  const [activeToolName, setActiveToolName] = useState<string | undefined>(undefined);

  const [modelLabel, setModelLabel] = useState<string>('LLM');
  const [judgeModelLabel, setJudgeModelLabel] = useState<string>('LLM');
  const [showServiceFlow, setShowServiceFlow] = useState(true);
  const [showGuardrails, setShowGuardrails] = useState(true);
  const [showFlowBar, setShowFlowBar] = useState(true);
  const [showMedewerker, setShowMedewerker] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [medewerkerMaximized, setMedewerkerMaximized] = useState(false);
  const [medewerkerPending, setMedewerkerPending] = useState(false);

  const activeZoneRef = useRef(activeZone);
  activeZoneRef.current = activeZone;

  // Generate session ID client-side only (avoids hydration mismatch)
  useEffect(() => {
    setSessionId(uuidv4());
  }, []);

  // Fetch active model/provider labels
  useEffect(() => {
    apiFetch(`/api/config`)
      .then(r => r.json())
      .then((d: { modelLabel: string; judgeModelLabel: string }) => {
        setModelLabel(d.modelLabel);
        setJudgeModelLabel(d.judgeModelLabel);
      })
      .catch(() => {});
  }, []);

  // Connect WebSocket and join session room
  useEffect(() => {
    if (!sessionId) return; // wait until sessionId is set
    const socket = getSocket();
    joinSession(sessionId);

    socket.on('guardrail', (event: GuardrailEvent) => {
      setEvents(prev => [...prev.slice(-99), event]);

      switch (event.type) {
        case 'INPUT_RECEIVED':
          setLastBlockedZone(null);
          setChecks([]);
          setToolCalls([]);
          setJudgeResult(null);
          setActiveZone('INPUT');
          break;

        case 'CHECK_STARTED':
          setChecks(prev => [...prev, {
            id: uuidv4(),
            name: event.checkName || '',
            zone: event.zone as 'INPUT' | 'OUTPUT' | 'JUDGE',
                  category: event.category,
            status: 'running',
            timestamp: Date.now()
          }]);
          break;

        case 'CHECK_PASSED':
          setChecks(prev => prev.map(c =>
            c.name === event.checkName && c.zone === event.zone && c.status === 'running'
              ? { ...c, status: 'passed' as const }
              : c
          ).concat(
            prev.some(c => c.name === event.checkName && c.zone === event.zone)
              ? []
              : [{
                  id: uuidv4(),
                  name: event.checkName || '',
                  zone: event.zone as 'INPUT' | 'OUTPUT' | 'JUDGE',
                  category: event.category,
                  status: 'passed' as const,
                  timestamp: Date.now()
                }]
          ));
          if (event.zone === 'INPUT') setActiveZone('INPUT');
          if (event.zone === 'OUTPUT') setActiveZone('OUTPUT');
          if (event.zone === 'JUDGE') setActiveZone('JUDGE');
          break;

        case 'CHECK_FAILED':
          setChecks(prev => prev.map(c =>
            c.name === event.checkName && c.zone === event.zone && c.status === 'running'
              ? { ...c, status: 'failed' as const, reason: event.reason }
              : c
          ).concat(
            prev.some(c => c.name === event.checkName && c.zone === event.zone)
              ? []
              : [{
                  id: uuidv4(),
                  name: event.checkName || '',
                  zone: event.zone as 'INPUT' | 'OUTPUT' | 'JUDGE',
                  category: event.category,
                  status: 'failed' as const,
                  reason: event.reason,
                  timestamp: Date.now()
                }]
          ));
          break;

        case 'LLM_THINKING':
          setIsThinking(true);
          setActiveZone('LLM');
          break;

        case 'TOOL_CALL': {
          setIsThinking(false);
          setActiveToolName(event.toolName || undefined);
          const newTc: ToolCallItem = {
            id: uuidv4(),
            toolName: event.toolName || '',
            args: event.args,
            status: 'calling',
            timestamp: Date.now()
          };
          setToolCalls(prev => [...prev, newTc]);
          setToolCallLog(prev => [...prev, newTc]);
          break;
        }

        case 'TOOL_RESULT':
          setActiveToolName(undefined);
          setToolCalls(prev => prev.map(tc =>
            tc.toolName === event.toolName && tc.status === 'calling'
              ? { ...tc, status: 'complete', result: event.result }
              : tc
          ));
          setToolCallLog(prev => {
            // update the most recent matching call that is still 'calling'
            const idx = [...prev].reverse().findIndex(tc => tc.toolName === event.toolName && tc.status === 'calling');
            if (idx === -1) return prev;
            const realIdx = prev.length - 1 - idx;
            return prev.map((tc, i) => i === realIdx ? { ...tc, status: 'complete' as const, result: event.result } : tc);
          });
          setIsThinking(true); // LLM continues after tool result
          break;

        case 'JUDGE_SCORE':
          setJudgeResult(event.scores || null);
          setActiveZone('JUDGE');
          break;

        case 'OUTPUT_BLOCKED':
          setLastBlockedZone(activeZoneRef.current || 'OUTPUT');
          setIsThinking(false);
          setActiveZone(null);
          break;

        case 'OUTPUT_DELIVERED':
          setIsThinking(false);
          setActiveZone(null);
          setLastBlockedZone(null);
          break;

        case 'FLOW_STEP':
          if (event.step) setFlowStep(event.step);
          break;

        case 'MEDEWERKER_REVIEW_REQUESTED':
          setMedewerkerPending(true);
          setShowMedewerker(true);
          break;

        case 'MEDEWERKER_DECISION':
          setMedewerkerPending(false);
          break;

        case 'CHAT_MESSAGE':
          if (event.chatMessage) {
            setMessages(prev => [...prev, event.chatMessage!]);
          }
          break;
      }
    });

    return () => {
      socket.off('guardrail');
    };
  }, [sessionId]);

  const handleMedewerkerDecision = useCallback(async (decision: 'approved' | 'rejected') => {
    try {
      await apiFetch(`/api/medewerker/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, decision })
      });
    } catch (err) {
      console.error('Medewerker decision failed:', err);
    }
  }, [sessionId]);

  const sendMessage = useCallback(async (message: string) => {
    if (medewerkerPending) return;
    if (isLoading || !sessionId) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await apiFetch(`/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message, communicationStyle })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as {
        response: string;
        blocked: boolean;
        blockZone?: string;
        blockReason?: string;
        judgeResult?: JudgeResult;
        flowStep: FlowStep;
      };

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        blocked: data.blocked,
        blockZone: data.blockZone,
        judgeScore: data.judgeResult?.overall_score,
        judgeRecommendation: data.judgeResult?.recommendation,
        judgeResult: data.judgeResult
      };

      setMessages(prev => [...prev, assistantMsg]);
      if (data.judgeResult) setJudgeResult(data.judgeResult);
      if (data.flowStep) setFlowStep(data.flowStep);

    } catch (err) {
      console.error('Send failed:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, er is een fout opgetreden. Probeer het opnieuw.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, sessionId, medewerkerPending]);

  const CACHED_OV_ANSWERS: Record<CommunicationStyle, string> = {
    professional:
`OV-credential — samenvatting:

Digitaal verifieerbaar reisbewijs voor gereduceerd OV in Nederland. Twee varianten:
• Jeugd-OV: <18 jaar — leeftijdsbewijs + EU-burgerschap + onderwijsinschrijving
• Studenten-OV: ≥18 jaar — leeftijdsbewijs + EU-burgerschap + universiteitsinschrijving

Opslag: digitale wallet. Verificatie: ja/nee — geen persoonsgegevens gedeeld.

Wilt u een geschiktheidscheck uitvoeren?`,

    rustig:
`Een OV-credential is een digitaal, verifieerbaar bewijs dat u recht geeft op gereduceerd openbaar vervoer in Nederland.

Er zijn twee soorten, en het systeem bepaalt automatisch welke voor u van toepassing is:

• Jeugd-OV-credential — voor inwoners jonger dan 18 jaar. U heeft hiervoor nodig: een bewijs van uw leeftijd, een geldig EU-burgerschap en een inschrijving bij een onderwijsinstelling.

• Studenten-OV-credential — voor studenten van 18 jaar of ouder. De vereisten zijn hetzelfde, maar dan met bewijs dat u 18 jaar of ouder bent en ingeschreven staat bij een universiteit.

Uw gegevens worden veilig bewaard in uw persoonlijke digitale wallet. Wanneer u reist, ontvangt de vervoerder enkel een ja of nee — uw persoonlijke informatie blijft te allen tijde beschermd.

Wilt u dat ik voor u controleer of u in aanmerking komt?`,

    inburgering:
`Een OV-credential is een bewijs op uw telefoon. Met dit bewijs krijgt u korting op de bus, tram en trein.

Er zijn twee soorten:
• Jeugd-OV: voor kinderen en jongeren jonger dan 18 jaar.
• Studenten-OV: voor studenten van 18 jaar of ouder.

Wat heeft u nodig?
• Een bewijs van uw leeftijd.
• Een bewijs dat u burger bent van de Europese Unie (EU).
• Een bewijs dat u op een school of universiteit staat ingeschreven.

Deze bewijzen staan in uw wallet. Een wallet is een app op uw telefoon. De vervoerder ziet alleen "ja" of "nee". Uw gegevens blijven geheim.

Zal ik kijken of u korting kunt krijgen?`,
  };

  const handleCachedQuestion = useCallback(() => {
    const now = new Date().toISOString();
    const answer = CACHED_OV_ANSWERS[communicationStyle ?? 'professional'];
    setMessages(prev => [
      ...prev,
      { role: 'user', content: 'Wat is een OV-credential?', timestamp: now },
      { role: 'assistant', content: answer, timestamp: now }
    ]);
    setToolCallLog(prev => [...prev, {
      id: crypto.randomUUID(),
      toolName: 'standaard_antwoord',
      status: 'complete' as const,
      timestamp: Date.now()
    }]);
  }, [communicationStyle]);

  return (
    <div className="flex flex-col h-screen bg-slate-950" data-duo={duoMode ? 'true' : 'false'}>
      {/* Top header */}
      <header className="flex items-center justify-between px-6 py-2.5 bg-slate-900/80 border-b border-slate-800 flex-shrink-0 glass">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm shadow-lg shadow-blue-500/20">
            🚌
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 tracking-tight">OV Credential Portaal</h1>
            <p className="text-[10px] text-slate-500">Beschermd door real-time guardrails</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Panel toggles */}
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1 border border-slate-700/50">
            <button
              onClick={() => setShowChat(v => !v)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                showChat
                  ? 'bg-blue-500/20 text-blue-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setShowFlowBar(v => !v)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                showFlowBar
                  ? 'bg-emerald-500/20 text-emerald-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              Stappen
            </button>
            <button
              onClick={() => setShowServiceFlow(v => !v)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                showServiceFlow
                  ? 'bg-indigo-500/20 text-indigo-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              Berichtenverkeer
            </button>
            <button
              onClick={() => setShowGuardrails(v => !v)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                showGuardrails
                  ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              Guardrails
            </button>
            <button
              onClick={() => setShowMedewerker(v => !v)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                showMedewerker
                  ? 'bg-amber-500/20 text-amber-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              Medewerker
            </button>
          </div>

          <div className="w-px h-4 bg-slate-700" />

          {/* DUO styling toggle */}
          <button
            onClick={() => setDuoMode(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all border ${
              duoMode
                ? 'bg-[#e17000] border-[#c56200] text-white shadow-sm'
                : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-300 hover:border-slate-600'
            }`}
          >
            <span className="font-bold tracking-tight">DUO</span>
            <span className="opacity-70">{duoMode ? 'aan' : 'uit'}</span>
          </button>

          <div className="w-px h-4 bg-slate-700" />

          <span className="text-[10px] text-slate-600 font-mono" suppressHydrationWarning>{sessionId ? sessionId.slice(0, 8) : '...'}</span>
          <span
            title="Online demo: de assistent is gescript en er draait geen taalmodel. De guardrails zijn echt."
            className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300"
          >
            Demo · zonder taalmodel
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Actief
          </div>
        </div>
      </header>

      {/* Credential flow tracker */}
      {showFlowBar && (
        <div className="px-4 pt-3 flex-shrink-0">
          <CredentialFlow currentStep={flowStep} />
        </div>
      )}

      {/* Main layout: chat | service flow | guardrails */}
      <div className="flex flex-1 gap-2.5 p-2.5 overflow-hidden min-h-0">

        {/* Chat — expands when panels are hidden */}
        {showChat && (
          <div
            className="flex flex-col bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden glow-border transition-all duration-300"
            style={{ flex: !showServiceFlow && !showGuardrails ? '1 1 100%' : '0 0 34%' }}
          >
            <ChatInterface
              messages={messages}
              onSend={sendMessage}
              isLoading={isLoading}
              flowStep={flowStep}
              communicationStyle={communicationStyle}
              onSelectStyle={setCommunicationStyle}
              onCachedQuestion={handleCachedQuestion}
            />
          </div>
        )}

        {/* Service Message Flow */}
        {showServiceFlow && (
          <div className="flex flex-col gap-2 min-h-0 overflow-hidden bg-slate-900/40 border border-slate-800 rounded-2xl p-3 glow-border" style={{ flex: showGuardrails ? '0 0 30%' : '1 1 auto' }}>
            <div className="flex items-center flex-shrink-0">
              <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="text-indigo-400">&#9679;</span> Serviceberichten
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <ServiceMessageFlow toolCalls={toolCallLog} />
            </div>
          </div>
        )}

        {/* Guardrails panel */}
        {showGuardrails && (
          <div className="flex-1 overflow-hidden flex flex-col gap-2 min-h-0 bg-slate-900/40 border border-slate-800 rounded-2xl p-3 glow-border">
            <div className="flex items-center justify-between flex-shrink-0">
              <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="text-cyan-400">&#9679;</span> Live Guardrails
              </h2>
              {lastBlockedZone && (
                <span className="text-[10px] px-2 py-0.5 bg-red-900/50 border border-red-700/50 rounded-full text-red-400 font-medium animate-pulse">
                  Geblokkeerd: {lastBlockedZone}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <GuardrailsPanel
                events={events}
                checks={checks}
                judgeResult={judgeResult}
                isThinking={isThinking}
                activeZone={activeZone}
                toolCalls={toolCalls}
                lastBlockedZone={lastBlockedZone}
                modelLabel={modelLabel}
                judgeModelLabel={judgeModelLabel}
                activeToolName={activeToolName}
              />
            </div>
          </div>
        )}

        {/* Medewerker panel */}
        {showMedewerker && (
          <div className="flex flex-col gap-2 min-h-0 overflow-hidden bg-slate-900/40 border border-amber-800/30 rounded-2xl p-3 glow-border transition-all duration-300" style={{ flex: medewerkerMaximized ? '1 1 auto' : '0 0 25%' }}>
            <MedewerkerPanel
              sessionId={sessionId}
              messages={messages}
              toolCallLog={toolCallLog}
              flowStep={flowStep}
              isPending={medewerkerPending}
              onDecision={handleMedewerkerDecision}
              maximized={medewerkerMaximized}
              onToggleMaximize={() => setMedewerkerMaximized(v => !v)}
            />
          </div>
        )}

      </div>

    </div>
  );
}
