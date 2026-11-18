// Subsidie- en toelagenscanner — bepaalt op basis van de credentials in de wallet
// voor welke regelingen de gebruiker (indicatief) in aanmerking komt.

export type SubsidyScanType = 'alles' | 'studie' | 'gezondheid' | 'wonen' | 'gezin' | 'werk';
export type SubsidyCategory = Exclude<SubsidyScanType, 'alles'>;
export type SubsidyStatus = 'in aanmerking' | 'mogelijk' | 'al ontvangen' | 'niet in aanmerking';

export const SUBSIDY_SCAN_TYPES: Array<{ id: SubsidyScanType; label: string; description: string }> = [
  { id: 'alles',      label: 'Alles scan',         description: 'Alle regelingen in één keer' },
  { id: 'studie',     label: 'Studie scan',        description: 'Studiefinanciering, collegegeld en studietoeslagen' },
  { id: 'gezondheid', label: 'Gezondheidsscan',    description: 'Zorgtoeslag en gemeentelijke zorgregelingen' },
  { id: 'wonen',      label: 'Wonen scan',         description: 'Huurtoeslag, woonlasten en verduurzaming' },
  { id: 'gezin',      label: 'Gezin & kinderen',   description: 'Kinderbijslag, kindgebonden budget en kinderopvang' },
  { id: 'werk',       label: 'Werk & inkomen',     description: 'Heffingskortingen en gemeentelijke inkomensondersteuning' },
];

export interface WalletFacts {
  age?: number;
  isOver18: boolean;
  isEUCitizen: boolean;
  isEnrolled: boolean;
  enrollmentSource?: string;
  hasStudyFinance: boolean;
  hasSupplementaryGrant: boolean;
  hasTravelProduct: boolean;
  hasHealthInsurance: boolean;
  municipality?: string;
  /** Woonadres uit de BRP, zelfde formaat als property.address */
  residenceAddress?: string;
  livesIndependently: boolean;
  children: Array<{ name: string; age: number }>;
  isSingleParent: boolean;
  hasEmploymentIncome: boolean;
  property?: { address: string; municipality: string; ownerName?: string; since?: string; buildYear?: number };
  miningDamage?: { dossier: string; address: string; municipality: string; acknowledged: boolean; decisionDate?: string };
  sustainabilityInvoices: Array<{ measure: string; date: string; address: string; municipality: string; inNameOf?: string; certifiedInstaller: boolean; amount?: number }>;
  priorSustainabilityGrants: string[];
  personName?: string;
}

/** Gemeenten in het aangewezen mijnbouwschadegebied (Groningen-gasveld en Limburgse steenkoolmijnen) — demo-lijst */
export const MINING_DAMAGE_MUNICIPALITIES = [
  'Eemsdelta', 'Het Hogeland', 'Midden-Groningen', 'Groningen', 'Oldambt', 'Westerkwartier', 'Veendam', 'Pekela',
  'Tynaarlo', 'Aa en Hunze', 'Assen', 'Noordenveld',
  'Heerlen', 'Kerkrade', 'Landgraaf', 'Brunssum', 'Simpelveld', 'Voerendaal',
];
export const SUSTAINABILITY_MEASURES = ['Zonnepanelen', 'Isolatie', 'Warmtepomp', 'Zonneboiler', 'HR++-glas'];

export interface SubsidyRuleCheck {
  label: string;
  met: boolean;
  evidence: string;
  required: boolean;
}

export interface SubsidyResult {
  id: string;
  name: string;
  provider: string;
  category: SubsidyCategory;
  status: SubsidyStatus;
  reason: string;
  basedOn: string[];
  rules?: SubsidyRuleCheck[];
}

export interface SubsidyScanReport {
  type: SubsidyScanType;
  scannedAt: string;
  checked: number;
  results: SubsidyResult[];
  counts: Record<SubsidyStatus, number>;
}

interface ScanInputCredential {
  type: string[];
  validUntil?: string;
  raw: Record<string, unknown>;
}

const yearsBetween = (from: Date, to: Date) => {
  let y = to.getFullYear() - from.getFullYear();
  const m = to.getMonth() - from.getMonth();
  if (m < 0 || (m === 0 && to.getDate() < from.getDate())) y--;
  return y;
};

/** Leidt feiten af uit de credentials. Verlopen of ingetrokken credentials tellen niet mee. */
export function deriveWalletFacts(credentials: ScanInputCredential[], now = new Date()): WalletFacts {
  const active = credentials.filter(c => {
    const status = (c.raw.credentialStatus as { status?: string } | undefined)?.status;
    return status !== 'revoked' && (!c.validUntil || new Date(c.validUntil) >= now);
  });
  const subj = (type: string) => active.find(c => c.type.includes(type))?.raw.credentialSubject as Record<string, unknown> | undefined;

  const birth = subj('BirthCertificateCredential');
  const age = typeof birth?.dateOfBirth === 'string' ? yearsBetween(new Date(birth.dateOfBirth), now) : undefined;
  const enrollment = subj('UniversityEnrollmentCredential');
  const studyFinance = subj('StudyFinanceCredential');
  const address = subj('ResidenceAddressCredential');
  const parental = subj('ParentalAuthorityCredential');
  const propertySubj = subj('PropertyOwnershipCredential');
  const damageSubj = subj('MiningDamageReportCredential');
  type Obj = { adres?: string; postcode?: string; plaats?: string; gemeente?: string; kadastraalPerceel?: string; bouwjaar?: number };
  const addr = (o?: Obj) => o ? [o.adres, o.postcode, o.plaats].filter(Boolean).join(', ') : '';
  const propObj = propertySubj?.object as Obj | undefined;
  const damageObj = damageSubj?.object as Obj | undefined;
  const owner = propertySubj?.eigenaar as { naam?: string } | undefined;

  const children: WalletFacts['children'] = [];
  const kind = parental?.kind as { naam?: string; geboortedatum?: string } | undefined;
  if (kind?.geboortedatum) {
    const childAge = yearsBetween(new Date(kind.geboortedatum), now);
    if (childAge < 18) children.push({ name: kind.naam ?? 'Kind', age: childAge });
  }

  return {
    age,
    isOver18: birth?.isOver18 === true,
    isEUCitizen: subj('EUCitizenshipCredential')?.isEUCitizen === true,
    isEnrolled: enrollment?.isEnrolledAtUniversity === true || studyFinance?.hasStudyFinance === true,
    enrollmentSource: enrollment?.isEnrolledAtUniversity === true ? 'Inschrijving onderwijs' : studyFinance ? 'Studiefinanciering (DUO)' : undefined,
    hasStudyFinance: studyFinance?.hasStudyFinance === true,
    hasSupplementaryGrant: studyFinance?.aanvullendeBeurs === true,
    hasTravelProduct: typeof studyFinance?.reisproduct === 'string',
    hasHealthInsurance: subj('HealthInsuranceCredential')?.hasValidInsurance === true,
    municipality: typeof address?.municipality === 'string' ? address.municipality : undefined,
    residenceAddress: typeof address?.adres === 'string'
      ? [address.adres, address.postcode, address.woonplaats].filter(Boolean).join(', ')
      : undefined,
    livesIndependently: address?.isRegisteredResident === true,
    children,
    isSingleParent: parental?.gezagsvorm === 'Eenhoofdig gezag',
    hasEmploymentIncome: active.some(c => c.type.includes('EmploymentCredential')),
    property: propertySubj?.isOwner === true && propObj?.gemeente
      ? { address: addr(propObj), municipality: propObj.gemeente, ownerName: owner?.naam, since: propertySubj.verkregenOp as string | undefined, buildYear: propObj.bouwjaar }
      : undefined,
    miningDamage: damageSubj && damageObj?.gemeente
      ? { dossier: String(damageSubj.dossiernummer ?? ''), address: addr(damageObj), municipality: damageObj.gemeente,
          acknowledged: damageSubj.damageAcknowledged === true, decisionDate: damageSubj.besluitdatum as string | undefined }
      : undefined,
    sustainabilityInvoices: active
      .filter(c => c.type.includes('SustainabilityInvoiceCredential'))
      .map(c => {
        const sj = c.raw.credentialSubject as Record<string, unknown>;
        const ia = sj.installatieadres as Obj | undefined;
        return {
          measure: String(sj.maatregel ?? ''),
          date: String(sj.factuurdatum ?? ''),
          address: addr(ia),
          municipality: ia?.gemeente ?? '',
          inNameOf: sj.opNaamVan as string | undefined,
          certifiedInstaller: sj.installateurErkend === true,
          amount: typeof sj.bedragInclBtw === 'number' ? sj.bedragInclBtw : undefined,
        };
      }),
    priorSustainabilityGrants: active
      .filter(c => c.type.includes('SustainabilityGrantCredential'))
      .map(c => String((c.raw.credentialSubject as Record<string, unknown>).maatregel ?? '')),
    personName: owner?.naam,
  };
}

interface SubsidyDef {
  id: string;
  name: string;
  provider: string;
  category: SubsidyCategory;
  check: (f: WalletFacts, now: Date) => { status: SubsidyStatus; reason: string; basedOn: string[]; rules?: SubsidyRuleCheck[] };
}

const SUBSIDIES: SubsidyDef[] = [
  // ─── Studie ───
  { id: 'basisbeurs', name: 'Basisbeurs studiefinanciering', provider: 'DUO', category: 'studie',
    check: f => f.hasStudyFinance
      ? { status: 'al ontvangen', reason: 'U ontvangt al een basisbeurs (uitwonend) volgens uw Studiefinanciering-credential.', basedOn: ['Studiefinanciering'] }
      : f.isEnrolled && f.isEUCitizen && f.isOver18
        ? { status: 'in aanmerking', reason: 'U bent 18+, EU-burger en ingeschreven bij een hogeschool of universiteit.', basedOn: ['Geboorteakte', 'EU-burgerschap', 'Inschrijving onderwijs'] }
        : { status: 'niet in aanmerking', reason: 'Er is geen geldige inschrijving bij een hbo- of wo-opleiding gevonden.', basedOn: [] } },
  { id: 'eenoudertoeslag', name: 'Eenoudertoeslag (studiefinanciering)', provider: 'DUO', category: 'studie',
    check: f => f.hasStudyFinance && f.isSingleParent && f.children.length > 0
      ? { status: 'in aanmerking', reason: `U studeert met studiefinanciering en heeft alleen het gezag over ${f.children[0].name}. Studerende alleenstaande ouders kunnen een extra toeslag van DUO krijgen.`, basedOn: ['Studiefinanciering', 'Ouderlijk gezag'] }
      : { status: 'niet in aanmerking', reason: 'Alleen voor studerende alleenstaande ouders met studiefinanciering.', basedOn: [] } },
  { id: 'collegegeldkrediet', name: 'Collegegeldkrediet', provider: 'DUO', category: 'studie',
    check: f => f.isEnrolled && f.isEUCitizen
      ? { status: 'in aanmerking', reason: 'U bent ingeschreven bij een hbo- of wo-opleiding en kunt uw collegegeld lenen bij DUO.', basedOn: [f.enrollmentSource ?? 'Inschrijving onderwijs', 'EU-burgerschap'] }
      : { status: 'niet in aanmerking', reason: 'Vereist een inschrijving bij een hbo- of wo-opleiding.', basedOn: [] } },
  { id: 'aanvullende-beurs', name: 'Aanvullende beurs', provider: 'DUO', category: 'studie',
    check: f => f.hasSupplementaryGrant
      ? { status: 'al ontvangen', reason: 'U ontvangt al een aanvullende beurs.', basedOn: ['Studiefinanciering'] }
      : f.hasStudyFinance
        ? { status: 'niet in aanmerking', reason: 'Afgewezen bij uw aanvraag studiefinanciering: het inkomen van uw ouders ligt boven de grens.', basedOn: ['Studiefinanciering'] }
        : { status: 'mogelijk', reason: 'Hangt af van het inkomen van uw ouders.', basedOn: [] } },

  // ─── Gezondheid ───
  { id: 'zorgtoeslag', name: 'Zorgtoeslag', provider: 'Dienst Toeslagen', category: 'gezondheid',
    check: f => f.isOver18 && f.hasHealthInsurance
      ? { status: 'in aanmerking', reason: 'U bent 18+ en heeft een Nederlandse basisverzekering. Als student ligt uw inkomen waarschijnlijk onder de grens voor zorgtoeslag.', basedOn: ['Geboorteakte', 'Zorgverzekeringspas'] }
      : { status: 'niet in aanmerking', reason: 'Vereist 18+ en een geldige Nederlandse zorgverzekering.', basedOn: [] } },
  { id: 'gemeentepolis', name: 'Gemeentelijke zorgverzekering', provider: 'Gemeente', category: 'gezondheid',
    check: f => f.municipality && f.hasHealthInsurance
      ? { status: 'mogelijk', reason: `De gemeente ${f.municipality} biedt een collectieve zorgverzekering met korting voor inwoners met een laag inkomen. Of u in aanmerking komt hangt af van uw inkomen.`, basedOn: ['Woonadres (BRP)', 'Zorgverzekeringspas'] }
      : { status: 'niet in aanmerking', reason: 'Vereist inschrijving in een gemeente en een zorgverzekering.', basedOn: [] } },

  // ─── Wonen ───
  { id: 'huurtoeslag', name: 'Huurtoeslag', provider: 'Dienst Toeslagen', category: 'wonen',
    check: f => f.property && f.residenceAddress === f.property.address
      ? { status: 'niet in aanmerking', reason: `U woont in uw eigen koopwoning aan de ${f.property.address}. Huurtoeslag is alleen voor huurders.`, basedOn: ['Eigendomsbewijs (Kadaster)', 'Woonadres (BRP)'] }
      : f.isOver18 && f.livesIndependently
      ? { status: f.children.length > 0 ? 'in aanmerking' : 'mogelijk',
          reason: f.children.length > 0
            ? `U woont zelfstandig in ${f.municipality} met een minderjarig kind. Huurtoeslag hangt af van huur en inkomen; met een studentinkomen komt u waarschijnlijk in aanmerking.`
            : `U woont zelfstandig in ${f.municipality}. Huurtoeslag hangt af van uw huur, inkomen en woning (zelfstandige woonruimte).`,
          basedOn: ['Geboorteakte', 'Woonadres (BRP)'] }
      : { status: 'niet in aanmerking', reason: 'Vereist 18+ en een eigen adres in de BRP.', basedOn: [] } },
  { id: 'kwijtschelding', name: 'Kwijtschelding gemeentelijke belastingen', provider: 'Gemeente', category: 'wonen',
    check: f => f.municipality && f.livesIndependently
      ? { status: 'mogelijk', reason: `Bij een laag inkomen kan de gemeente ${f.municipality} afvalstoffenheffing en andere lokale belastingen kwijtschelden.`, basedOn: ['Woonadres (BRP)'] }
      : { status: 'niet in aanmerking', reason: 'Vereist een eigen adres in een gemeente.', basedOn: [] } },

  { id: 'verduurzaming-mijnbouwschade', name: 'Verduurzamingssubsidie mijnbouwschadegebied', provider: 'Instituut Mijnbouwschade Groningen', category: 'wonen',
    check: (f, now) => {
      const inArea = (m?: string) => !!m && MINING_DAMAGE_MUNICIPALITIES.includes(m);
      const p = f.property;
      const d = f.miningDamage;
      const monthsAgo = (iso: string) => (now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      const invoice = f.sustainabilityInvoices.find(i => SUSTAINABILITY_MEASURES.includes(i.measure) && (!p || i.address === p.address));
      const anyInvoice = invoice ?? f.sustainabilityInvoices[0];
      const areaMunicipality = p?.municipality ?? d?.municipality;

      const rules: SubsidyRuleCheck[] = [
        { label: 'Woning ligt in aangewezen mijnbouwschadegebied', required: true,
          met: inArea(areaMunicipality),
          evidence: areaMunicipality ? `${p?.address ?? d?.address} — gemeente ${areaMunicipality}${inArea(areaMunicipality) ? ' valt in het gebied' : ' valt buiten het gebied'}` : 'Geen woningadres in het gebied gevonden' },
        { label: 'U bent eigenaar van de woning (Kadaster)', required: true,
          met: !!p,
          evidence: p ? `Eigendomsbewijs Kadaster, eigenaar sinds ${p.since ? new Date(p.since).toLocaleDateString('nl-NL') : 'onbekend'}` : 'Geen eigendomsbewijs gevonden' },
        { label: 'U woont zelf in de woning (eigenaar-bewoner)', required: true,
          met: !!p && f.residenceAddress === p.address,
          evidence: f.residenceAddress ? `Ingeschreven op ${f.residenceAddress} (BRP)${p && f.residenceAddress !== p.address ? ' — ander adres dan de woning' : ''}` : 'Geen woonadres met straat en huisnummer gevonden' },
        { label: 'Mijnbouwschade erkend of woning in versterkingsprogramma', required: true,
          met: !!d && d.acknowledged && (!p || d.address === p.address),
          evidence: d ? `Schaderapport ${d.dossier}: ${d.acknowledged ? 'schade erkend' : 'schade niet erkend'}${d.decisionDate ? ` op ${new Date(d.decisionDate).toLocaleDateString('nl-NL')}` : ''}${p && d.address !== p.address ? ' (ander adres dan de woning)' : ''}` : 'Geen schaderapport gevonden' },
        { label: 'Verduurzamingsmaatregel uitgevoerd (factuur)', required: true,
          met: !!invoice,
          evidence: invoice ? `Factuur ${invoice.measure.toLowerCase()} van ${new Date(invoice.date).toLocaleDateString('nl-NL')}${invoice.amount ? `, € ${invoice.amount.toLocaleString('nl-NL')}` : ''}` : anyInvoice ? `Factuur voor "${anyInvoice.measure}" valt niet onder de regeling of is voor een ander adres` : 'Geen factuur voor zonnepanelen, isolatie, warmtepomp e.d. gevonden' },
        { label: 'Factuur op naam van de eigenaar en voor het adres van de woning', required: true,
          met: !!invoice && !!p && invoice.address === p.address && (!invoice.inNameOf || !p.ownerName || invoice.inNameOf === p.ownerName),
          evidence: invoice ? `Op naam van ${invoice.inNameOf ?? 'onbekend'}, installatieadres ${invoice.address}` : '—' },
        { label: 'Uitgevoerd door een erkend installateur', required: true,
          met: !!invoice?.certifiedInstaller,
          evidence: invoice ? (invoice.certifiedInstaller ? 'Installateur is erkend (keurmerk op factuur)' : 'Installateur niet erkend') : '—' },
        { label: 'Factuur niet ouder dan 12 maanden', required: true,
          met: !!invoice && monthsAgo(invoice.date) <= 12,
          evidence: invoice ? `Factuurdatum ${new Date(invoice.date).toLocaleDateString('nl-NL')} (${Math.max(0, Math.floor(monthsAgo(invoice.date)))} maanden geleden)` : '—' },
        { label: 'Niet eerder subsidie ontvangen voor dezelfde maatregel', required: true,
          met: !invoice || !f.priorSustainabilityGrants.includes(invoice.measure),
          evidence: f.priorSustainabilityGrants.length ? `Eerder ontvangen voor: ${f.priorSustainabilityGrants.join(', ')}` : 'Geen eerdere verduurzamingssubsidie gevonden in de wallet' },
      ];

      const unmet = rules.filter(r => r.required && !r.met);
      const basedOn = [p && 'Eigendomsbewijs (Kadaster)', f.residenceAddress && 'Woonadres (BRP)', d && 'Schaderapport mijnbouwschade', invoice && 'Factuur verduurzaming'].filter(Boolean) as string[];

      if (unmet.length === 0) {
        return { status: 'in aanmerking', rules, basedOn,
          reason: `U woont in uw eigen woning aan de ${p!.address}, in het mijnbouwschadegebied (gemeente ${p!.municipality}). De schade is erkend door het IMG en u heeft ${invoice!.measure.toLowerCase()} laten plaatsen door een erkend installateur. U voldoet aan alle ${rules.length} voorwaarden.` };
      }
      if (inArea(areaMunicipality) && p) {
        // Zonder factuur zijn de factuurregels (naam, installateur, datum) nog niet te beoordelen: noem alleen de factuur zelf
        const invoiceDependent = ['Factuur op naam', 'erkend installateur', '12 maanden'];
        const missing = invoice ? unmet : unmet.filter(r => !invoiceDependent.some(k => r.label.includes(k)));
        return { status: 'mogelijk', rules, basedOn,
          reason: `Uw woning ligt in het mijnbouwschadegebied en u bent eigenaar, maar er ontbreekt nog: ${missing.map(r => r.label.toLowerCase()).join('; ')}.` };
      }
      return { status: 'niet in aanmerking', rules, basedOn,
        reason: inArea(areaMunicipality) ? 'Er ontbreken te veel voorwaarden voor deze regeling.' : 'Er is geen woning in eigendom in het aangewezen mijnbouwschadegebied gevonden.' };
    } },

  // ─── Gezin & kinderen ───
  { id: 'kinderbijslag', name: 'Kinderbijslag', provider: 'SVB', category: 'gezin',
    check: f => f.children.length > 0
      ? { status: 'in aanmerking', reason: `U heeft het gezag over ${f.children[0].name} (${f.children[0].age} jaar). Ouders van kinderen onder de 18 hebben recht op kinderbijslag, ongeacht inkomen.`, basedOn: ['Ouderlijk gezag'] }
      : { status: 'niet in aanmerking', reason: 'Geen kind onder de 18 gevonden in uw wallet.', basedOn: [] } },
  { id: 'kindgebonden-budget', name: 'Kindgebonden budget (met alleenstaande-ouderkop)', provider: 'Dienst Toeslagen', category: 'gezin',
    check: f => f.children.length > 0
      ? { status: 'in aanmerking', reason: f.isSingleParent
            ? 'U heeft een kind onder de 18 en bent alleenstaande ouder; dan krijgt u bovenop het kindgebonden budget een extra bedrag.'
            : 'U heeft een kind onder de 18; het kindgebonden budget hangt af van uw inkomen.',
          basedOn: ['Ouderlijk gezag'] }
      : { status: 'niet in aanmerking', reason: 'Geen kind onder de 18 gevonden in uw wallet.', basedOn: [] } },
  { id: 'kinderopvangtoeslag', name: 'Kinderopvangtoeslag', provider: 'Dienst Toeslagen', category: 'gezin',
    check: f => f.children.length > 0 && f.children[0].age < 13 && (f.isEnrolled || f.hasEmploymentIncome)
      ? { status: 'in aanmerking', reason: `${f.children[0].name} is jonger dan 13 en u volgt een opleiding. Studerende ouders horen bij de doelgroep voor kinderopvangtoeslag bij geregistreerde opvang.`, basedOn: ['Ouderlijk gezag', f.enrollmentSource ?? 'Inschrijving onderwijs'] }
      : { status: 'niet in aanmerking', reason: 'Vereist een kind tot 12 jaar en werk of een opleiding.', basedOn: [] } },

  // ─── Werk & inkomen ───
  { id: 'iack', name: 'Inkomensafhankelijke combinatiekorting', provider: 'Belastingdienst', category: 'werk',
    check: f => f.children.length > 0 && f.children[0].age < 12 && f.hasEmploymentIncome
      ? { status: 'in aanmerking', reason: 'U werkt en heeft een kind jonger dan 12.', basedOn: ['Ouderlijk gezag'] }
      : { status: 'niet in aanmerking', reason: f.children.length > 0
            ? 'U heeft een jong kind, maar er is geen arbeidsinkomen gevonden in uw wallet. Deze korting geldt alleen voor werkende ouders.'
            : 'Alleen voor werkende ouders met een kind jonger dan 12.', basedOn: [] } },
  { id: 'bijzondere-bijstand', name: 'Bijzondere bijstand', provider: 'Gemeente', category: 'werk',
    check: f => f.municipality
      ? { status: 'mogelijk', reason: `Voor noodzakelijke, onverwachte kosten die u niet zelf kunt betalen, kunt u bijzondere bijstand aanvragen bij de gemeente ${f.municipality}. Beoordeling is altijd individueel.`, basedOn: ['Woonadres (BRP)'] }
      : { status: 'niet in aanmerking', reason: 'Vereist inschrijving in een gemeente.', basedOn: [] } },
];

const STATUS_ORDER: Record<SubsidyStatus, number> = { 'in aanmerking': 0, 'mogelijk': 1, 'al ontvangen': 2, 'niet in aanmerking': 3 };

export function runSubsidyScan(type: SubsidyScanType, facts: WalletFacts, now = new Date()): SubsidyScanReport {
  const defs = SUBSIDIES.filter(s => type === 'alles' || s.category === type);
  const results = defs
    .map(d => {
      const r = d.check(facts, now);
      const provider = d.provider === 'Gemeente' && facts.municipality ? `Gemeente ${facts.municipality}` : d.provider;
      return { id: d.id, name: d.name, provider, category: d.category, ...r };
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  return {
    type,
    scannedAt: now.toISOString(),
    checked: defs.length,
    results,
    counts: {
      'in aanmerking': results.filter(r => r.status === 'in aanmerking').length,
      'mogelijk': results.filter(r => r.status === 'mogelijk').length,
      'al ontvangen': results.filter(r => r.status === 'al ontvangen').length,
      'niet in aanmerking': results.filter(r => r.status === 'niet in aanmerking').length,
    },
  };
}
