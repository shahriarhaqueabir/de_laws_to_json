// src/lib/i18n/fr.ts — French UI Strings

export const FR: Record<string, string> = {
  "search.loading": "Recherche en cours...",
  "search.results_count": "{n} Statuts Trouvés",
  "search.empty":
    "Aucun statut trouvé correspondant aux paramètres de recherche.",
  "search.error": "Échec de la récupération des résultats de recherche.",
  "search.placeholder": "Rechercher les lois allemandes...",
  "search.no_results": "Aucun résultat trouvé",
  "search.awaiting": "En attente d'enquête",
  "search.init": "Initialisation de l'environnement de recherche...",
  "laws.loading": "Déchiffrement de la loi...",
  "laws.not_found": "Loi introuvable ou non chargée.",
  "laws.norms_empty":
    "Des fragments de lois n'ont pas été indexés dans la mémoire neuronale actuelle.",
  "guidance.loading": "Analyse de la situation...",
  "guidance.title": "Conseil juridique",
  "guidance.describe": "Décrire votre situation",
  "guidance.analyze": "Analyser",
  "guidance.no_folder": "Aucun dossier sélectionné",
  "guidance.history": "Historique",
  "common.error": "Erreur opérationnelle",
  "nav.sign_in": "Connexion",
  "nav.sign_out": "Déconnexion",
  "nav.search": "Recherche",
  "nav.guidance": "Conseil juridique",
  "nav.bookmarks": "Signets",
  "nav.chat": "Chat",
  "nav.settings": "Paramètres",
  "nav.laws": "Lois",
  "nav.api_docs": "Docs API",
  "footer.tagline": "Sous la loi, la liberté",
  "footer.copyright":
    "© 2026 Vault de Droit Allemand — Répertoire officiel de l'intelligence juridique",
  "auth.title": "Bienvenue",
  "auth.email": "Adresse e-mail",
  "auth.password": "Mot de passe",
  "auth.sign_in_button": "Connexion",
  "auth.sign_up_button": "Créer un compte",
  "auth.no_account": "N'avez pas de compte?",
  "auth.has_account": "Avez déjà un compte?",
  "auth.error_prefix": "Erreur",
  "chat.title": "Conseiller juridique",
  "chat.placeholder": "Décrivez votre situation juridique...",
  "chat.send": "Envoyer",
  "chat.settings": "Paramètres",
  "chat.local_offline": "Node local hors connexion",
  "chat.startup_hint":
    "Démarragez votre Ollama et votre courtier pour activer le mode de fonctionnement AI entièrement hors connexion",
  "chat.mode_basic": "Fondamental",
  "chat.mode_browser": "Navigateur",
  "chat.mode_cloud": "Nuage",
  "chat.mode_local": "Local",
  "bookmarks.title": "Mes signets",
  "bookmarks.empty": "Aucun signet encore",
  "bookmarks.new_folder": "Nouveau dossier",
  "bookmarks.delete_folder": "Supprimer le dossier",
  "settings.title": "Paramètres",
  "settings.api_key": "Clé API",
  "settings.save": "Enregistrer",
  "settings.remove": "Retirer",
  "settings.provider": "Fournisseur d'AI",
  "settings.model": "Modèle",
  "onboarding.banner_text":
    "Configurez votre conseiller juridique et votre langue en 2 minutes",
  "onboarding.start": "Commencer la configuration",
  "onboarding.dismiss": "Peut-être plus tard",
  "onboarding.welcome_title": "Bienvenue au Vault de Droit Allemand",
  "onboarding.select_language":
    "Sélectionnez votre langue préférée pour l'interface",
  "onboarding.continue": "Continuer",
  "onboarding.step_language": "Langue",
  "onboarding.step_mode": "Mode d'AI",
  "onboarding.step_setup": "Configuration",
  "onboarding.step_features": "Fonctionnalités",
  "onboarding.step_complete": "Tout est prêt",
  "onboarding.api_key_q": "Avez-vous une clé API pour OpenAI ou Anthropic?",
  "onboarding.yes": "Oui",
  "onboarding.no": "Non",
  "onboarding.browser_q":
    "Voulez-vous que l'AI fonctionne entièrement dans votre navigateur?",
  "onboarding.ollama_q": "Avez-vous Ollama installé sur votre ordinateur?",
  "onboarding.recommend_cloud":
    "Nuage AI — meilleure qualité, apportez votre propre clé",
  "onboarding.recommend_browser":
    "Navigateur AI — entièrement privée, fonctionne dans le navigateur (~1GB de téléchargement)",
  "onboarding.recommend_local":
    "AI locale — hors connexion, utilise votre Ollama",
  "onboarding.recommend_basic":
    "Recherche de base — pas d'AI, recherche directe des lois",
  "onboarding.feature_title": "Ce que vous pouvez faire",
  "onboarding.feature_search": "Rechercher plus de 6000 lois à votre portée",
  "onboarding.feature_chat": "Conseiller juridique",
  "onboarding.feature_guidance": "Voies possibles pour votre situation",
  "onboarding.feature_translation": "Lois traduites dans votre langue",
  "onboarding.feature_bookmarks": "Enregistrer et organiser des lois",
  "onboarding.complete_title": "Tout est prêt",
  "onboarding.complete_desc":
    "Vos préférences ont été enregistrées. Commencez à explorer le droit allemand.",
  "onboarding.start_app": "Commencer à utiliser l'application",
  "onboarding.restart": "Recommencer la configuration",
  "onboarding.resume": "Reprendre où vous avez laissé",
  "onboarding.view_guide": "Voir la Guide de configuration",
  "onboarding.completed_on": "Vous avez terminé la configuration le {date}",
  "onboarding.back": "Retour",
  "onboarding.skip_config": "Passer la configuration",
  "onboarding.welcome_desc":
    "Votre passerelle vers plus de 6 000 lois fédérales allemandes avec recherche, traduction et conseils juridiques assistés par IA en 9 langues.",
  "onboarding.mode_select_title": "Choisissez votre mode d'IA",
  "onboarding.mode_select_desc":
    "Choisissez comment interagir avec le droit allemand. Vous pouvez changer à tout moment dans les Paramètres.",
  "onboarding.config_title": "Configurer {mode}",
  "onboarding.config_desc":
    "Configurez votre connexion {mode} avant de commencer.",
  "onboarding.config_cloud":
    "Saisissez votre clé API OpenAI, Anthropic ou compatible. Votre clé est chiffrée et stockée en toute sécurité sur notre serveur.",
  "onboarding.config_local":
    "Connectez-vous à Ollama sur votre machine. Le courtier fonctionne à l'URL ci-dessous, ou Ollama directement sur le port 11434.",
  "onboarding.config_browser":
    "L'IA du navigateur exécute un modèle Qwen3-0.6B (~570 Mo de téléchargement) entièrement dans votre navigateur via Web Workers. Entièrement privé — aucune donnée ne quitte votre machine.",
  "onboarding.config_basic":
    "Aucune configuration nécessaire. Recherchez parmi plus de 6 000 lois et lisez des extraits directement. Les traductions utilisent le même modèle de navigateur que l'IA du Navigateur.",
  "onboarding.api_key_placeholder": "sk-...",
  "onboarding.paste": "Coller",
  "onboarding.test_connection": "Tester la connexion",
  "onboarding.cloud_key_note":
    "La clé est chiffrée et stockée sur le serveur. Jamais transmise à des tiers.",
  "onboarding.local_broker_label": "URL du courtier",
  "onboarding.local_model_label": "Modèle",
  "onboarding.local_status_checking": "Vérification...",
  "onboarding.local_status_connected": "Connecté",
  "onboarding.local_status_offline":
    "Hors ligne — assurez-vous qu'Ollama est en cours d'exécution",
  "onboarding.summary_title": "Récapitulatif de votre configuration",
  "onboarding.summary_desc":
    "Vous êtes prêt à explorer le droit allemand. Voici votre configuration.",
  "onboarding.mode_local": "IA Locale",
  "onboarding.mode_cloud": "IA Cloud",
  "onboarding.mode_browser": "IA Navigateur",
  "onboarding.mode_basic": "Recherche de Base",
  "onboarding.mode_local_detail":
    "Deux modèles : 'german-legal' (6,6 Go) pour l'analyse juridique complète et 'qwen2.5:1.5b-translate' (1 Go) pour les traductions rapides. Entièrement hors ligne.",
  "onboarding.mode_cloud_detail":
    "Apportez votre propre clé API (OpenAI, Anthropic). Meilleure qualité et réponses les plus rapides. Vous contrôlez la facturation.",
  "onboarding.mode_browser_detail":
    "Exécute Qwen3-0.6B dans votre navigateur (~570 Mo de téléchargement). Entièrement privé — aucune donnée ne quitte votre machine. Les 9 langues.",
  "onboarding.mode_basic_detail":
    "Recherchez parmi plus de 6 000 lois et lisez des extraits directement. Pas de génération par IA — vous interprétez les résultats. Toujours disponible, aucune configuration.",

  "gate.sign_in": "Connexion pour utiliser cette fonctionnalité",
  "gate.api_key":
    "Configurez une clé API dans Paramètres pour utiliser cette fonctionnalité",
  "gate.ai_mode":
    "Passer en mode d'AI dans Paramètres pour activer cette fonctionnalité",
  "gate.broker":
    "Démarragez votre courtier local pour activer le mode AI local",

  "home.tagline": "Bundesrepublik Deutschland",
  "home.title": "Le Coffre-fort des Lois",
  "home.subtitle":
    "Un répertoire complet de plus de 6 000 lois fédérales allemandes.",
  "home.categories": "Catégories",
  "home.mode_basic": "Recherche de Base",
  "home.mode_basic_desc":
    "Recherchez plus de 6 000 lois et lisez directement les extraits. Pas d'IA — vous interprétez les résultats.",
  "home.mode_browser": "IA du Navigateur",
  "home.mode_browser_desc":
    "L'IA s'exécute entièrement dans votre navigateur via Qwen3. Entièrement privé, pas d'appels serveur. Téléchargement d'environ 1 Go.",
  "home.mode_cloud": "IA du Cloud",
  "home.mode_cloud_desc":
    "Apportez votre propre clé OpenAI/Anthropic. Meilleure qualité, réponse la plus rapide. Vous contrôlez la facturation.",
  "home.mode_local": "IA Locale",
  "home.mode_local_desc":
    "Connectez-vous à Ollama sur votre machine via le courtier local. Entièrement hors ligne, aucune donnée ne quitte votre réseau.",
  "home.get_started": "Commencer",

  /* ── Search Bar strings ── */
  "search_bar.mode_search": "Recherche de lois",
  "search_bar.mode_analyze": "Analyse IA",

  /* ── Guidance page strings ── */
  "guidance.page_title": "Conseil juridique",
  "guidance.page_subtitle": "Naviguez dans votre situation",
  "guidance.folder_label": "Dossier de cas (Optionnel)",
  "guidance.loading_folder": "Chargement...",
  "guidance.situation_label": "Décrivez votre situation",
  "guidance.situation_placeholder":
    "Décrivez votre situation juridique en détail. Incluez les faits pertinents, les dates, les parties impliquées et les mesures que vous avez déjà prises. Vous pouvez écrire dans n'importe quelle langue — allemand, anglais, turc, arabe, français, espagnol, polonais, ukrainien ou russe.",
  "guidance.situation_hint":
    "L'IA croise les lois fédérales allemandes avec vos signets et le contexte du dossier.",
  "guidance.analyzing": "Analyse de votre situation...",
  "guidance.submit": "Obtenir des conseils",
  "guidance.error_title": "Échec de la génération de conseils",
  "guidance.error_retry": "Réessayer",
  "guidance.empty_title": "Conseil juridique",
  "guidance.empty_desc":
    "Décrivez votre situation ci-dessus et l'IA analysera l'ensemble des 6 000+ lois fédérales allemandes, les croisera avec vos signets et dossiers, et retournera 3 à 5 voies de résolution concrètes avec évaluation des risques, estimation des coûts et étapes détaillées.",
  "guidance.empty_feature_risk": "Badges de risque",
  "guidance.empty_feature_cost": "Estimations de coûts",
  "guidance.empty_feature_laws": "Lois citées",
  "guidance.empty_feature_docs": "Génération de documents",
  "guidance.success_hint":
    "Voici les voies possibles fondées sur le droit allemand. Chaque voie comporte des risques, des coûts et des délais différents. Cliquez sur une voie pour la développer et voir les instructions étape par étape. Vous n'êtes lié à aucun choix — ceci est simplement destiné à vous aider à comprendre vos options.",
  "guidance.your_paths": "Vos voies possibles",
  "guidance.cost_breakdown": "Détail des coûts",
  "guidance.paths_shown": "{n} voies sur 5 affichées",
  "guidance.est_cost": "Coût estimé",
  "guidance.cost_court_fees": "Frais de justice (GKG)",
  "guidance.cost_lawyer_fees": "Honoraires d'avocat (RVG)",
  "guidance.cost_total_risk": "Risque total (en cas de perte)",
  "guidance.cost_basis":
    "Basé sur un Streitwert de €{n} (calcul simplifié RVG/GKG). Les coûts réels peuvent varier.",
  "guidance.cited_laws": "Lois pertinentes utilisées",
  "guidance.cited_click": "Cliquez sur une loi pour lire son texte intégral",
  "guidance.gen_doc": "Générer un projet de document",
  "guidance.gen_doc_progress": "Génération du document...",
  "guidance.gen_doc_disclaimer":
    "Ceci est un projet basé sur votre situation. Faites-le examiner par un avocat (Rechtsanwalt) avant de l'utiliser officiellement.",
  "guidance.detailed_analysis": "Analyse détaillée",
  "guidance.step_plan": "Plan étape par étape",
  "guidance.quick_tip": "Conseil rapide",
  "guidance.risk_hint": "Raison : {reason}",
  "guidance.remember":
    "Ces conseils sont fournis à titre informatif uniquement. Pour un avis juridique spécifique, consultez un avocat allemand agréé (Rechtsanwalt).",
  "guidance.save_archives":
    "Enregistrer les lois pertinentes dans vos archives",
  "guidance.gen_doc_require_folder":
    "Créez d'abord un dossier de cas pour générer des documents.",
  "guidance.gen_doc_require_folder_desc":
    "Sélectionnez ou créez un dossier dans le menu déroulant ci-dessus, puis réessayez.",

  /* ── Risk / probability / timeline labels ── */
  "guidance.risk_low": "Probablement favorable — Risque faible",
  "guidance.risk_medium": "Incertain — Risque modéré",
  "guidance.risk_high": "Obstacles importants — Risque élevé",
  "guidance.risk_hint_low":
    "Cette voie a de bonnes chances de réussir. La loi est de votre côté et les coûts sont gérables.",
  "guidance.risk_hint_medium":
    "Cette voie pourrait tourner dans les deux sens. Considérez-la comme un pari calculé — il y a de bons arguments des deux côtés. Un avocat peut vous aider à évaluer vos chances réelles.",
  "guidance.risk_hint_high":
    "Cette voie est une bataille difficile. La loi ou les faits rendent la victoire difficile. Avant de vous engager, consultez un avocat professionnel pour comprendre ce à quoi vous faites face.",
  "guidance.prob_very_promising": "Très prometteur",
  "guidance.prob_promising": "Prometteur",
  "guidance.prob_uncertain": "Incertain",
  "guidance.prob_difficult": "Difficile",
  "guidance.prob_very_difficult": "Très difficile",
  "guidance.timeline_2_6_weeks":
    "C'est assez rapide. En droit allemand, les démarches extrajudiciaires avancent généralement à ce rythme.",
  "guidance.timeline_3_12_months":
    "Les procès prennent du temps en Allemagne. Ne vous inquiétez pas — la plupart des affaires se règlent avant le procès.",
  "guidance.timeline_1_4_weeks":
    "C'est très rapide. Les tribunaux n'agissent rapidement que pour les affaires urgentes (Eilverfahren).",
  "guidance.timeline_fallback":
    "Les délais dans les procédures juridiques allemandes varient. Un avocat peut vous donner une estimation plus précise pour votre cas spécifique.",

  /* ── Guidance history page strings ── */
  "guidance_history.title": "Historique des conseils",
  "guidance_history.subtitle": "Analyse de cas",
  "guidance_history.count": "{n} Sessions",
  "guidance_history.sign_in_title": "Connexion requise",
  "guidance_history.sign_in_desc":
    "Connectez-vous pour voir votre historique de conseils. Les sessions sont automatiquement sauvegardées lorsque vous êtes connecté.",
  "guidance_history.sign_in_btn": "Se connecter",
  "guidance_history.loading": "Chargement des sessions",
  "guidance_history.empty_title":
    "Aucune session de conseil pour le moment",
  "guidance_history.empty_desc":
    "Décrivez votre situation juridique et l'IA générera 3 à 5 voies de résolution. Les sessions sont automatiquement sauvegardées lorsque vous êtes connecté.",
  "guidance_history.empty_cta": "Analyser une situation",
  "guidance_history.delete": "Supprimer la session",
  "guidance_history.deleting": "Suppression...",
  "guidance_history.previous": "Précédent",
  "guidance_history.next": "Suivant",
  "guidance_history.page_info": "Page {current} sur {total}",
  "guidance_history.untitled": "Session sans titre",
  "guidance_history.incident": "Incident : {date}",
  "guidance_history.path": "Voie {n} : {title}",
  "guidance_history.confirm_delete":
    "Supprimer cette session de conseil et toutes ses voies de résolution?",

  /* ── Chat page strings ── */
  "chat.limitation_basic":
    "Recherche de base — recherche les lois et affiche les extraits pertinents. Pas d'analyse IA.",
  "chat.limitation_browser":
    "IA Navigateur — télécharge un modèle d'environ 1 Go lors de la première utilisation. Entièrement privé.",
  "chat.limitation_cloud":
    "IA Cloud — utilise votre propre clé API. Vous êtes facturé par votre fournisseur.",
  "chat.limitation_local":
    "IA Locale — fonctionne uniquement lorsque broker.py + Ollama sont en cours d'exécution sur votre machine.",
  "chat.conversations": "Conversations",
  "chat.new_conversation": "Nouvelle conversation",
  "chat.type_message": "Tapez votre question juridique...",
  "chat.config_hint":
    "Veuillez configurer vos paramètres d'IA pour utiliser cette fonctionnalité.",

  /* ── Folder modal strings ── */
  "folder.title": "Nouveau dossier de cas",
  "folder.edit_title": "Modifier le dossier de cas",
  "folder.name_label": "Nom du dossier",
  "folder.name_placeholder": "p. ex., Licenciement abusif",
  "folder.desc_label": "Description",
  "folder.desc_placeholder": "Brève description du cas",
  "folder.category_label": "Catégorie",
  "folder.status_label": "Statut",
  "folder.incident_date": "Date de l'incident",
  "folder.incident_hint": "L'IA calcule les délais à partir de cette date",
  "folder.deadline_date": "Date limite",
  "folder.deadline_hint": "L'IA vous avertit lorsque cette date approche",
  "folder.dispute_value":
    "Valeur du litige (Streitwert) — EUR",
  "folder.dispute_hint":
    "Utilisé pour l'estimation des coûts (RVG/GKG)",
  "folder.opposing_party": "Partie adverse",
  "folder.opposing_hint":
    "L'IA vérifie les protections spécifiques (KSchG, BDSG, etc.)",
  "folder.opposing_placeholder": "p. ex., Employeur, Propriétaire",
  "folder.court_name": "Nom du tribunal",
  "folder.court_placeholder": "p. ex., Arbeitsgericht Berlin",
  "folder.case_number": "Numéro de dossier (Aktenzeichen)",
  "folder.case_placeholder": "p. ex., 5 Ca 1234/24",
  "folder.notes_label": "Notes (contexte IA)",
  "folder.notes_placeholder":
    "Ajoutez tout contexte supplémentaire concernant votre cas. L'IA le lit lors de la génération de conseils.",
  "folder.notes_hint":
    "Texte libre — l'IA lit ceci lors de la génération des voies de résolution",
  "folder.cancel": "Annuler",
  "folder.save": "Enregistrer le dossier",
  "folder.saving": "Enregistrement...",
  "folder.name_required": "Le nom du dossier est requis.",
  "folder.save_error": "Échec de l'enregistrement du dossier",
  "folder.basic_info": "Informations de base",
  "folder.timeline_value": "Calendrier et valeur",
  "folder.parties_court": "Parties et tribunal",

  /* ── Norm viewer strings ── */
  "norm.section": "Article {id}",
  "norm.translating_browser": "Traduction via l'IA du navigateur…",
  "norm.translating_cloud": "Traduction via l'IA Cloud…",
  "norm.translating_local": "Traduction via l'IA locale…",
  "norm.translating": "Traduction en cours…",
  "norm.german_original": "Original allemand",
  "norm.translation_unavailable":
    "Traduction indisponible — configurez l'IA dans Paramètres",
  "norm.translated_to": "Traduit en {lang}",
  "norm.show_translation": "Afficher la traduction",
  "norm.show_german": "Afficher l'original allemand",
  "norm.analyzing": "Analyse de la loi...",
  "norm.translate": "Traduire en {lang}",
  "norm.gate_translate":
    "Passez en mode IA dans les Paramètres pour traduire les lois",
  "norm.translation_official": "Traduction officielle",
  "norm.translation_ai": "Traduction IA",
  "norm.content_summary": "Résumé",
  "norm.content_context": "Contexte",
  "norm.content_steps": "Étapes",
  "norm.disclaimer":
    "Vault Intelligence — Rapport préliminaire non contraignant",

  /* ── Law detail page strings ── */
  "law_detail.back": "Retour",
  "law_detail.key_badge": "{key}",
  "law_detail.status": "Statut",
  "law_detail.authority": "Autorité",
  "law_detail.modified": "Modifié",
  "law_detail.density": "Densité",
  "law_detail.sections": "{n} Articles",
  "law_detail.framework": "Cadre juridique",
  "law_detail.save": "Enregistrer",
  "law_detail.saved": "Enregistré",
  "law_detail.save_anon":
    "Signet enregistré localement. Connectez-vous pour synchroniser entre vos appareils.",
  "law_detail.archive_entry": "Entrée d'archive supprimée",
  "law_detail.loading": "Déchiffrement de la loi...",
};
