-- Seed data: Remediation playbooks for guidance/forecasting module
-- 8 playbooks covering the most common German legal issue types
--
-- Run this in Supabase Studio SQL editor AFTER migration 00007 is applied.
-- These are PUBLIC read-only (everyone can see them).

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
]');
-- ON CONFLICT removed because issue_type has no unique constraint.
-- Seed runs against a fresh database after supabase db reset, so no duplicates possible.
