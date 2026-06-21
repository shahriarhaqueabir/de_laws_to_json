/**
 * Seed script for German Law Vault
 *
 * Uses @supabase/supabase-js service_role client to insert seed data
 * into remediation_playbooks and document_templates tables.
 *
 * Usage: SUPABASE_SERVICE_ROLE_KEY=<key> node supabase/seed_data.js
 *   or: export SUPABASE_SERVICE_ROLE_KEY=<key> && node supabase/seed_data.js
 *
 * Get the key from: Supabase Dashboard → Project Settings → API → service_role secret
 *
 * CRITICAL: Never hardcode this key. It grants full admin database access.
 */
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl =
  process.env.SUPABASE_URL || "https://zuhhimmdlnsjuwksitpb.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error(
    "FATAL: SUPABASE_SERVICE_ROLE_KEY environment variable is required.",
  );
  console.error("Set it via: export SUPABASE_SERVICE_ROLE_KEY=<your_key>");
  console.error(
    "Get the key from: Supabase Dashboard → Project Settings → API → service_role secret",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ── Remediation Playbooks ──────────────────────────────────────────────
const playbooks = [
  {
    category: "labor",
    issue_type: "wrongful_dismissal",
    steps: [
      {
        step: 1,
        title: "Prüfung der Kündigung",
        description:
          "Check if the termination notice meets formal requirements (written form, signature, delivery). Under § 623 BGB, termination must be in writing.",
        deadline_days: null,
        type: "analysis",
      },
      {
        step: 2,
        title: "Kündigungsschutzklage einreichen",
        description:
          "File a wrongful dismissal claim with the Labor Court (Arbeitsgericht). Must be done within 3 weeks of receiving the notice (§ 4 KSchG).",
        deadline_days: 21,
        type: "legal_action",
        statute: "§ 4 KSchG",
      },
      {
        step: 3,
        title: "Gütetermin abwarten",
        description:
          "Attend the conciliation hearing (Gütetermin) at the Labor Court. The judge will try to mediate a settlement.",
        deadline_days: null,
        type: "hearing",
      },
      {
        step: 4,
        title: "Kammertermin vorbereiten",
        description:
          "If no settlement, prepare for the main hearing (Kammertermin). Gather evidence, witness statements, and legal arguments.",
        deadline_days: null,
        type: "preparation",
      },
      {
        step: 5,
        title: "Urteil oder Vergleich",
        description:
          "Receive the court judgment or negotiate a settlement (Vergleich). Settlement avoids appeal and reduces costs.",
        deadline_days: null,
        type: "outcome",
      },
    ],
  },
  {
    category: "housing",
    issue_type: "rent_reduction",
    steps: [
      {
        step: 1,
        title: "Mangel dokumentieren",
        description:
          "Document the defect thoroughly: photos, videos, witness statements, and expert reports if applicable.",
        deadline_days: null,
        type: "evidence",
      },
      {
        step: 2,
        title: "Vermieter schriftlich informieren",
        description:
          "Notify the landlord in writing about the defect and set a reasonable deadline for repair (§ 536 BGB).",
        deadline_days: null,
        type: "notice",
        statute: "§ 536 BGB",
      },
      {
        step: 3,
        title: "Mietminderung ankündigen",
        description:
          "If the landlord fails to repair within the deadline, announce a rent reduction. The amount depends on the severity of the defect (usually 10-50%).",
        deadline_days: null,
        type: "action",
      },
      {
        step: 4,
        title: "Mietminderung durchführen",
        description:
          "Reduce the monthly rent by the justified amount. Keep the reduced rent in a separate account to prove willingness to pay.",
        deadline_days: null,
        type: "action",
      },
      {
        step: 5,
        title: "Rechtliche Schritte prüfen",
        description:
          "If the landlord disputes the reduction, consider filing a declaratory action (Feststellungsklage) or seeking legal advice.",
        deadline_days: null,
        type: "legal_action",
      },
    ],
  },
  {
    category: "consumer",
    issue_type: "deposit_retention",
    steps: [
      {
        step: 1,
        title: "Kaution einfordern",
        description:
          "Send a formal written request for the deposit return (Kaution) with a 2-week deadline. Under § 812 BGB, the landlord must return the deposit after tenancy ends.",
        deadline_days: 14,
        type: "demand",
        statute: "§ 812 BGB",
      },
      {
        step: 2,
        title: "Abnahmeprotokoll prüfen",
        description:
          "Review the move-out protocol (Abnahmeprotokoll) for any claims of damage. The landlord can only deduct for actual damage, not normal wear and tear.",
        deadline_days: null,
        type: "review",
      },
      {
        step: 3,
        title: "Mahnverfahren einleiten",
        description:
          "If the landlord doesn't respond, initiate a court dunning procedure (Mahnverfahren) — a cost-effective way to enforce payment.",
        deadline_days: null,
        type: "legal_action",
        statute: "§§ 688 ff. ZPO",
      },
      {
        step: 4,
        title: "Klage vor dem Amtsgericht",
        description:
          "If the dunning procedure is disputed, file a claim at the local court (Amtsgericht). Deposit disputes are usually handled in summary proceedings.",
        deadline_days: null,
        type: "legal_action",
      },
    ],
  },
  {
    category: "consumer",
    issue_type: "withdrawal",
    steps: [
      {
        step: 1,
        title: "Widerrufsfrist prüfen",
        description:
          "Check the withdrawal period. For most online purchases, you have 14 days from receipt (§ 355 BGB, § 312g BGB).",
        deadline_days: 14,
        type: "deadline_check",
        statute: "§ 355 BGB",
      },
      {
        step: 2,
        title: "Widerrufserklärung abgeben",
        description:
          "Send a clear withdrawal declaration (Widerrufserklärung) to the seller. Use the model withdrawal form from the BGB-InfoV if available.",
        deadline_days: null,
        type: "action",
      },
      {
        step: 3,
        title: "Ware zurücksenden",
        description:
          "Return the goods within 14 days of withdrawal. Keep proof of return (shipping receipt, tracking number).",
        deadline_days: 14,
        type: "action",
      },
      {
        step: 4,
        title: "Rückzahlung einfordern",
        description:
          "The seller must refund all payments within 14 days of receiving the withdrawal (§ 357 BGB). If not, send a reminder.",
        deadline_days: 14,
        type: "follow_up",
        statute: "§ 357 BGB",
      },
    ],
  },
  {
    category: "consumer",
    issue_type: "warranty",
    steps: [
      {
        step: 1,
        title: "Mangel dokumentieren",
        description:
          "Document the defect: photos, videos, and a written description. Note the date of discovery.",
        deadline_days: null,
        type: "evidence",
      },
      {
        step: 2,
        title: "Nacherfüllung verlangen",
        description:
          "Demand supplementary performance (Nacherfüllung) from the seller. Choose between repair or replacement (§ 439 BGB). Set a 14-day deadline.",
        deadline_days: 14,
        type: "demand",
        statute: "§ 439 BGB",
      },
      {
        step: 3,
        title: "Rücktritt oder Minderung",
        description:
          "If the seller fails to remedy the defect, you can withdraw from the contract (Rücktritt) or reduce the price (Minderung) (§§ 437, 440, 323 BGB).",
        deadline_days: null,
        type: "action",
        statute: "§§ 437, 440 BGB",
      },
      {
        step: 4,
        title: "Schadensersatz prüfen",
        description:
          "If the defect causes additional damage, you may claim damages (§§ 437 Nr. 3, 280 BGB). This requires proving the seller was at fault.",
        deadline_days: null,
        type: "legal_action",
        statute: "§§ 437, 280 BGB",
      },
      {
        step: 5,
        title: "Verjährung beachten",
        description:
          "The warranty period is 2 years for movable items (§ 438 BGB). For real estate, it's 5 years. Act before the deadline.",
        deadline_days: 730,
        type: "deadline",
        statute: "§ 438 BGB",
      },
    ],
  },
  {
    category: "traffic",
    issue_type: "fine_contest",
    steps: [
      {
        step: 1,
        title: "Bußgeldbescheid prüfen",
        description:
          "Review the fine notice (Bußgeldbescheid) for errors: correct name, address, date, time, location, and speed/measurement.",
        deadline_days: null,
        type: "review",
      },
      {
        step: 2,
        title: "Einspruch einlegen",
        description:
          "File an objection (Einspruch) within 2 weeks of receiving the fine notice (§ 67 OWiG). Must be in writing.",
        deadline_days: 14,
        type: "legal_action",
        statute: "§ 67 OWiG",
      },
      {
        step: 3,
        title: "Akteneinsicht beantragen",
        description:
          "Request access to the case file (Akteneinsicht) through a lawyer to review the evidence, especially the speed measurement data.",
        deadline_days: null,
        type: "discovery",
      },
      {
        step: 4,
        title: "Hauptverhandlung vorbereiten",
        description:
          "If the objection proceeds to court, prepare for the hearing. Consider hiring a specialized traffic lawyer.",
        deadline_days: null,
        type: "preparation",
      },
      {
        step: 5,
        title: "Gerichtstermin",
        description:
          "Attend the court hearing. The court will decide on the fine, points, and driving ban (Fahrverbot).",
        deadline_days: null,
        type: "hearing",
      },
    ],
  },
  {
    category: "family",
    issue_type: "custody",
    steps: [
      {
        step: 1,
        title: "Sorgerecht prüfen",
        description:
          "Determine current custody arrangement. Under § 1626 BGB, parents have joint custody unless a court decides otherwise.",
        deadline_days: null,
        type: "analysis",
        statute: "§ 1626 BGB",
      },
      {
        step: 2,
        title: "Beratungsstellen kontaktieren",
        description:
          "Contact a family counseling center (Erziehungsberatungsstelle) or the Youth Welfare Office (Jugendamt) for mediation.",
        deadline_days: null,
        type: "mediation",
      },
      {
        step: 3,
        title: "Sorgerechtsantrag vorbereiten",
        description:
          "If mediation fails, prepare an application for custody with the Family Court (Familiengericht). Include evidence of your suitability.",
        deadline_days: null,
        type: "legal_action",
      },
      {
        step: 4,
        title: "Anwalt für Familienrecht",
        description:
          "Engage a specialized family law attorney. In custody cases, the court may appoint a procedural guardian (Verfahrensbeistand) for the child (§ 158 FamFG).",
        deadline_days: null,
        type: "legal_representation",
      },
      {
        step: 5,
        title: "Gerichtliches Verfahren",
        description:
          "Participate in the court proceedings. The court will prioritize the child's best interest (Kindeswohl) under § 1697a BGB.",
        deadline_days: null,
        type: "hearing",
        statute: "§ 1697a BGB",
      },
    ],
  },
  {
    category: "public",
    issue_type: "defense_strategy",
    steps: [
      {
        step: 1,
        title: "Akteneinsicht beantragen",
        description:
          "Request access to the prosecution's case file through your defense attorney (§ 147 StPO). This is essential for building a defense.",
        deadline_days: null,
        type: "discovery",
        statute: "§ 147 StPO",
      },
      {
        step: 2,
        title: "Einlassung vorbereiten",
        description:
          "Prepare your statement (Einlassung) with your lawyer. Decide whether to remain silent or make a statement (§ 136 StPO).",
        deadline_days: null,
        type: "preparation",
        statute: "§ 136 StPO",
      },
      {
        step: 3,
        title: "Beweisanträge stellen",
        description:
          "File motions for evidence (Beweisanträge) to introduce favorable evidence, witness testimony, or expert opinions.",
        deadline_days: null,
        type: "legal_action",
      },
      {
        step: 4,
        title: "Hauptverhandlung",
        description:
          "Prepare for the main hearing. Your lawyer will present your defense, cross-examine witnesses, and make closing arguments.",
        deadline_days: null,
        type: "hearing",
      },
      {
        step: 5,
        title: "Rechtsmittel prüfen",
        description:
          "If convicted, discuss appeal options with your lawyer: Berufung (appeal on facts and law) or Revision (appeal on law only) (§§ 312, 333 StPO).",
        deadline_days: null,
        type: "appeal",
        statute: "§§ 312, 333 StPO",
      },
    ],
  },
];

// ── Document Templates ────────────────────────────────────────────────
const templates = [
  {
    slug: "widerspruch",
    title:
      "Widerspruch gegen einen Bescheid (Objection to an Administrative Decision)",
    category: "public",
    content_template:
      "{{name}}\n{{opposing_party}}\n{{court_name}}\n{{case_number}}\n\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nWIDERSPRUCH\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\negen den Bescheid des {{opposing_party}} vom {{incident_date}}\n\nhiermit lege ich, {{name}}, fristgem\u00e4\u00df Widerspruch gegen den oben genannten Bescheid ein.\n\nBegr\u00fcndung:\n{{notes}}\n\nDer Bescheid ist rechtswidrig, da er gegen geltendes Recht verst\u00f6\u00dft. Insbesondere wird ger\u00fcgt:\n\n1. Die Sachverhaltsermittlung ist unvollst\u00e4ndig.\n2. Die rechtliche W\u00fcrdigung ist fehlerhaft.\n3. Der Grundsatz der Verh\u00e4ltnism\u00e4\u00dfigkeit wurde nicht beachtet.\n\nBeweismittel:\n- Zeugen: werden benannt\n- Urkunden: in Kopie beigef\u00fcgt\n\nEs wird beantragt,\nden Bescheid vom {{incident_date}} aufzuheben.\n\n_________________________\n(Ort, Datum)\n\n_________________________\n(Unterschrift)\n\n---\n\nHinweis: Dieser Widerspruch wurde mit KI-Unterst\u00fctzung erstellt und ersetzt keine anwaltliche Beratung. Ggf. ist die Einschaltung eines Rechtsanwalts erforderlich.",
    placeholders: [
      "name",
      "opposing_party",
      "court_name",
      "case_number",
      "incident_date",
      "notes",
    ],
  },
  {
    slug: "mahnung",
    title: "Mahnung (Formal Demand / Dunning Letter)",
    category: "consumer",
    content_template:
      "{{name}}\n{{opposing_party}}\n{{court_name}}\n{{case_number}}\n\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nMAHNUNG\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n{{opposing_party}}\n[Adresse des Schuldners]\n\n_________________________\n(Ort, Datum)\n\nBetreff: Mahnung \u2013 Zahlungsaufforderung\n\nSehr geehrte Damen und Herren,\n\nhiermit mahne ich die ausstehende Zahlung in H\u00f6he von {{dispute_value}} EUR an.\n\nDie Forderung besteht seit dem {{incident_date}}. Bisherige Zahlungsaufforderungen blieben erfolglos.\n\nIch setze Ihnen eine letzte Frist zur Zahlung bis zum {{deadline_date}}.\n\nSollte der Betrag bis dahin nicht auf meinem Konto eingegangen sein, werde ich rechtliche Schritte einleiten, insbesondere:\n1. Beantragung eines Mahnbescheids beim zust\u00e4ndigen Amtsgericht\n2. Einleitung eines gerichtlichen Verfahrens\n3. Geltendmachung von Verzugszinsen und Mahnkosten\n\nZus\u00e4tzliche Informationen:\n{{notes}}\n\nMit freundlichen Gr\u00fc\u00dfen,\n\n_________________________\n(Unterschrift)\n\n---\n\nRechtliche Grundlagen: \u00a7\u00a7 286, 288 BGB (Verzug), \u00a7 12 UWG (Mahnkostenpauschale)",
    placeholders: [
      "name",
      "opposing_party",
      "court_name",
      "case_number",
      "incident_date",
      "deadline_date",
      "dispute_value",
      "notes",
    ],
  },
  {
    slug: "kuendigung",
    title: "K\u00fcndigung (Termination Notice)",
    category: "labor",
    content_template:
      "{{name}}\n{{opposing_party}}\n{{court_name}}\n{{case_number}}\n\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nK\u00dcNDIGUNG\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n{{opposing_party}}\n[Adresse des Arbeitgebers/Vermieters]\n\n_________________________\n(Ort, Datum)\n\nBetreff: Au\u00dferordentliche / Ordentliche K\u00fcndigung des Vertragsverh\u00e4ltnisses\n\nSehr geehrte Damen und Herren,\n\nhiermit k\u00fcndige ich das bestehende Vertragsverh\u00e4ltnis fristgerecht zum n\u00e4chstm\u00f6glichen Zeitpunkt.\n\nVertragsbeginn: {{incident_date}}\nK\u00fcndigungsgrund:\n{{notes}}\n\nIch bitte um schriftliche Best\u00e4tigung des Beendigungszeitpunkts sowie um Ausstellung aller erforderlichen Unterlagen (Arbeitszeugnis, Mieterbescheinigung, etc.).\n\nSollten Sie die Wirksamkeit dieser K\u00fcndigung bestreiten, bin ich bereit, eine einvernehmliche L\u00f6sung zu suchen.\n\nMit freundlichen Gr\u00fc\u00dfen,\n\n_________________________\n(Unterschrift)\n\n---\n\nWichtiger Hinweis: Diese K\u00fcndigung wurde mit KI-Unterst\u00fctzung erstellt. Bei Arbeitsverh\u00e4ltnissen ist die Einhaltung der K\u00fcndigungsfristen gem\u00e4\u00df \u00a7\u00a7 622, 623 BGB sowie ggf. des K\u00fcndigungsschutzgesetzes zu beachten. Im Zweifel konsultieren Sie einen Rechtsanwalt.",
    placeholders: [
      "name",
      "opposing_party",
      "court_name",
      "case_number",
      "incident_date",
      "notes",
    ],
  },
  {
    slug: "einspruch",
    title: "Einspruch gegen Bu\u00dfgeldbescheid (Objection to a Fine Notice)",
    category: "traffic",
    content_template:
      "{{name}}\n{{opposing_party}}\n{{court_name}}\n{{case_number}}\n\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nEINSPRUCH\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\negen den Bu\u00dfgeldbescheid der {{opposing_party}} vom {{incident_date}}\nAktenzeichen: {{case_number}}\n\nhiermit lege ich fristgem\u00e4\u00df Einspruch gegen den oben genannten Bu\u00dfgeldbescheid ein.\n\nMir wird vorgeworfen:\n{{notes}}\n\nDer Einspruch richtet sich gegen:\n1. Die H\u00f6he des Bu\u00dfgeldes\n2. Die Festsetzung von Punkten\n3. [gegebenenfalls] Das verh\u00e4ngte Fahrverbot\n\nBegr\u00fcndung:\nDie Messung/ Feststellung ist fehlerhaft. Insbesondere bestehen Zweifel an der Ordnungsgem\u00e4\u00dfheit der Messung. Ich beantrage Akteneinsicht gem\u00e4\u00df \u00a7 147 StPO i.V.m. \u00a7 46 OWiG.\n\nBeweismittel:\n- Vorlage der Messdaten\n- Zeugenbenennung\n- Sachverst\u00e4ndigengutachten (ggf.)\n\nEs wird beantragt,\ndas Verfahren einzustellen, hilfsweise die Hauptverhandlung anzuberaumen.\n\n_________________________\n(Ort, Datum)\n\n_________________________\n(Unterschrift)\n\n---\n\nRechtliche Grundlagen: \u00a7 67 OWiG (Einspruchsfrist), \u00a7 147 StPO (Akteneinsicht)",
    placeholders: [
      "name",
      "opposing_party",
      "court_name",
      "case_number",
      "incident_date",
      "notes",
    ],
  },
  {
    slug: "klage",
    title: "Klageschrift (Statement of Claim / Complaint)",
    category: "consumer",
    content_template:
      "{{name}}\n{{opposing_party}}\n{{court_name}}\n{{case_number}}\n\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nKLAGESCHRIFT\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\nvor dem {{court_name}}\nAktenzeichen: {{case_number}}\n\nKl\u00e4ger: {{name}}\nBeklagter: {{opposing_party}}\n\nStreitwert: {{dispute_value}} EUR\n\nhiermit erhebe ich Klage gegen den Beklagten.\n\nI. Sachverhalt\nDer zugrundeliegende Vorfall ereignete sich am {{incident_date}}.\n\n{{notes}}\n\nII. Rechtliche W\u00fcrdigung\nDem Beklagten ist vorzuwerfen, dass er gegen seine vertraglichen/gesetzlichen Pflichten versto\u00dfen hat.\n\nIII. Antr\u00e4ge\n1. Der Beklagte wird verurteilt, an den Kl\u00e4ger {{dispute_value}} EUR nebst Zinsen in H\u00f6he von 5 Prozentpunkten \u00fcber dem Basiszinssatz seit Rechtsh\u00e4ngigkeit zu zahlen.\n2. Der Beklagte tr\u00e4gt die Kosten des Rechtsstreits.\n3. Das Urteil ist vorl\u00e4ufig vollstreckbar.\n\nIV. Beweismittel\n- Zeugen: werden benannt\n- Urkunden: in Kopie beigef\u00fcgt\n- Sachverst\u00e4ndigengutachten: wird ggf. beantragt\n\n_________________________\n(Ort, Datum)\n\n_________________________\n(Unterschrift)\n\n---\n\nRechtliche Grundlagen: \u00a7\u00a7 12, 253 ZPO, \u00a7\u00a7 23, 71 GVG (Zust\u00e4ndigkeit),\n\u00a7 291 BGB (Prozesszinsen)\n\nHinweis: Diese Klageschrift wurde mit KI-Unterst\u00fctzung erstellt und ersetzt nicht die Beratung durch einen Rechtsanwalt. Vor dem Landgericht besteht Anwaltszwang (\u00a7 78 ZPO).",
    placeholders: [
      "name",
      "opposing_party",
      "court_name",
      "case_number",
      "incident_date",
      "dispute_value",
      "notes",
    ],
  },
];

async function seed() {
  console.log("Seeding remediation_playbooks...");
  const { data: pbData, error: pbError } = await supabase
    .from("remediation_playbooks")
    .upsert(playbooks, { onConflict: "issue_type", ignoreDuplicates: false });

  if (pbError) {
    console.error("Playbook seed error:", pbError.message);
    process.exit(1);
  }
  console.log(`  ✅ ${playbooks.length} playbooks inserted`);

  console.log("Seeding document_templates...");
  const { data: dtData, error: dtError } = await supabase
    .from("document_templates")
    .upsert(templates, { onConflict: "slug", ignoreDuplicates: false });

  if (dtError) {
    console.error("Template seed error:", dtError.message);
    process.exit(1);
  }
  console.log(`  ✅ ${templates.length} templates inserted`);

  // Verify
  console.log("\nVerifying...");
  const { count: pbCount } = await supabase
    .from("remediation_playbooks")
    .select("*", { count: "exact", head: true });
  console.log(`  remediation_playbooks: ${pbCount} rows`);

  const { count: dtCount } = await supabase
    .from("document_templates")
    .select("*", { count: "exact", head: true });
  console.log(`  document_templates: ${dtCount} rows`);

  console.log("\n✅ Seed complete!");
}

seed().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
