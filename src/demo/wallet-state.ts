// Toestand van de wallet in de demo (in het geheugen van de browser; reset bij herladen).
import walletOver18 from './fixtures/service-wallet-over18.json';
import walletUnder18 from './fixtures/service-wallet-under18.json';
import issuedTemplate from './fixtures/issued-credential.json';
import permissionsFixture from './fixtures/permissions.json';
import transparencyFixture from './fixtures/transparency.json';

type Json = Record<string, unknown>;
interface Credential { id: string; receivedAt: string; validFrom: string; validUntil?: string; raw: Json; [k: string]: unknown }

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const walletState = {
  ageProfile: 'over18' as 'over18' | 'under18',
  issued: [] as Credential[],
  permissions: clone(permissionsFixture) as typeof permissionsFixture,
  transparency: clone(transparencyFixture) as typeof transparencyFixture,
};

export function resetWalletState() {
  walletState.ageProfile = 'over18';
  walletState.issued = [];
  walletState.permissions = clone(permissionsFixture);
  walletState.transparency = clone(transparencyFixture);
}

/** Antwoord van GET /credentials/full: uitgegeven credentials bovenaan, daarna de vaste set. */
export function walletPayload() {
  const base = clone(walletState.ageProfile === 'under18' ? walletUnder18 : walletOver18)['/credentials/full'] as { count: number; credentials: unknown[]; folders: unknown[] };
  base.credentials = [...walletState.issued, ...base.credentials];
  base.count = base.credentials.length;
  return { '/credentials/full': base };
}

/** Maakt een nieuw OV-credential aan zoals de vervoerder dat via OID4VCI uitgeeft. */
export function issueCredential(): Credential {
  const now = new Date();
  const until = new Date(now); until.setFullYear(until.getFullYear() + 1);
  const id = `urn:uuid:transport-vc-${crypto.randomUUID()}`;
  const c = clone(issuedTemplate) as unknown as Credential;
  const youth = walletState.ageProfile === 'under18';
  c.id = id;
  c.validFrom = now.toISOString();
  c.validUntil = until.toISOString();
  c.receivedAt = now.toISOString();
  c.raw = { ...c.raw, id, validFrom: c.validFrom, validUntil: c.validUntil,
    credentialSubject: { ...(c.raw.credentialSubject as Json),
      credentialType: youth ? 'YouthPublicTransportCard' : 'StudentPublicTransportCard', issuedAt: c.validFrom } };
  walletState.issued.unshift(c);
  return c;
}

// ── Permissies (zelfde regels als wallet/src/credentials/permissions.ts) ──
type Perms = typeof permissionsFixture;
type Grant = Perms['grants'][number] & { note?: string };

const OLD_ADDRESS = { credentialId: 'urn:uuid:dummy-revoked-address-001', credentialLabel: 'Oud adres (Delft)', folderId: 'archief' };
const NEW_ADDRESS = { credentialId: 'urn:uuid:dummy-address-001', credentialLabel: 'Woonadres (Loppersum)', folderId: 'veelgebruikt' };
const ENROLLMENT  = { credentialId: 'urn:uuid:university-vc-demo-001', credentialLabel: 'Inschrijving onderwijs', folderId: 'opleiding' };

export function setPermission(folderId: string, partyId: string, allowed: boolean): boolean {
  const p = walletState.permissions.permissions as Record<string, Record<string, boolean>>;
  if (!p[folderId] || !(partyId in p[folderId])) return false;
  p[folderId][partyId] = allowed;
  return true;
}

export function resolveNotification(notificationId: string, actionId: string): boolean {
  const st = walletState.permissions;
  const n = st.notifications.find(x => x.id === notificationId);
  if (!n || !n.actions.some(a => a.id === actionId)) return false;
  let grants = st.grants as Grant[];
  if (n.id === 'zippo-old-address') {
    grants = grants.filter(g => !(g.partyName === 'Zippo' && g.credentialId === OLD_ADDRESS.credentialId));
    if (actionId === 'grant-new-address') grants.push({ partyId: 'commercieel', partyName: 'Zippo', ...NEW_ADDRESS });
  }
  if (n.id === 'duo-enrollment-yearly' && actionId === 'allow') {
    grants.push({ partyId: 'duo', partyName: 'DUO', ...ENROLLMENT, note: 'Jaarlijkse controle' });
  }
  st.grants = grants;
  st.notifications = st.notifications.filter(x => x.id !== notificationId);
  return true;
}

export function markTransparencyRead(id: string): boolean {
  const r = walletState.transparency.requests.find(x => x.id === id);
  if (!r) return false;
  r.read = true;
  walletState.transparency.unread = walletState.transparency.requests.filter(x => !x.read).length;
  return true;
}
