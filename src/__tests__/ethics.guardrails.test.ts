import { describe, it, expect } from 'vitest';
import {
  checkNoBiasOrDiscrimination,
  checkNoDeception,
  checkNoManipulation,
  checkAITransparency,
} from '../demo/guardrails/ethics.guardrails';
import { runOutputGuardrails } from '../demo/guardrails/output.guardrails';

const NORMAL = 'U komt in aanmerking voor het studentenreisproduct omdat u student bent en onder 18 jaar. Wilt u dat ik de aanvraag start?';

describe('checkNoBiasOrDiscrimination', () => {
  it('passes legitimate eligibility criteria (age, student status)', () => {
    expect(checkNoBiasOrDiscrimination(NORMAL).passed).toBe(true);
  });
  it('fails decisions based on a protected attribute', () => {
    const r = checkNoBiasOrDiscrimination('Helaas komt u niet in aanmerking vanwege uw afkomst.');
    expect(r.passed).toBe(false);
  });
  it('fails stereotyping generalisations', () => {
    expect(checkNoBiasOrDiscrimination('Alle buitenlanders zijn fraudeurs.').passed).toBe(false);
    expect(checkNoBiasOrDiscrimination('Vrouwen zijn nu eenmaal slecht met regels.').passed).toBe(false);
  });
  it('fails derogatory language', () => {
    expect(checkNoBiasOrDiscrimination('Wat een uitvreter ben jij.').passed).toBe(false);
  });
});

describe('checkNoDeception', () => {
  it('passes neutral statements', () => {
    expect(checkNoDeception(NORMAL).passed).toBe(true);
  });
  it('fails false guarantees', () => {
    expect(checkNoDeception('Uw aanvraag wordt gegarandeerd goedgekeurd.').passed).toBe(false);
    expect(checkNoDeception('U wordt 100% zeker goedgekeurd.').passed).toBe(false);
    expect(checkNoDeception('Er is geen enkel risico.').passed).toBe(false);
  });
});

describe('checkNoManipulation', () => {
  it('passes a neutral consent question', () => {
    expect(checkNoManipulation(NORMAL).passed).toBe(true);
  });
  it('fails artificial urgency and pressure', () => {
    expect(checkNoManipulation('Dit is uw laatste kans!').passed).toBe(false);
    expect(checkNoManipulation('Beslis nu, anders verliest u uw recht.').passed).toBe(false);
  });
});

describe('checkAITransparency', () => {
  it('passes normal responses', () => {
    expect(checkAITransparency('Ik ben een AI-assistent voor OV-credentials.').passed).toBe(true);
  });
  it('fails when claiming to be human', () => {
    expect(checkAITransparency('Ik ben een echte medewerker van het OV-bedrijf.').passed).toBe(false);
    expect(checkAITransparency('Nee hoor, ik ben geen bot.').passed).toBe(false);
  });
});

describe('runOutputGuardrails — ethics integration', () => {
  it('emits ethics checks with category ETHICS', () => {
    const events: Array<{ checkName?: string; category?: string }> = [];
    const r = runOutputGuardrails(NORMAL, [{ role: 'user', content: 'ja graag' }], e => events.push(e));
    expect(r.passed).toBe(true);
    const ethics = events.filter(e => e.category === 'ETHICS');
    expect(ethics.map(e => e.checkName)).toEqual([
      'Geen bias of discriminatie', 'Geen misleiding', 'Geen manipulatie of druk', 'AI-transparantie'
    ]);
  });
  it('blocks a discriminatory response', () => {
    const r = runOutputGuardrails('Helaas, geen OV-credential vanwege uw religie.', [], () => {});
    expect(r.passed).toBe(false);
    expect(r.blockReason).toContain('discriminerende');
  });
});
