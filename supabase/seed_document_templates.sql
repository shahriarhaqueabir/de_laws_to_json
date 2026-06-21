-- Seed data: German legal document templates with handlebars placeholders
-- 5 templates covering the most common legal situations
--
-- Run this in Supabase Studio SQL editor AFTER migration 00007 is applied.
-- Placeholders match bookmark_folder property keys for auto-fill.

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
