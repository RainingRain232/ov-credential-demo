import { describe, it, expect } from 'vitest';
import { runWalletScan, ScanCredential, ScanPermissions } from '../lib/walletScan';

const now = new Date('2026-11-16T12:00:00Z');
const creds: ScanCredential[] = [
  { id: 'enr', type: ['VerifiableCredential', 'UniversityEnrollmentCredential'], label: 'Inschrijving onderwijs', validUntil: '2026-08-31T00:00:00Z', folders: ['opleiding'] },
  { id: 'ins', type: ['VerifiableCredential', 'HealthInsuranceCredential'], label: 'Zorgverzekeringspas', validUntil: '2026-12-31T23:59:59Z', folders: ['medisch'] },
  { id: 'old', type: ['VerifiableCredential', 'ResidenceAddressCredential'], label: 'Woonadres', validUntil: '2027-08-01T00:00:00Z', folders: ['archief'], revoked: true },
  { id: 'ok',  type: ['VerifiableCredential', 'DriversLicenseCredential'], label: 'Rijbewijs', validUntil: '2033-05-10T00:00:00Z', folders: ['veelgebruikt'] },
];
const perms: ScanPermissions = {
  parties: [{ id: 'werkgever', label: 'Werkgever' }, { id: 'commercieel', label: 'Commercieel bedrijf' }],
  folders: [{ id: 'medisch', label: 'Medische credentials' }, { id: 'archief', label: 'Archief' }],
  permissions: { medisch: { werkgever: true, commercieel: false }, archief: { werkgever: false, commercieel: false } },
  grants: [{ partyId: 'commercieel', partyName: 'Zippo', credentialId: 'old', credentialLabel: 'Oud adres', folderId: 'archief' }],
  notifications: [{ id: 'n1', title: 'DUO vraagt toegang' }],
};

describe('runWalletScan', () => {
  const r = runWalletScan(creds, perms, { now, displayTotal: 1890, archivedDisplayCount: 1886 });
  const titles = r.findings.map(f => f.title);

  it('flags an active expired credential as high risk', () => {
    expect(r.findings.find(f => f.title === 'Inschrijving onderwijs is verlopen')?.severity).toBe('hoog');
  });
  it('flags credentials expiring within 90 days', () => {
    expect(titles.some(t => t.startsWith('Zorgverzekeringspas verloopt over'))).toBe(true);
  });
  it('flags Zippo access to an archived credential', () => {
    expect(r.findings.find(f => f.title.includes('Zippo'))?.severity).toBe('hoog');
  });
  it('flags employer access to medical data', () => {
    expect(r.findings.some(f => f.category === 'Gevoelige gegevens' && f.title.includes('Werkgever'))).toBe(true);
  });
  it('includes open requests and archive cleanup, and sorts by severity', () => {
    expect(titles).toContain('DUO vraagt toegang');
    expect(r.findings.some(f => f.category === 'Opschonen')).toBe(true);
    const sev = r.findings.map(f => f.severity);
    expect(sev.indexOf('laag')).toBeGreaterThan(sev.lastIndexOf('hoog'));
    expect(r.credentialsScanned).toBe(1890);
  });
  it('does not flag a valid credential', () => {
    expect(titles.some(t => t.includes('Rijbewijs'))).toBe(false);
  });
});
