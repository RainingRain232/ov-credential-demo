import { describe, it, expect } from 'vitest';
import type {
  FlowStep,
  GuardrailEvent,
  JudgeResult,
  JudgeCheck,
  ChatMessage,
  CheckItem,
  ToolCallItem,
} from '@/lib/types';

describe('FlowStep', () => {
  it('includes all expected values', () => {
    const allSteps: FlowStep[] = [
      'GREETING',
      'RULES_FETCHED',
      'RULES_PRESENTED',
      'CONSENT_CHECK_REQUESTED',
      'CONSENT_CHECK_GIVEN',
      'ELIGIBILITY_CHECKING',
      'ELIGIBILITY_RESULT',
      'CONSENT_APPLY_REQUESTED',
      'CONSENT_APPLY_GIVEN',
      'APPLYING',
      'MEDEWERKER_PENDING',
      'MEDEWERKER_APPROVED',
      'MEDEWERKER_REJECTED',
      'CREDENTIAL_ISSUED',
    ];

    expect(allSteps).toHaveLength(14);
    expect(allSteps).toContain('GREETING');
    expect(allSteps).toContain('CREDENTIAL_ISSUED');
    expect(allSteps).toContain('MEDEWERKER_PENDING');
    expect(allSteps).toContain('MEDEWERKER_APPROVED');
    expect(allSteps).toContain('MEDEWERKER_REJECTED');
  });
});

describe('Type structures (compile-time checks via type assertions)', () => {
  it('GuardrailEvent has expected shape', () => {
    const event: GuardrailEvent = {
      type: 'FLOW_STEP',
      step: 'GREETING',
    };
    expect(event.type).toBe('FLOW_STEP');
    expect(event.step).toBe('GREETING');
  });

  it('GuardrailEvent supports all event types', () => {
    const types: GuardrailEvent['type'][] = [
      'INPUT_RECEIVED',
      'CHECK_STARTED',
      'CHECK_PASSED',
      'CHECK_FAILED',
      'LLM_THINKING',
      'TOOL_CALL',
      'TOOL_RESULT',
      'JUDGE_SCORE',
      'OUTPUT_BLOCKED',
      'OUTPUT_DELIVERED',
      'FLOW_STEP',
      'MEDEWERKER_REVIEW_REQUESTED',
      'MEDEWERKER_DECISION',
      'CHAT_MESSAGE',
    ];
    expect(types).toHaveLength(14);
  });

  it('JudgeResult has all check fields', () => {
    const result: JudgeResult = {
      checks: {
        on_topic: { pass: true, reason: 'ok' },
        single_question: { pass: true, reason: 'ok' },
        appropriate_length: { pass: true, reason: 'ok' },
        no_pii_leaked: { pass: true, reason: 'ok' },
        professional_tone: { pass: true, reason: 'ok' },
        consent_respected: { pass: true, reason: 'ok' },
      },
      overall_score: 1.0,
      recommendation: 'PASS',
      block_reason: null,
    };
    expect(result.overall_score).toBe(1.0);
    expect(result.recommendation).toBe('PASS');
    expect(result.checks.on_topic.pass).toBe(true);
  });

  it('JudgeCheck has pass and reason', () => {
    const check: JudgeCheck = { pass: false, reason: 'off topic' };
    expect(check.pass).toBe(false);
    expect(check.reason).toBe('off topic');
  });

  it('ChatMessage has required fields', () => {
    const msg: ChatMessage = {
      role: 'user',
      content: 'hello',
      timestamp: '2024-01-01T00:00:00Z',
    };
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('hello');
    expect(msg.timestamp).toBeDefined();
  });

  it('ChatMessage supports optional fields', () => {
    const msg: ChatMessage = {
      role: 'assistant',
      content: 'hi',
      timestamp: '2024-01-01T00:00:00Z',
      blocked: true,
      blockZone: 'INPUT',
      judgeScore: 0.5,
      judgeRecommendation: 'WARN',
    };
    expect(msg.blocked).toBe(true);
    expect(msg.judgeRecommendation).toBe('WARN');
  });

  it('CheckItem has expected fields', () => {
    const item: CheckItem = {
      id: '1',
      name: 'test',
      zone: 'INPUT',
      status: 'passed',
      timestamp: Date.now(),
    };
    expect(item.zone).toBe('INPUT');
    expect(item.status).toBe('passed');
  });

  it('ToolCallItem has expected fields', () => {
    const item: ToolCallItem = {
      id: '1',
      toolName: 'get_eligibility_rules',
      timestamp: Date.now(),
      status: 'complete',
    };
    expect(item.toolName).toBe('get_eligibility_rules');
    expect(item.status).toBe('complete');
  });
});
