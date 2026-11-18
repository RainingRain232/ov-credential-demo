import { describe, it, expect } from 'vitest';
import {
  checkSingleQuestion,
  checkResponseLength,
  checkNoPIILeak,
  checkTopicAdherence,
  checkConsentGate,
} from '../demo/guardrails/output.guardrails';

describe('checkSingleQuestion', () => {
  it('passes text with no question marks', () => {
    const result = checkSingleQuestion('This is a statement.');
    expect(result.passed).toBe(true);
  });

  it('passes text with exactly one question mark', () => {
    const result = checkSingleQuestion('Would you like to proceed?');
    expect(result.passed).toBe(true);
  });

  it('fails text with two or more question marks', () => {
    const result = checkSingleQuestion('Are you sure? Do you agree?');
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('2');
  });
});

describe('checkResponseLength', () => {
  it('passes text with 200 words or fewer', () => {
    const text = Array(200).fill('word').join(' ');
    const result = checkResponseLength(text);
    expect(result.passed).toBe(true);
    expect(result.wordCount).toBe(200);
  });

  it('fails text with more than 200 words', () => {
    const text = Array(201).fill('word').join(' ');
    const result = checkResponseLength(text);
    expect(result.passed).toBe(false);
    expect(result.wordCount).toBe(201);
    expect(result.reason).toContain('201');
  });
});

describe('checkNoPIILeak', () => {
  it('detects a BSN in output', () => {
    const result = checkNoPIILeak('Your BSN is 123456789.');
    expect(result.passed).toBe(false);
  });

  it('detects an email in output', () => {
    const result = checkNoPIILeak('Contact user@example.com for details.');
    expect(result.passed).toBe(false);
  });

  it('passes clean output text', () => {
    const result = checkNoPIILeak('You are eligible for the credential.');
    expect(result.passed).toBe(true);
  });
});

describe('checkTopicAdherence', () => {
  it('passes text containing a topic keyword like "credential"', () => {
    const result = checkTopicAdherence('Your credential has been issued.');
    expect(result.passed).toBe(true);
  });

  it('passes text containing "transport"', () => {
    const result = checkTopicAdherence('Public transport rules apply here.');
    expect(result.passed).toBe(true);
  });

  it('fails text without any topic keywords', () => {
    const result = checkTopicAdherence('The sky is blue and birds are singing.');
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('OV-credentials');
  });
});

describe('checkConsentGate', () => {
  it('passes when the response contains no action phrases', () => {
    const result = checkConsentGate('Here are the rules for the credential.', []);
    expect(result.passed).toBe(true);
  });

  it('fails when action phrase present but no user consent in history', () => {
    const result = checkConsentGate('Ik ben nu bezig met credential aanvragen voor u.', [
      { role: 'assistant', content: 'Wilt u dat ik de aanvraag indien?' },
      { role: 'user', content: 'Ik twijfel nog' },
    ]);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('toestemming');
  });

  it('passes when action phrase present and user gave consent', () => {
    const result = checkConsentGate('I am now aanvragen voor your credential.', [
      { role: 'assistant', content: 'Would you like me to apply?' },
      { role: 'user', content: 'yes please go ahead' },
    ]);
    expect(result.passed).toBe(true);
  });
});
