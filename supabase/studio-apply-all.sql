-- =============================================================================
-- German Law Vault — Complete Database Setup Script
-- Run this in Supabase Studio SQL Editor (one block at a time or all at once)
-- =============================================================================
-- WARNING: This script is DESTRUCTIVE. It drops and recreates the full schema.
-- Only run on a development/staging database. Do NOT run on production with
-- user data unless you understand the consequences.
-- =============================================================================

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 1: Apply Migration 00007 (Guidance + Folders + Schema Cleanup)
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1a. Bookmark folders with uniform AI-guidance properties ──

CREATE TABLE IF NOT EXISTS public.bookmark_folders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT 'other',

  -- Uniform properties — each field feeds the AI guidance engine
  incident_date   DATE,                                    -- When did the situation occur?
  dispute_value   NUMERIC(12,2) NOT NULL DEFAULT 0.00,     -- Streitwert (EUR)
  status          TEXT NOT NULL DEFAULT 'pre_action'
                  CHECK (status IN ('pre_action', 'consulting', 'filed', 'in_progress', 'resolved')),
  opposing_party  TEXT NOT NULL DEFAULT '',                 -- Other side (employer, landlord, etc.)
  deadline_date   DATE,                                    -- Critical statutory deadline
  court_name      TEXT NOT NULL DEFAULT '',                 -- Court if proceedings started
  case_number     TEXT NOT NULL DEFAULT '',                 -- Aktenzeichen
  notes           TEXT NOT NULL DEFAULT '',                 -- Free-text context for AI

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 1b. Link bookmarks → folders ──

ALTER TABLE public.bookmarks
  ADD COLUMN IF NOT EXISTS folder_id UUID
  REFERENCES public.bookmark_folders(id) ON DELETE SET NULL;

-- ── 1c. Guidance paths (AI-generated outcome paths) ──

CREATE TABLE IF NOT EXISTS public.guidance_paths (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_file_id        UUID NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  path_number         SMALLINT NOT NULL CHECK (path_number BETWEEN 1 AND 5),
  title               TEXT NOT NULL,
  summary             TEXT NOT NULL,
  detailed_analysis   TEXT NOT NULL,
  laws_cited          JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_level          TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  cost_estimate       NUMERIC(12,2),
  recommended_actions TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 1d. Cleanup: drop migration 00005 tables ──

DROP TABLE IF EXISTS public.case_parties CASCADE;
DROP TABLE IF EXISTS public.case_hearings CASCADE;
DROP TABLE IF EXISTS public.case_documents CASCADE;
DROP TABLE IF EXISTS public.legal_cases CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.courts CASCADE;

-- ── 1e. Cleanup: orphan columns on norm_explanations ──

ALTER TABLE public.norm_explanations DROP COLUMN IF EXISTS case_id;
ALTER TABLE public.norm_explanations DROP COLUMN IF EXISTS user_id;

DROP TRIGGER IF EXISTS trg_sync_norm_explanations_user_id ON public.norm_explanations;
DROP FUNCTION IF EXISTS public.sync_norm_explanations_user_id;
DROP FUNCTION IF EXISTS public.set_updated_at;

-- ── 1f. Missing FK: norm_explanations.law_key → laws.key ──

DELETE FROM public.norm_explanations
WHERE law_key IS NOT NULL
  AND law_key NOT IN (SELECT key FROM public.laws);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_norm_explanations_law_key'
  ) THEN
    ALTER TABLE public.norm_explanations
      ADD CONSTRAINT fk_norm_explanations_law_key
      FOREIGN KEY (law_key) REFERENCES public.laws(key) ON DELETE CASCADE;
  END IF;
END
$$;

-- ── 1g. Missing hot-path indexes ──

CREATE INDEX IF NOT EXISTS idx_conversations_user_id
  ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id
  ON public.bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_folder_id
  ON public.bookmarks(folder_id);
CREATE INDEX IF NOT EXISTS idx_bookmark_folders_user_id
  ON public.bookmark_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_guidance_paths_case_file_id
  ON public.guidance_paths(case_file_id);

-- ── 1h. RLS: new tables ──

ALTER TABLE public.bookmark_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guidance_paths ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bookmark_folders'
      AND policyname = 'users own folders'
  ) THEN
    CREATE POLICY "users own folders"
      ON public.bookmark_folders FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'guidance_paths'
      AND policyname = 'users own guidance paths'
  ) THEN
    CREATE POLICY "users own guidance paths"
      ON public.guidance_paths FOR ALL
      USING (
        case_file_id IN (SELECT id FROM public.case_files WHERE user_id = auth.uid())
      )
      WITH CHECK (
        case_file_id IN (SELECT id FROM public.case_files WHERE user_id = auth.uid())
      );
  END IF;
END
$$;

-- ── 1i. Restore original RLS policies (broken by mig 00005) ──

-- conversations
DROP POLICY IF EXISTS "conversations: read own/admin" ON public.conversations;
DROP POLICY IF EXISTS "conversations: insert own/admin" ON public.conversations;
DROP POLICY IF EXISTS "conversations: update own/admin" ON public.conversations;
DROP POLICY IF EXISTS "conversations: delete own/admin" ON public.conversations;

CREATE POLICY "users own conversations"
  ON public.conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- messages
DROP POLICY IF EXISTS "messages: read own/admin" ON public.messages;
DROP POLICY IF EXISTS "messages: insert own/admin" ON public.messages;
DROP POLICY IF EXISTS "messages: update own/admin" ON public.messages;
DROP POLICY IF EXISTS "messages: delete own/admin" ON public.messages;

CREATE POLICY "users own messages"
  ON public.messages FOR ALL
  USING (
    conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid())
  )
  WITH CHECK (
    conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid())
  );

-- bookmarks
DROP POLICY IF EXISTS "bookmarks: read own/admin" ON public.bookmarks;
DROP POLICY IF EXISTS "bookmarks: insert own/admin" ON public.bookmarks;
DROP POLICY IF EXISTS "bookmarks: update own/admin" ON public.bookmarks;
DROP POLICY IF EXISTS "bookmarks: delete own/admin" ON public.bookmarks;

CREATE POLICY "users own bookmarks"
  ON public.bookmarks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- norm_explanations
DROP POLICY IF EXISTS "norm_explanations: read own/admin" ON public.norm_explanations;
DROP POLICY IF EXISTS "norm_explanations: insert own/admin" ON public.norm_explanations;
DROP POLICY IF EXISTS "norm_explanations: update own/admin" ON public.norm_explanations;
DROP POLICY IF EXISTS "norm_explanations: delete own/admin" ON public.norm_explanations;

CREATE POLICY "norm_explanations are public"
  ON public.norm_explanations FOR SELECT
  USING (true);

CREATE POLICY "norm_explanations insert"
  ON public.norm_explanations FOR INSERT
  WITH CHECK (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 2: Verify Migration State
-- ═════════════════════════════════════════════════════════════════════════════

-- Run this query to verify all tables exist:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;


-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 3: Seed remediation_playbooks (8 playbooks)
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.remediation_playbooks (category, issue_type, steps) VALUES
('labor', 'wrongful_dismissal', '[
  {"step": 1, "title": "Prüfung der Kündigung", "description": "Check if the termination notice meets formal requirements (written form, signature, delivery). Under § 623 BGB, termination must be in writing.", "deadline_days": null, "type": "analysis"},
  {"step": 2, "title": "Kündigungsschutzklage einreichen", "description": "File a wrongful dismissal claim with the Labor Court (Arbeitsgericht). Must be done within 3 weeks of receiving the notice (§ 4 KSchG).", "deadline_days": 21, "type": "legal_action", "statute": "§ 4 KSchG"},
  {"step": 3, "title": "Gütetermin abwarten", "description": "Attend the conciliation hearing (Gütetermin) at the Labor Court. The judge will try to mediate a settlement.", "deadline_days": null, "type": "hearing"},
  {"step": 4, "title": "Kammertermin vorbereiten", "description": "If no settlement, prepare for the main hearing (Kammertermin). Gather evidence, witness statements, and legal arguments.", "deadline_days": null, "type": "preparation"},
  {"step": 5, "title": "Urteil oder Vergleich", "description": "Receive the court judgment or negotiate a settlement (Vergleich). Settlement avoids appeal and reduces costs.", "deadline_days": null, "type": "outcome"}
]'),
('housing', 'rent_reduction', '[
  {"step": 1, "title": "Mangel dokumentieren", "description": "Document the defect thoroughly: photos, videos, witness statements, and expert reports if applicable.", "deadline_days": null, "type": "evidence"},
  {"step": 2, "title": "Vermieter schriftlich informieren", "description": "Notify the landlord in writing about the defect and set a reasonable deadline for repair (§ 536 BGB).", "deadline_days": null, "type": "notice", "statute": "§ 536 BGB"},
  {"step": 3, "title": "Mietminderung ankündigen", "description": "If the landlord fails to repair within the deadline, announce a rent reduction. The amount depends on the severity of the defect (usually 10-50%).", "deadline_days": null, "type": "action"},
  {"step": 4, "title": "Mietminderung durchführen", "description": "Reduce the monthly rent by the justified amount. Keep the reduced rent in a separate account to prove willingness to pay.", "deadline_days": null, "type": "action"},
  {"step": 5, "title": "Rechtliche Schritte prüfen", "description": "If the landlord disputes the reduction, consider filing a declaratory action (Feststellungsklage) or seeking legal advice.", "deadline_days": null, "type": "legal_action"}
]'),
('consumer', 'deposit_retention', '[
  {"step": 1, "title": "Kaution einfordern", "description": "Send a formal written request for the deposit return (Kaution) with a 2-week deadline. Under § 812 BGB, the landlord must return the deposit after tenancy ends.", "deadline_days": 14, "type": "demand", "statute": "§ 812 BGB"},
  {"step": 2, "title": "Abnahmeprotokoll prüfen", "description": "Review the move-out protocol (Abnahmeprotokoll) for any claims of damage. The landlord can only deduct for actual damage, not normal wear and tear.", "deadline_days": null, "type": "review"},
  {"step": 3, "title": "Mahnverfahren einleiten", "description": "If the landlord doesn''t respond, initiate a court dunning procedure (Mahnverfahren) — a cost-effective way to enforce payment.", "deadline_days": null, "type": "legal_action", "statute": "§§ 688 ff. ZPO"},
  {"step": 4, "title": "Klage vor dem Amtsgericht", "description": "If the dunning procedure is disputed, file a claim at the local court (Amtsgericht). Deposit disputes are usually handled in summary proceedings.", "deadline_days": null, "type": "legal_action"}
]'),
('consumer', 'withdrawal', '[
  {"step": 1, "title": "Widerrufsfrist prüfen", "description": "Check the withdrawal period. For most online purchases, you have 14 days from receipt (§ 355 BGB, § 312g BGB).", "deadline_days": 14, "type": "deadline_check", "statute": "§ 355 BGB"},
  {"step": 2, "title": "Widerrufserklärung abgeben", "description": "Send a clear withdrawal declaration (Widerrufserklärung) to the seller. Use the model withdrawal form from the BGB-InfoV if available.", "deadline_days": null, "type": "action"},
  {"step": 3, "title": "Ware zurücksenden", "description": "Return the goods within 14 days of withdrawal. Keep proof of return (shipping receipt, tracking number).", "deadline_days": 14, "type": "action"},
  {"step": 4, "title": "Rückzahlung einfordern", "description": "The seller must refund all payments within 14 days of receiving the withdrawal (§ 357 BGB). If not, send a reminder.", "deadline_days": 14, "type": "follow_up", "statute": "§ 357 BGB"}
]'),
('consumer', 'warranty', '[
  {"step": 1, "title": "Mangel dokumentieren", "description": "Document the defect: photos, videos, and a written description. Note the date of discovery.", "deadline_days": null, "type": "evidence"},
  {"step": 2, "title": "Nacherfüllung verlangen", "description": "Demand supplementary performance (Nacherfüllung) from the seller. Choose between repair or replacement (§ 439 BGB). Set a 14-day deadline.", "deadline_days": 14, "type": "demand", "statute": "§ 439 BGB"},
  {"step": 3, "title": "Rücktritt oder Minderung", "description": "If the seller fails to remedy the defect, you can withdraw from the contract (Rücktritt) or reduce the price (Minderung) (§§ 437, 440, 323 BGB).", "deadline_days": null, "type": "action", "statute": "§§ 437, 440 BGB"},
  {"step": 4, "title": "Schadensersatz prüfen", "description": "If the defect causes additional damage, you may claim damages (§§ 437 Nr. 3, 280 BGB). This requires proving the seller was at fault.", "deadline_days": null, "type": "legal_action", "statute": "§§ 437, 280 BGB"},
  {"step": 5, "title": "Verjährung beachten", "description": "The warranty period is 2 years for movable items (§ 438 BGB). For real estate, it''s 5 years. Act before the deadline.", "deadline_days": 730, "type": "deadline", "statute": "§ 438 BGB"}
]'),
('traffic', 'fine_contest', '[
  {"step": 1, "title": "Bußgeldbescheid prüfen", "description": "Review the fine notice (Bußgeldbescheid) for errors: correct name, address, date, time, location, and speed/measurement.", "deadline_days": null, "type": "review"},
  {"step": 2, "title": "Einspruch einlegen", "description": "File an objection (Einspruch) within 2 weeks of receiving the fine notice (§ 67 OWiG). Must be in writing.", "deadline_days": 14, "type": "legal_action", "statute": "§ 67 OWiG"},
  {"step": 3, "title": "Akteneinsicht beantragen", "description": "Request access to the case file (Akteneinsicht) through a lawyer to review the evidence, especially the speed measurement data.", "deadline_days": null, "type": "discovery"},
  {"step": 4, "title": "Hauptverhandlung vorbereiten", "description": "If the objection proceeds to court, prepare for the hearing. Consider hiring a specialized traffic lawyer.", "deadline_days": null, "type": "preparation"},
  {"step": 5, "title": "Gerichtstermin", "description": "Attend the court hearing. The court will decide on the fine, points, and driving ban (Fahrverbot).", "deadline_days": null, "type": "hearing"}
]'),
('family', 'custody', '[
  {"step": 1, "title": "Sorgerecht prüfen", "description": "Determine current custody arrangement. Under § 1626 BGB, parents have joint custody unless a court decides otherwise.", "deadline_days": null, "type": "analysis", "statute": "§ 1626 BGB"},
  {"step": 2, "title": "Beratungsstellen kontaktieren", "description": "Contact a family counseling center (Erziehungsberatungsstelle) or the Youth Welfare Office (Jugendamt) for mediation.", "deadline_days": null, "type": "mediation"},
  {"step": 3, "title": "Sorgerechtsantrag vorbereiten", "description": "If mediation fails, prepare an application for custody with the Family Court (Familiengericht). Include evidence of your suitability.", "deadline_days": null, "type": "legal_action"},
  {"step": 4, "title": "Anwalt für Familienrecht", "description": "Engage a specialized family law attorney. In custody cases, the court may appoint a procedural guardian (Verfahrensbeistand) for the child (§ 158 FamFG).", "deadline_days": null, "type": "legal_representation"},
  {"step": 5, "title": "Gerichtliches Verfahren", "description": "Participate in the court proceedings. The court will prioritize the child''s best interest (Kindeswohl) under § 1697a BGB.", "deadline_days": null, "type": "hearing", "statute": "§ 1697a BGB"}
]'),
('public', 'defense_strategy', '[
  {"step": 1, "title": "Akteneinsicht beantragen", "description": "Request access to the prosecution''s case file through your defense attorney (§ 147 StPO). This is essential for building a defense.", "deadline_days": null, "type": "discovery", "statute": "§ 147 StPO"},
  {"step": 2, "title": "Einlassung vorbereiten", "description": "Prepare your statement (Einlassung) with your lawyer. Decide whether to remain silent or make a statement (§ 136 StPO).", "deadline_days": null, "type": "preparation", "statute": "§ 136 StPO"},
  {"step": 3, "title": "Beweisanträge stellen", "description": "File motions for evidence (Beweisanträge) to introduce favorable evidence, witness testimony, or expert opinions.", "deadline_days": null, "type": "legal_action"},
  {"step": 4, "title": "Hauptverhandlung", "description": "Prepare for the main hearing. Your lawyer will present your defense, cross-examine witnesses, and make closing arguments.", "deadline_days": null, "type": "hearing"},
  {"step": 5, "title": "Rechtsmittel prüfen", "description": "If convicted, discuss appeal options with your lawyer: Berufung (appeal on facts and law) or Revision (appeal on law only) (§§ 312, 333 StPO).", "deadline_days": null, "type": "appeal", "statute": "§§ 312, 333 StPO"}
]')
ON CONFLICT (issue_type) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 4: Seed document_templates (5 templates)
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.document_templates (slug, title, category, content_template, placeholders) VALUES
('widerspruch',
 'Widerspruch gegen einen Bescheid (Objection to an Administrative Decision)',
 'public',
 '{{name}}
{{opposing_party}}
{{court_name}}
{{case_number}}

───────────────────────────────────────
WIDERSPRUCH
───────────────────────────────────────

gegen den Bescheid des {{opposing_party}} vom {{incident_date}}

hiermit lege ich, {{name}}, fristgemäß Widerspruch gegen den oben genannten Bescheid ein.

Begründung:
{{notes}}

Der Bescheid ist rechtswidrig, da er gegen geltendes Recht verstößt. Insbesondere wird gerügt:

1. Die Sachverhaltsermittlung ist unvollständig.
2. Die rechtliche Würdigung ist fehlerhaft.
3. Der Grundsatz der Verhältnismäßigkeit wurde nicht beachtet.

Beweismittel:
- Zeugen: werden benannt
- Urkunden: in Kopie beigefügt

Es wird beantragt,
den Bescheid vom {{incident_date}} aufzuheben.

_________________________
(Ort, Datum)

_________________________
(Unterschrift)

---

Hinweis: Dieser Widerspruch wurde mit KI-Unterstützung erstellt und ersetzt keine anwaltliche Beratung. Ggf. ist die Einschaltung eines Rechtsanwalts erforderlich.',
 '["name", "opposing_party", "court_name", "case_number", "incident_date", "notes"]'),

('mahnung',
 'Mahnung (Formal Demand / Dunning Letter)',
 'consumer',
 '{{name}}
{{opposing_party}}
{{court_name}}
{{case_number}}

───────────────────────────────────────
MAHNUNG
───────────────────────────────────────

{{opposing_party}}
[Adresse des Schuldners]

_________________________
(Ort, Datum)

Betreff: Mahnung – Zahlungsaufforderung

Sehr geehrte Damen und Herren,

hiermit mahne ich die ausstehende Zahlung in Höhe von {{dispute_value}} EUR an.

Die Forderung besteht seit dem {{incident_date}}. Bisherige Zahlungsaufforderungen blieben erfolglos.

Ich setze Ihnen eine letzte Frist zur Zahlung bis zum {{deadline_date}}.

Sollte der Betrag bis dahin nicht auf meinem Konto eingegangen sein, werde ich rechtliche Schritte einleiten, insbesondere:
1. Beantragung eines Mahnbescheids beim zuständigen Amtsgericht
2. Einleitung eines gerichtlichen Verfahrens
3. Geltendmachung von Verzugszinsen und Mahnkosten

Zusätzliche Informationen:
{{notes}}

Mit freundlichen Grüßen,

_________________________
(Unterschrift)

---

Rechtliche Grundlagen: §§ 286, 288 BGB (Verzug), § 12 UWG (Mahnkostenpauschale)',
 '["name", "opposing_party", "court_name", "case_number", "incident_date", "deadline_date", "dispute_value", "notes"]'),

('kuendigung',
 'Kündigung (Termination Notice)',
 'labor',
 '{{name}}
{{opposing_party}}
{{court_name}}
{{case_number}}

───────────────────────────────────────
KÜNDIGUNG
───────────────────────────────────────

{{opposing_party}}
[Adresse des Arbeitgebers/Vermieters]

_________________________
(Ort, Datum)

Betreff: Außerordentliche / Ordentliche Kündigung des Vertragsverhältnisses

Sehr geehrte Damen und Herren,

hiermit kündige ich das bestehende Vertragsverhältnis fristgerecht zum nächstmöglichen Zeitpunkt.

Vertragsbeginn: {{incident_date}}
Kündigungsgrund:
{{notes}}

Ich bitte um schriftliche Bestätigung des Beendigungszeitpunkts sowie um Ausstellung aller erforderlichen Unterlagen (Arbeitszeugnis, Mieterbescheinigung, etc.).

Sollten Sie die Wirksamkeit dieser Kündigung bestreiten, bin ich bereit, eine einvernehmliche Lösung zu suchen.

Mit freundlichen Grüßen,

_________________________
(Unterschrift)

---

Wichtiger Hinweis: Diese Kündigung wurde mit KI-Unterstützung erstellt. Bei Arbeitsverhältnissen ist die Einhaltung der Kündigungsfristen gemäß §§ 622, 623 BGB sowie ggf. des Kündigungsschutzgesetzes zu beachten. Im Zweifel konsultieren Sie einen Rechtsanwalt.',
 '["name", "opposing_party", "court_name", "case_number", "incident_date", "notes"]'),

('einspruch',
 'Einspruch gegen Bußgeldbescheid (Objection to a Fine Notice)',
 'traffic',
 '{{name}}
{{opposing_party}}
{{court_name}}
{{case_number}}

───────────────────────────────────────
EINSPRUCH
───────────────────────────────────────

gegen den Bußgeldbescheid der {{opposing_party}} vom {{incident_date}}
Aktenzeichen: {{case_number}}

hiermit lege ich fristgemäß Einspruch gegen den oben genannten Bußgeldbescheid ein.

Mir wird vorgeworfen:
{{notes}}

Der Einspruch richtet sich gegen:
1. Die Höhe des Bußgeldes
2. Die Festsetzung von Punkten
3. [gegebenenfalls] Das verhängte Fahrverbot

Begründung:
Die Messung/ Feststellung ist fehlerhaft. Insbesondere bestehen Zweifel an der Ordnungsgemäßheit der Messung. Ich beantrage Akteneinsicht gemäß § 147 StPO i.V.m. § 46 OWiG.

Beweismittel:
- Vorlage der Messdaten
- Zeugenbenennung
- Sachverständigengutachten (ggf.)

Es wird beantragt,
das Verfahren einzustellen, hilfsweise die Hauptverhandlung anzuberaumen.

_________________________
(Ort, Datum)

_________________________
(Unterschrift)

---

Rechtliche Grundlagen: § 67 OWiG (Einspruchsfrist), § 147 StPO (Akteneinsicht)',
 '["name", "opposing_party", "court_name", "case_number", "incident_date", "notes"]'),

('klage',
 'Klageschrift (Statement of Claim / Complaint)',
 'consumer',
 '{{name}}
{{opposing_party}}
{{court_name}}
{{case_number}}

───────────────────────────────────────
KLAGESCHRIFT
───────────────────────────────────────

vor dem {{court_name}}
Aktenzeichen: {{case_number}}

Kläger: {{name}}
Beklagter: {{opposing_party}}

Streitwert: {{dispute_value}} EUR

hiermit erhebe ich Klage gegen den Beklagten.

I. Sachverhalt
Der zugrundeliegende Vorfall ereignete sich am {{incident_date}}.

{{notes}}

II. Rechtliche Würdigung
Dem Beklagten ist vorzuwerfen, dass er gegen seine vertraglichen/gesetzlichen Pflichten verstoßen hat.

III. Anträge
1. Der Beklagte wird verurteilt, an den Kläger {{dispute_value}} EUR nebst Zinsen in Höhe von 5 Prozentpunkten über dem Basiszinssatz seit Rechtshängigkeit zu zahlen.
2. Der Beklagte trägt die Kosten des Rechtsstreits.
3. Das Urteil ist vorläufig vollstreckbar.

IV. Beweismittel
- Zeugen: werden benannt
- Urkunden: in Kopie beigefügt
- Sachverständigengutachten: wird ggf. beantragt

_________________________
(Ort, Datum)

_________________________
(Unterschrift)

---

Rechtliche Grundlagen: §§ 12, 253 ZPO, §§ 23, 71 GVG (Zuständigkeit),
§ 291 BGB (Prozesszinsen)

Hinweis: Diese Klageschrift wurde mit KI-Unterstützung erstellt und ersetzt nicht die Beratung durch einen Rechtsanwalt. Vor dem Landgericht besteht Anwaltszwang (§ 78 ZPO).',
 '["name", "opposing_party", "court_name", "case_number", "incident_date", "dispute_value", "notes"]')
ON CONFLICT (slug) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 5: Validate seed data
-- ═════════════════════════════════════════════════════════════════════════════

-- Run these queries to verify:
-- SELECT category, issue_type FROM public.remediation_playbooks ORDER BY category, issue_type;
-- SELECT slug, title FROM public.document_templates ORDER BY slug;


-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 6: Audit RLS Policies
-- ═════════════════════════════════════════════════════════════════════════════

-- Run this to verify RLS is enabled on all user-owned tables:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('bookmarks', 'bookmark_folders', 'conversations', 'messages',
--                      'case_files', 'guidance_paths', 'user_api_keys')
-- ORDER BY tablename;
