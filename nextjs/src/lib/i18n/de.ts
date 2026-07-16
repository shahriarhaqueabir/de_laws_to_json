// src/lib/i18n/de.ts — German UI Strings
import { EN } from "./en";

export const DE: Record<string, string> = {
  "search.loading": "Suche...",
  "search.results_count": "{n} Gesetze gefunden",
  "search.empty": "Keine Gesetze gefunden, die den Suchkriterien entsprechen.",
  "search.error": "Fehler beim Laden der Sucheergebnisse.",
  "search.placeholder": "Gesetze nach deutschen Recht suchen...",
  "search.no_results": "Keine Ergebnisse gefunden",
  "search.awaiting": "Abwarten auf Eingabe",
  "search.init": "Umgebung für die Suche initialisieren...",
  "laws.loading": "Gesetz entschlüsseln...",
  "laws.not_found": "Gesetz nicht gefunden oder konnte nicht geladen werden.",
  "laws.norms_empty":
    "Keine gesetzlichen Fragmente sind derzeit im neuronalen Gedächtnis indexiert.",
  "guidance.loading": "Situation analysieren...",
  "guidance.title": "Rechtsberatung",
  "guidance.describe": "Beschreiben Sie Ihre Situation",
  "guidance.analyze": "Analyse",
  "guidance.history": "Geschichte",
  "common.error": "Fehler",
  "nav.sign_in": "Anmelden",
  "nav.sign_out": "Abmelden",
  "nav.search": "Suche",
  "nav.guidance": "Beratung",
  "nav.bookmarks": "Buchmarken",
  "nav.chat": "Chat",
  "nav.settings": "Einstellungen",
  "nav.laws": "Gesetze",
  "nav.api_docs": "API-Dokumentation",
  "footer.tagline": "Unter dem Gesetz die Freiheit",
  "footer.copyright":
    "© 2026 German Law Vault — offizieller Rechtsintelligenzdepot",
  "auth.title": "Willkommen",
  "auth.email": "E-Mail",
  "auth.password": "Passwort",
  "auth.sign_in_button": "Anmelden",
  "auth.sign_up_button": "Konto erstellen",
  "auth.no_account": "Kein Konto?",
  "auth.has_account": "Haben Sie bereits ein Konto?",
  "auth.error_prefix": "Fehler",
  "chat.title": "Rechtsanwalt",
  "chat.placeholder": "Beschreiben Sie Ihre rechtliche Situation...",
  "chat.send": "Senden",
  "chat.settings": "Einstellungen",
  "chat.local_offline": "Lokaler Node aus",
  "chat.startup_hint":
    "Starten Sie Ihren lokalen Ollama und Broker, um den vollständig offlinem AI-Modus zu aktivieren",
  "chat.mode_basic": "Grundlegend",
  "chat.mode_browser": "Browser",
  "chat.mode_cloud": "Cloud",
  "chat.mode_local": "Lokal",
  "bookmarks.title": "Meine Buchmarken",
  "bookmarks.empty": "Keine Buchmarken vorhanden",
  "bookmarks.new_folder": "Neuer Ordner",
  "bookmarks.delete_folder": "Löschen Ordner",
  "settings.title": "Einstellungen",
  "settings.api_key": "API-Schlüssel",
  "settings.save": "Speichern",
  "settings.remove": "Entfernen",
  "settings.provider": "AI-Anbieter",
  "settings.model": "Modell",
  "onboarding.banner_text":
    "Stellen Sie Ihren AI-Berater und die Sprache in 2 Minuten ein",
  "onboarding.start": "Starten",
  "onboarding.dismiss": "Später",
  "onboarding.welcome_title": "Willkommen bei German Law Vault",
  "onboarding.select_language":
    "Wählen Sie Ihre bevorzugte Sprache für die Benutzeroberfläche aus",
  "onboarding.continue": "Weiter",
  "onboarding.step_language": "Sprache",
  "onboarding.step_mode": "AI-Modus",
  "onboarding.step_features": "Funktionen",
  "onboarding.step_complete": "Alle Einstellungen gespeichert",
  "onboarding.api_key_q":
    "Haben Sie einen API-Schlüssel für OpenAI oder Anthropic?",
  "onboarding.yes": "Ja",
  "onboarding.no": "Nein",
  "onboarding.browser_q": "Möchten Sie AI vollständig im Browser ausführen?",
  "onboarding.ollama_q": "Haben Sie Ollama auf Ihrem Computer installiert?",
  "onboarding.recommend_cloud":
    "Cloud-AI — beste Qualität, bringen Sie euren eigenen Schlüssel mit",
  "onboarding.recommend_browser":
    "Browser-AI — vollständig privat, läuft im Browser (~1GB Download)",
  "onboarding.recommend_local":
    "Lokale AI — offline, nutzt Ihren lokalen Ollama",
  "onboarding.recommend_basic":
    "Grundlegende Suche — kein AI, direkte Rechtssuche",
  "onboarding.feature_title": "Was Sie tun können",
  "onboarding.feature_search": "Suche nach über 6000 Gesetzen",
  "onboarding.feature_chat": "AI-Rechtsberater",
  "onboarding.feature_guidance": "Ausgangsmöglichkeiten für Ihre Situation",
  "onboarding.feature_translation": "Gesetze in Ihrer Sprache übersetzt",
  "onboarding.feature_bookmarks": "Gesetze speichern und organisieren",
  "onboarding.complete_title": "Alle Einstellungen gespeichert",
  "onboarding.complete_desc":
    "Ihre Vorlieben wurden gespeichert. Entdecken Sie jetzt das deutsche Recht.",
  "onboarding.start_app": "Anwenden des Apps starten",
  "onboarding.restart": "Neustart der Onboarding",
  "onboarding.resume": "Weiter, wo Sie es vorher gelassen haben",
  "onboarding.view_guide": "Leitfaden anzeigen",
  "onboarding.completed_on": "Sie haben die Setup am {date} abgeschlossen",

  "onboarding.back": "Zurück",
  "onboarding.skip_config": "Konfiguration überspringen",
  "onboarding.welcome_desc": "Willkommen beim German Law Vault. Richten Sie Ihren KI-Assistenten ein, um das Beste aus Ihrer juristischen Recherche herauszuholen.",
  "onboarding.mode_select_title": "Wählen Sie Ihren KI-Modus",
  "onboarding.mode_select_desc": "Wählen Sie, wie die KI arbeiten soll — direkt in Ihrem Browser, über die Cloud mit Ihrem eigenen API-Schlüssel oder lokal über Ollama.",
  "onboarding.config_title": "Konfiguration",
  "onboarding.config_desc": "Passen Sie Ihre KI-Einstellungen an Ihre Bedürfnisse an.",
  "onboarding.config_cloud": "Cloud-KI konfigurieren",
  "onboarding.config_local": "Lokale KI konfigurieren",
  "onboarding.config_browser": "Browser-KI konfigurieren",
  "onboarding.config_basic": "Basissuche",
  "onboarding.api_key_placeholder": "sk-... oder sk-ant-...",
  "onboarding.paste": "Einfügen",
  "onboarding.test_connection": "Verbindung testen",
  "onboarding.cloud_key_note": "Ihr Schlüssel wird verschlüsselt gespeichert und niemals weitergegeben.",
  "onboarding.local_broker_label": "Broker-URL",
  "onboarding.local_model_label": "Ollama-Modell",
  "onboarding.local_status_checking": "Verbindung wird geprüft...",
  "onboarding.local_status_connected": "Verbunden",
  "onboarding.local_status_offline": "Offline — Ollama läuft nicht",
  "onboarding.summary_title": "Zusammenfassung",
  "onboarding.summary_desc": "Überprüfen Sie Ihre Auswahl, bevor Sie fortfahren.",
  "onboarding.mode_local": "Lokal",
  "onboarding.mode_cloud": "Cloud",
  "onboarding.mode_browser": "Browser",
  "onboarding.mode_basic": "Basis",
  "onboarding.mode_local_detail": "Verbinden Sie sich mit Ollama auf Ihrem Rechner. Vollständig offline, keine Daten verlassen Ihr Netzwerk.",
  "onboarding.mode_cloud_detail": "Bringen Sie Ihren eigenen OpenAI/Anthropic-Schlüssel mit. Beste Qualität, schnellste Antwort.",
  "onboarding.mode_browser_detail": "Die KI läuft direkt in Ihrem Browser. Vollständig privat, ~1GB Download beim ersten Mal.",
  "onboarding.mode_basic_detail": "Durchsuchen Sie über 6.000 Gesetze ohne KI. Sie interpretieren die Ergebnisse selbst.",

  "gate.sign_in": "Anmelden, um dieses Feature zu nutzen",
  "gate.api_key":
    "Stellen Sie in Einstellungen einen API-Schlüssel ein, um dieses Feature zu nutzen",
  "gate.ai_mode":
    "Wechseln Sie in den AI-Modus in Einstellungen, um dieses Feature zu aktivieren",
  "gate.broker":
    "Starten Sie Ihren lokalen Broker, um den vollständig offlinem AI-Modus zu aktivieren",

  "home.tagline": "Bundesrepublik Deutschland",
  "home.title": "Der Gesetzes-Tresor",
  "home.subtitle":
    "Ein umfassendes Verzeichnis von über 6.000 deutschen Bundesgesetzen.",
  "home.categories": "Kategorien",
  "home.mode_basic": "Grundsuche",
  "home.mode_basic_desc":
    "Suchen Sie in über 6.000 Gesetzen und lesen Sie Auszüge direkt. Keine KI — Sie interpretieren die Ergebnisse.",
  "home.mode_browser": "Browser-KI",
  "home.mode_browser_desc":
    "Die KI läuft direkt in Ihrem Browser über Qwen3. Vollständig privat, keine Serveraufrufe. ~1GB Download.",
  "home.mode_cloud": "Cloud-KI",
  "home.mode_cloud_desc":
    "Bringen Sie Ihren eigenen OpenAI/Anthropic-Schlüssel mit. Beste Qualität, schnellste Antwort. Sie kontrollieren die Abrechnung.",
  "home.mode_local": "Lokale KI",
  "home.mode_local_desc":
    "Verbinden Sie sich mit Ollama auf Ihrem Rechner über den lokalen Broker. Vollständig offline, keine Daten verlassen Ihr Netzwerk.",
  "home.get_started": "Loslegen",

  /* ── Search Bar strings ── */
  "search_bar.mode_search": "Gesetzessuche",
  "search_bar.mode_analyze": "KI-Analyse",

  /* ── Guidance page strings ── */
  "guidance.page_title": "Rechtsberatung",
  "guidance.page_subtitle": "Navigieren Sie durch Ihre Situation",
  "guidance.folder_label": "Fallordner (Optional)",
  "guidance.loading_folder": "Lädt...",
  "guidance.no_folder": "— Kein Ordner ausgewählt —",
  "guidance.situation_label": "Beschreiben Sie Ihre Situation",
  "guidance.situation_placeholder":
    "Beschreiben Sie Ihre rechtliche Situation im Detail. Geben Sie relevante Fakten, Daten, beteiligte Parteien und bereits unternommene Schritte an. Sie können in jeder Sprache schreiben — Deutsch, Englisch, Türkisch, Arabisch, Französisch, Spanisch, Polnisch, Ukrainisch oder Russisch.",
  "guidance.situation_hint":
    "Die KI gleicht deutsche Bundesgesetze mit Ihren Lesezeichen und dem Ordnerkontext ab.",
  "guidance.analyzing": "Situation wird analysiert...",
  "guidance.submit": "Beratung anfordern",
  "guidance.error_title": "Fehler bei der Beratungsgenerierung",
  "guidance.error_retry": "Wiederholen",
  "guidance.empty_title": "Rechtsberatung",
  "guidance.empty_desc":
    "Beschreiben Sie oben Ihre Situation und die KI wird alle über 6.000 deutschen Bundesgesetze analysieren, mit Ihren Lesezeichen und Fallordnern abgleichen und 3-5 konkrete Ergebnispfade mit Risikobewertung, Kostenschätzungen und Schritt-für-Schritt-Anleitungen zurückgeben.",
  "guidance.empty_feature_risk": "Risiko-Badges",
  "guidance.empty_feature_cost": "Kostenschätzungen",
  "guidance.empty_feature_laws": "Zitierte Gesetze",
  "guidance.empty_feature_docs": "Dokumentenerstellung",
  "guidance.success_hint":
    "Dies sind mögliche Wege basierend auf deutschem Recht. Jeder Pfad hat unterschiedliche Risiken, Kosten und Zeitpläne. Klicken Sie auf einen Pfad, um ihn zu erweitern und Schritt-für-Schritt-Anleitungen zu sehen. Sie sind an keine Wahl gebunden — dies dient nur dazu, Ihre Optionen zu verstehen.",
  "guidance.your_paths": "Ihre möglichen Wege vorwärts",
  "guidance.cost_breakdown": "Kostenaufstellung",
  "guidance.paths_shown": "{n} von 5 Pfaden angezeigt",
  "guidance.est_cost": "Geschätzte Kosten",
  "guidance.cost_court_fees": "Gerichtskosten (GKG)",
  "guidance.cost_lawyer_fees": "Anwaltskosten (RVG)",
  "guidance.cost_total_risk": "Gesamtrisiko (im Verlustfall)",
  "guidance.cost_basis":
    "Basierend auf einem Streitwert von €{n} (vereinfachte RVG/GKG-Berechnung). Tatsächliche Kosten können abweichen.",
  "guidance.cited_laws": "Verwendete relevante Gesetze",
  "guidance.cited_click": "Klicken Sie auf ein Gesetz, um den Volltext zu lesen",
  "guidance.gen_doc": "Entwurf erstellen",
  "guidance.gen_doc_progress": "Dokument wird generiert...",
  "guidance.gen_doc_disclaimer":
    "Dies ist ein Entwurf basierend auf Ihrer Situation. Lassen Sie ihn von einem Rechtsanwalt prüfen, bevor Sie ihn offiziell verwenden.",
  "guidance.detailed_analysis": "Detaillierte Analyse",
  "guidance.step_plan": "Schritt-für-Schritt-Plan",
  "guidance.quick_tip": "Kurzer Tipp",
  "guidance.risk_hint": "Grund: {reason}",
  "guidance.remember":
    "Diese Beratung dient nur zu Informationszwecken. Für eine spezifische Rechtsberatung konsultieren Sie einen zugelassenen deutschen Rechtsanwalt.",
  "guidance.save_archives": "Relevante Gesetze in Ihren Archiven speichern",
  "guidance.gen_doc_require_folder":
    "Erstellen Sie zuerst einen Fallordner, um Dokumente zu generieren.",
  "guidance.gen_doc_require_folder_desc":
    "Wählen Sie einen Ordner aus dem Dropdown oben aus oder erstellen Sie einen, und versuchen Sie es dann erneut.",

  /* ── Risk / probability / timeline labels ── */
  "guidance.risk_low": "Wahrscheinlich günstig — Geringes Risiko",
  "guidance.risk_medium": "Ungewiss — Mittleres Risiko",
  "guidance.risk_high": "Erhebliche Hindernisse — Hohes Risiko",
  "guidance.risk_hint_low":
    "Dieser Pfad hat gute Aussichten auf Erfolg. Das Gesetz steht auf Ihrer Seite und die Kosten sind überschaubar.",
  "guidance.risk_hint_medium":
    "Dieser Pfad kann in beide Richtungen gehen. Betrachten Sie es als kalkuliertes Risiko — es gibt gute Argumente auf beiden Seiten. Ein Anwalt kann Ihnen helfen, Ihre tatsächlichen Chancen einzuschätzen.",
  "guidance.risk_hint_high":
    "Dieser Pfad ist ein mühsamer Kampf. Die Gesetzeslage oder die Fakten machen einen Sieg schwierig. Holen Sie professionellen Rat ein, bevor Sie diesen Weg wählen.",
  "guidance.prob_very_promising": "Sehr vielversprechend",
  "guidance.prob_promising": "Vielversprechend",
  "guidance.prob_uncertain": "Ungewiss",
  "guidance.prob_difficult": "Schwierig",
  "guidance.prob_very_difficult": "Sehr schwierig",
  "guidance.timeline_2_6_weeks":
    "Das geht recht schnell. Im deutschen Recht bewegen sich außergerichtliche Schritte meist in diesem Tempo.",
  "guidance.timeline_3_12_months":
    "Gerichtsverfahren dauern in Deutschland. Keine Sorge — die meisten Fälle enden mit einem Vergleich vor dem Urteil.",
  "guidance.timeline_1_4_weeks":
    "Das ist sehr schnell. Gerichte handeln nur bei dringenden Angelegenheiten (Eilverfahren) so zügig.",
  "guidance.timeline_fallback":
    "Zeitpläne in deutschen Rechtsverfahren variieren. Ein Anwalt kann Ihnen eine genauere Schätzung geben.",

  /* ── Guidance history page strings ── */
  "guidance_history.title": "Beratungsverlauf",
  "guidance_history.subtitle": "Fallanalyse",
  "guidance_history.count": "{n} Sitzungen",
  "guidance_history.sign_in_title": "Anmeldung erforderlich",
  "guidance_history.sign_in_desc":
    "Melden Sie sich an, um Ihren Beratungsverlauf zu sehen. Sitzungen werden automatisch gespeichert, wenn Sie angemeldet sind.",
  "guidance_history.sign_in_btn": "Anmelden",
  "guidance_history.loading": "Sitzungen werden geladen",
  "guidance_history.empty_title": "Noch keine Beratungssitzungen",
  "guidance_history.empty_desc":
    "Beschreiben Sie Ihre rechtliche Situation und die KI wird Ergebnispfade generieren. Sitzungen werden automatisch gespeichert, wenn Sie angemeldet sind.",
  "guidance_history.empty_cta": "Situation analysieren",
  "guidance_history.delete": "Sitzung löschen",
  "guidance_history.deleting": "Löschen...",
  "guidance_history.previous": "Zurück",
  "guidance_history.next": "Weiter",
  "guidance_history.page_info": "Seite {current} von {total}",
  "guidance_history.untitled": "Unbenannte Sitzung",
  "guidance_history.incident": "Vorfall: {date}",
  "guidance_history.path": "Pfad {n}: {title}",
  "guidance_history.confirm_delete":
    "Diese Beratungssitzung und alle Ergebnispfade löschen?",

  /* ── Chat page strings ── */
  "chat.limitation_basic":
    "Grundsuche — sucht in Gesetzen und zeigt relevante Ausschnitte. Keine KI-Analyse.",
  "chat.limitation_browser":
    "Browser-KI — lädt bei der ersten Verwendung ein ~1GB Modell herunter. Vollständig privat.",
  "chat.limitation_cloud":
    "Cloud-KI — nutzt Ihren eigenen API-Schlüssel. Abrechnung über Ihren Anbieter.",
  "chat.limitation_local":
    "Lokale KI — funktioniert nur, wenn broker.py + Ollama auf Ihrem Rechner laufen.",
  "chat.conversations": "Gespräche",
  "chat.new_conversation": "Neues Gespräch",
  "chat.type_message": "Geben Sie Ihre rechtliche Frage ein...",
  "chat.config_hint": "Bitte konfigurieren Sie Ihre KI-Einstellungen, um diese Funktion zu nutzen.",

  /* ── Folder modal strings ── */
  "folder.title": "Neuer Fallordner",
  "folder.edit_title": "Fallordner bearbeiten",
  "folder.name_label": "Ordnername",
  "folder.name_placeholder": "z.B. Kündigungsschutzklage",
  "folder.desc_label": "Beschreibung",
  "folder.desc_placeholder": "Kurze Beschreibung des Falls",
  "folder.category_label": "Kategorie",
  "folder.status_label": "Status",
  "folder.incident_date": "Vorfallsdatum",
  "folder.incident_hint": "KI berechnet Fristen ab diesem Datum",
  "folder.deadline_date": "Fristende",
  "folder.deadline_hint": "KI warnt, wenn diese Frist näher rückt",
  "folder.dispute_value": "Streitwert — EUR",
  "folder.dispute_hint": "Wird für Kostenschätzungen verwendet (RVG/GKG)",
  "folder.opposing_party": "Gegenseite",
  "folder.opposing_hint": "KI prüft spezifische Schutzrechte (KSchG, BDSG, etc.)",
  "folder.opposing_placeholder": "z.B. Arbeitgeber, Vermieter",
  "folder.court_name": "Gericht",
  "folder.court_placeholder": "z.B. Arbeitsgericht Berlin",
  "folder.case_number": "Aktenzeichen",
  "folder.case_placeholder": "z.B. 5 Ca 1234/24",
  "folder.notes_label": "Notizen (KI-Kontext)",
  "folder.notes_placeholder":
    "Fügen Sie weiteren Kontext zu Ihrem Fall hinzu. Die KI liest dies bei der Beratungsgenerierung.",
  "folder.notes_hint":
    "Freitext — die KI nutzt dies für die Ergebnispfade",
  "folder.cancel": "Abbrechen",
  "folder.save": "Ordner speichern",
  "folder.saving": "Speichern...",
  "folder.name_required": "Ordnername ist erforderlich.",
  "folder.save_error": "Fehler beim Speichern des Ordners",
  "folder.basic_info": "Basis-Informationen",
  "folder.timeline_value": "Zeitplan & Wert",
  "folder.parties_court": "Parteien & Gericht",

  /* ── Norm viewer strings ── */
  "norm.section": "Paragraf {id}",
  "norm.translating_browser": "Übersetzung via Browser-KI…",
  "norm.translating_cloud": "Übersetzung via Cloud-KI…",
  "norm.translating_local": "Übersetzung via lokaler KI…",
  "norm.translating": "Wird übersetzt…",
  "norm.german_original": "Deutsches Original",
  "norm.translation_unavailable":
    "Übersetzung nicht verfügbar — KI in Einstellungen konfigurieren",
  "norm.translated_to": "Übersetzt nach {lang}",
  "norm.show_translation": "Übersetzung anzeigen",
  "norm.show_german": "Original anzeigen",
  "norm.analyzing": "Gesetz wird analysiert...",
  "norm.translate": "Nach {lang} übersetzen",
  "norm.gate_translate": "Wählen Sie einen KI-Modus in den Einstellungen, um Gesetze zu übersetzen",
  "norm.translation_official": "Offizielle Übersetzung",
  "norm.translation_ai": "KI-Übersetzung",
  "norm.content_summary": "Zusammenfassung",
  "norm.content_context": "Kontext",
  "norm.content_steps": "Schritte",
  "norm.disclaimer": "Vault Intelligence — Vorläufiger, unverbindlicher Bericht",

  /* ── Law detail page strings ── */
  "law_detail.back": "Zurück",
  "law_detail.key_badge": "{key}",
  "law_detail.status": "Status",
  "law_detail.authority": "Zuständigkeit",
  "law_detail.modified": "Geändert",
  "law_detail.density": "Dichte",
  "law_detail.sections": "{n} Paragrafen",
  "law_detail.framework": "Gesetzlicher Rahmen",
  "law_detail.save": "Speichern",
  "law_detail.saved": "Gespeichert",
  "law_detail.save_anon":
    "Lesezeichen lokal gespeichert. Melden Sie sich an, um zu synchronisieren.",
  "law_detail.archive_entry": "Eintrag entfernt",
  "law_detail.loading": "Gesetz wird entschlüsselt...",
};
