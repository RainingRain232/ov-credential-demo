import { describe, it, expect } from 'vitest';
import { deriveWalletFacts, runSubsidyScan, SUBSIDY_SCAN_TYPES } from '../lib/subsidyScan';

const now = new Date('2026-11-16T12:00:00Z');
const cred = (type: string, subject: Record<string, unknown>, validUntil = '2030-01-01T00:00:00Z', extra: Record<string, unknown> = {}) =>
  ({ type: ['VerifiableCredential', type], validUntil, raw: { credentialSubject: subject, ...extra } });

const wallet = [
  cred('BirthCertificateCredential', { dateOfBirth: '2004-03-15', isOver18: true }),
  cred('EUCitizenshipCredential', { isEUCitizen: true }),
  cred('UniversityEnrollmentCredential', { isEnrolledAtUniversity: true }, '2026-08-31T00:00:00Z'), // verlopen
  cred('StudyFinanceCredential', { hasStudyFinance: true, aanvullendeBeurs: false, reisproduct: 'week' }, '2027-08-31T00:00:00Z'),
  cred('HealthInsuranceCredential', { hasValidInsurance: true }, '2026-12-31T23:59:59Z'),
  cred('ResidenceAddressCredential', { municipality: 'Eemsdelta', woonplaats: 'Loppersum', adres: 'Kerkstraat 8', postcode: '9919 AA', isRegisteredResident: true }),
  cred('ResidenceAddressCredential', { municipality: 'Delft', isRegisteredResident: false }, '2027-08-01T00:00:00Z', { credentialStatus: { status: 'revoked' } }),
  cred('ParentalAuthorityCredential', { gezagsvorm: 'Eenhoofdig gezag', kind: { naam: 'Noah de Vries', geboortedatum: '2023-04-02' } }),
];

describe('deriveWalletFacts', () => {
  const f = deriveWalletFacts(wallet, now);
  it('derives age, child and single parenthood', () => {
    expect(f.age).toBe(22);
    expect(f.children).toEqual([{ name: 'Noah de Vries', age: 3 }]);
    expect(f.isSingleParent).toBe(true);
  });
  it('ignores revoked credentials and uses study finance as enrollment proof', () => {
    expect(f.municipality).toBe('Eemsdelta');
    expect(f.residenceAddress).toBe('Kerkstraat 8, 9919 AA, Loppersum');
    expect(f.isEnrolled).toBe(true);
    expect(f.enrollmentSource).toBe('Studiefinanciering (DUO)');
  });
});

describe('runSubsidyScan', () => {
  const f = deriveWalletFacts(wallet, now);
  const status = (type: Parameters<typeof runSubsidyScan>[0], id: string) =>
    runSubsidyScan(type, f, now).results.find(r => r.id === id)?.status;

  it('offers six scan types', () => {
    expect(SUBSIDY_SCAN_TYPES.map(t => t.id)).toEqual(['alles', 'studie', 'gezondheid', 'wonen', 'gezin', 'werk']);
  });
  it('studie: basisbeurs already received, eenoudertoeslag eligible, aanvullende beurs not', () => {
    expect(status('studie', 'basisbeurs')).toBe('al ontvangen');
    expect(status('studie', 'eenoudertoeslag')).toBe('in aanmerking');
    expect(status('studie', 'aanvullende-beurs')).toBe('niet in aanmerking');
  });
  it('gezin: kinderbijslag and kinderopvangtoeslag eligible', () => {
    expect(status('gezin', 'kinderbijslag')).toBe('in aanmerking');
    expect(status('gezin', 'kinderopvangtoeslag')).toBe('in aanmerking');
  });
  it('werk: no combinatiekorting without employment income', () => {
    expect(status('werk', 'iack')).toBe('niet in aanmerking');
  });
  it('category scans only include that category; alles includes all', () => {
    const wonen = runSubsidyScan('wonen', f, now);
    expect(wonen.results.every(r => r.category === 'wonen')).toBe(true);
    expect(runSubsidyScan('alles', f, now).checked).toBe(14);
  });
  it('sorts eligible results first and uses the municipality as provider', () => {
    const r = runSubsidyScan('alles', f, now).results;
    expect(r[0].status).toBe('in aanmerking');
    expect(r.find(x => x.id === 'kwijtschelding')?.provider).toBe('Gemeente Eemsdelta');
  });
  it('a wallet without credentials yields no eligible results', () => {
    expect(runSubsidyScan('alles', deriveWalletFacts([], now), now).counts['in aanmerking']).toBe(0);
  });
});

describe('live wallet data (if available)', () => {
  it('runs on the real wallet response', async () => {
    const fs = await import('fs');
    if (!fs.existsSync('/tmp/wallet-full.json')) return;
    const data = JSON.parse(fs.readFileSync('/tmp/wallet-full.json', 'utf8'));
    const report = runSubsidyScan('alles', deriveWalletFacts(data.credentials, now), now);
    console.log(report.results.map(r => `${r.status.padEnd(19)} ${r.name}`).join('\n'));
    expect(report.checked).toBe(14);
  });
});

describe('verduurzaming mijnbouwschadegebied', () => {
  const adres = { adres: 'Kerkstraat 8', postcode: '9919 AA', plaats: 'Loppersum', gemeente: 'Eemsdelta' };
  const property = cred('PropertyOwnershipCredential', { isOwner: true, eigenaar: { naam: 'Sanne de Vries' }, object: adres, verkregenOp: '2024-02-10' });
  const residence = cred('ResidenceAddressCredential', { municipality: 'Eemsdelta', woonplaats: 'Loppersum', adres: 'Kerkstraat 8', postcode: '9919 AA', isRegisteredResident: true });
  const damage = cred('MiningDamageReportCredential', { dossiernummer: 'IMG-1', object: adres, damageAcknowledged: true });
  const invoice = (over: Record<string, unknown> = {}) => cred('SustainabilityInvoiceCredential', {
    maatregel: 'Zonnepanelen', factuurdatum: '2026-06-18', opNaamVan: 'Sanne de Vries', installatieadres: adres, installateurErkend: true, ...over });
  const scan = (creds: ReturnType<typeof cred>[]) =>
    runSubsidyScan('wonen', deriveWalletFacts(creds, now), now).results.find(r => r.id === 'verduurzaming-mijnbouwschade')!;

  it('eligible with ownership, damage report and recent invoice in the area', () => {
    const r = scan([residence, property, damage, invoice()]);
    expect(r.status).toBe('in aanmerking');
    expect(r.rules!.every(x => x.met)).toBe(true);
  });
  it('possible when the invoice is missing', () => {
    const r = scan([residence, property, damage]);
    expect(r.status).toBe('mogelijk');
    expect(r.reason).toContain('verduurzamingsmaatregel');
  });
  it('no rent benefit when living in own property', () => {
    const r = runSubsidyScan('wonen', deriveWalletFacts([residence, property], now), now).results.find(x => x.id === 'huurtoeslag')!;
    expect(r.status).toBe('niet in aanmerking');
  });
  it('owner who lives elsewhere is only possible (eigenaar-bewoner)', () => {
    const elders = cred('ResidenceAddressCredential', { municipality: 'Utrecht', woonplaats: 'Utrecht', adres: 'Oudegracht 1', postcode: '3511 AA', isRegisteredResident: true });
    const r = scan([elders, property, damage, invoice()]);
    expect(r.rules!.find(x => x.label.includes('eigenaar-bewoner'))!.met).toBe(false);
    expect(r.status).toBe('mogelijk');
  });
  it('fails the 12-month rule for an old invoice', () => {
    const r = scan([property, damage, invoice({ factuurdatum: '2024-01-10' })]);
    expect(r.rules!.find(x => x.label.includes('12 maanden'))!.met).toBe(false);
    expect(r.status).not.toBe('in aanmerking');
  });
  it('not eligible outside the mining damage area', () => {
    const utrecht = { ...adres, plaats: 'Utrecht', gemeente: 'Utrecht' };
    const r = scan([
      cred('PropertyOwnershipCredential', { isOwner: true, object: utrecht }),
      cred('SustainabilityInvoiceCredential', { maatregel: 'Zonnepanelen', factuurdatum: '2026-06-18', installatieadres: utrecht, installateurErkend: true }),
    ]);
    expect(r.status).toBe('niet in aanmerking');
  });
  it('blocks double subsidy for the same measure', () => {
    const r = scan([property, damage, invoice(), cred('SustainabilityGrantCredential', { maatregel: 'Zonnepanelen' })]);
    expect(r.status).not.toBe('in aanmerking');
  });
});
