import { describe, it, expect } from 'vitest';
import { normalizeJudgeResult, fallbackJudgeResult, JUDGE_SYSTEM_PROMPT, ETHICS_CHECK_KEYS } from '../demo/guardrails/judge.prompt';

describe('judge prompt', () => {
  it('includes all ethics criteria', () => {
    for (const k of ETHICS_CHECK_KEYS) expect(JUDGE_SYSTEM_PROMPT).toContain(`"${k}"`);
  });
});

describe('normalizeJudgeResult', () => {
  it('overrides a wrong single_question verdict from the model', () => {
    const r = normalizeJudgeResult({
      checks: { single_question: { pass: false, reason: 'onzin' } } as never,
      overall_score: 8, recommendation: 'PASS', block_reason: null,
    }, 'Wilt u verder gaan?');
    expect(r.checks.single_question.pass).toBe(true);
  });

  it('fails single_question deterministically with 2+ question marks', () => {
    const r = normalizeJudgeResult({ checks: {} as never }, 'Ja? Nee?');
    expect(r.checks.single_question.pass).toBe(false);
  });

  it('fills missing ethics checks', () => {
    const r = normalizeJudgeResult({ checks: {} as never, overall_score: 9 }, 'Hallo.');
    expect(r.checks.no_bias_discrimination?.reason).toBe('Niet beoordeeld door model');
  });

  it('raises PASS to WARN when an ethics check fails', () => {
    const r = normalizeJudgeResult({
      checks: { no_deception: { pass: false, reason: 'valse garantie' } } as never,
      overall_score: 7, recommendation: 'PASS', block_reason: null,
    }, 'U krijgt hem gegarandeerd.');
    expect(r.recommendation).toBe('WARN');
  });

  it('clamps the score and defaults bad recommendations', () => {
    const r = normalizeJudgeResult({ checks: {} as never, overall_score: 42, recommendation: 'xx' as never }, 'Hoi.');
    expect(r.overall_score).toBe(10);
    expect(r.recommendation).toBe('PASS');
  });

  it('fallback contains all 10 checks', () => {
    expect(Object.keys(fallbackJudgeResult().checks)).toHaveLength(10);
  });
});
