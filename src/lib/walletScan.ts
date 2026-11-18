// Credential scan — analyseert de wallet op verlopen credentials, onnodige toegang e.d.

export type ScanSeverity = 'hoog' | 'middel' | 'laag';

export interface ScanFinding {
  severity: ScanSeverity;
  category: 'Verlopen' | 'Ingetrokken' | 'Verloopt binnenkort' | 'Onnodige toegang' | 'Gevoelige gegevens' | 'Openstaande verzoeken' | 'Opschonen';
  title: string;
  detail: string;
}

export interface ScanReport {
  scannedAt: string;
  credentialsScanned: number;
  findings: ScanFinding[];
  counts: Record<ScanSeverity, number>;
}

export interface ScanCredential {
  id: string;
  type: string[];
  label: string;
  validUntil?: string;
  folders?: string[];
  revoked?: boolean;
}

export interface ScanPermissions {
  parties: Array<{ id: string; label: string }>;
  folders: Array<{ id: string; label: string }>;
  permissions: Record<string, Record<string, boolean>>;
  grants?: Array<{ partyId: string; partyName: string; credentialId: string; credentialLabel: string; folderId: string }>;
  notifications?: Array<{ id: string; title: string }>;
}

const DAY = 24 * 60 * 60 * 1000;
const SENSITIVE_FOLDERS = ['medisch', 'juridisch'];
const NON_SENSITIVE_PARTIES_FOR_SENSITIVE = ['werkgever', 'commercieel', 'belastingdienst'];

const fmt = (iso: string) => new Date(iso).toLocaleDateString('nl-NL');

export function runWalletScan(
  credentials: ScanCredential[],
  perms: ScanPermissions | null,
  options: { now?: Date; displayTotal?: number; archivedDisplayCount?: number } = {}
): ScanReport {
  const now = options.now ?? new Date();
  const findings: ScanFinding[] = [];
  const byId = new Map(credentials.map(c => [c.id, c]));
  const isArchived = (c: ScanCredential) => c.folders?.includes('archief') ?? false;

  // 1. Geldigheid
  for (const c of credentials) {
    if (c.revoked) {
      if (!isArchived(c)) {
        findings.push({ severity: 'middel', category: 'Ingetrokken', title: `${c.label} is ingetrokken`,
          detail: 'Deze credential is ingetrokken door de uitgever maar staat nog niet in het archief.' });
      }
      continue;
    }
    if (!c.validUntil) continue;
    const until = new Date(c.validUntil);
    const daysLeft = Math.ceil((until.getTime() - now.getTime()) / DAY);
    if (daysLeft < 0) {
      findings.push(isArchived(c)
        ? { severity: 'laag', category: 'Verlopen', title: `${c.label} is verlopen (archief)`,
            detail: `Verlopen op ${fmt(c.validUntil)}. Staat al in het archief.` }
        : { severity: 'hoog', category: 'Verlopen', title: `${c.label} is verlopen`,
            detail: `Verlopen op ${fmt(c.validUntil)}, maar wordt nog als actieve credential gebruikt. Vraag een nieuwe aan bij de uitgever.` });
    } else if (daysLeft <= 90) {
      findings.push({ severity: 'middel', category: 'Verloopt binnenkort', title: `${c.label} verloopt over ${daysLeft} dagen`,
        detail: `Geldig tot ${fmt(c.validUntil)}. Vernieuw deze credential op tijd.` });
    }
  }

  if (perms) {
    const partyLabel = (id: string) => perms.parties.find(p => p.id === id)?.label ?? id;
    const folderLabel = (id: string) => perms.folders.find(f => f.id === id)?.label ?? id;

    // 2. Map-permissies
    for (const [folderId, parties] of Object.entries(perms.permissions)) {
      for (const [partyId, allowed] of Object.entries(parties)) {
        if (!allowed) continue;
        if (folderId === 'archief') {
          findings.push({ severity: 'middel', category: 'Onnodige toegang', title: `${partyLabel(partyId)} heeft toegang tot het archief`,
            detail: 'Archief-credentials zijn verlopen of ingetrokken; toegang hiertoe is zelden nodig.' });
        } else if (partyId === 'commercieel') {
          findings.push({ severity: 'hoog', category: 'Onnodige toegang', title: `Commercieel bedrijf heeft toegang tot ${folderLabel(folderId)}`,
            detail: 'Commerciële partijen hebben geen wettelijke grondslag voor structurele toegang. Overweeg in te trekken.' });
        } else if (SENSITIVE_FOLDERS.includes(folderId) && NON_SENSITIVE_PARTIES_FOR_SENSITIVE.includes(partyId)) {
          findings.push({ severity: 'hoog', category: 'Gevoelige gegevens', title: `${partyLabel(partyId)} heeft toegang tot ${folderLabel(folderId)}`,
            detail: 'Deze map bevat bijzondere persoonsgegevens. Deze partij heeft hier normaal geen toegang toe nodig.' });
        }
      }
    }

    // 3. Toegang tot individuele credentials
    for (const g of perms.grants ?? []) {
      const cred = byId.get(g.credentialId);
      const expiredOrRevoked = cred && (cred.revoked || (cred.validUntil && new Date(cred.validUntil) < now));
      if (g.folderId === 'archief' || expiredOrRevoked) {
        findings.push({ severity: g.partyId === 'commercieel' ? 'hoog' : 'middel', category: 'Onnodige toegang',
          title: `${g.partyName} heeft nog toegang tot "${g.credentialLabel}"`,
          detail: 'Deze credential is verlopen of gearchiveerd. Trek de toegang in of geef toegang tot de actuele versie.' });
      } else if (g.partyId === 'commercieel') {
        findings.push({ severity: 'laag', category: 'Onnodige toegang', title: `${g.partyName} heeft toegang tot "${g.credentialLabel}"`,
          detail: 'Controleer of deze commerciële partij deze toegang nog nodig heeft.' });
      }
    }

    // 4. Openstaande verzoeken
    for (const n of perms.notifications ?? []) {
      findings.push({ severity: 'laag', category: 'Openstaande verzoeken', title: n.title,
        detail: 'Handel dit verzoek af via Permissies.' });
    }
  }

  // 5. Archiefgrootte
  if (options.archivedDisplayCount && options.archivedDisplayCount > 500) {
    findings.push({ severity: 'laag', category: 'Opschonen',
      title: `${options.archivedDisplayCount.toLocaleString('nl-NL')} credentials in het archief`,
      detail: 'Overweeg oude credentials die u niet meer nodig heeft definitief te verwijderen.' });
  }

  const order: Record<ScanSeverity, number> = { hoog: 0, middel: 1, laag: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    scannedAt: now.toISOString(),
    credentialsScanned: options.displayTotal ?? credentials.length,
    findings,
    counts: {
      hoog: findings.filter(f => f.severity === 'hoog').length,
      middel: findings.filter(f => f.severity === 'middel').length,
      laag: findings.filter(f => f.severity === 'laag').length,
    },
  };
}
