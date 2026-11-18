export interface GuardrailEvent {
  type:
    | 'INPUT_RECEIVED'
    | 'CHECK_STARTED'
    | 'CHECK_PASSED'
    | 'CHECK_FAILED'
    | 'LLM_THINKING'
    | 'TOOL_CALL'
    | 'TOOL_RESULT'
    | 'JUDGE_SCORE'
    | 'OUTPUT_BLOCKED'
    | 'OUTPUT_DELIVERED'
    | 'FLOW_STEP'
    | 'MEDEWERKER_REVIEW_REQUESTED'
    | 'MEDEWERKER_DECISION'
    | 'CHAT_MESSAGE';
  checkName?: string;
  zone?: 'INPUT' | 'OUTPUT' | 'JUDGE';
  category?: 'ETHICS';
  reason?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  scores?: JudgeResult;
  preview?: string;
  step?: FlowStep;
  sessionId?: string;
  decision?: 'approved' | 'rejected';
  chatMessage?: ChatMessage;
}

export interface JudgeResult {
  checks: {
    on_topic: JudgeCheck;
    single_question: JudgeCheck;
    appropriate_length: JudgeCheck;
    no_pii_leaked: JudgeCheck;
    professional_tone: JudgeCheck;
    consent_respected: JudgeCheck;
    // Ethische guardrails (optioneel: oudere resultaten hebben deze niet)
    no_bias_discrimination?: JudgeCheck;
    no_deception?: JudgeCheck;
    no_manipulation?: JudgeCheck;
    ai_transparency?: JudgeCheck;
  };
  overall_score: number;
  recommendation: 'PASS' | 'WARN' | 'BLOCK';
  block_reason: string | null;
}

export interface JudgeCheck {
  pass: boolean;
  reason: string;
}

export type FlowStep =
  | 'GREETING'
  | 'RULES_FETCHED'
  | 'RULES_PRESENTED'
  | 'CONSENT_CHECK_REQUESTED'
  | 'CONSENT_CHECK_GIVEN'
  | 'ELIGIBILITY_CHECKING'
  | 'ELIGIBILITY_RESULT'
  | 'CONSENT_APPLY_REQUESTED'
  | 'CONSENT_APPLY_GIVEN'
  | 'APPLYING'
  | 'MEDEWERKER_PENDING'
  | 'MEDEWERKER_APPROVED'
  | 'MEDEWERKER_REJECTED'
  | 'CREDENTIAL_ISSUED';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  blocked?: boolean;
  blockZone?: string;
  judgeScore?: number;
  judgeRecommendation?: 'PASS' | 'WARN' | 'BLOCK';
  judgeResult?: JudgeResult;
}

export interface CheckItem {
  id: string;
  name: string;
  zone: 'INPUT' | 'OUTPUT' | 'JUDGE';
  category?: 'ETHICS';
  status: 'running' | 'passed' | 'failed' | 'pending';
  reason?: string;
  timestamp: number;
}

export interface ToolCallItem {
  id: string;
  toolName: string;
  args?: Record<string, unknown>;
  result?: unknown;
  timestamp: number;
  status: 'calling' | 'complete' | 'error';
}
