// src/lib/i18n/fr.ts — French UI Strings
import { EN } from "./en";

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
    "Démarragez votre Ollama et votre brocanteur pour activer le mode de fonctionnement AI entièrement hors connexion",
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
  "gate.sign_in": "Connexion pour utiliser cette fonctionnalité",
  "gate.api_key":
    "Configurez une clé API dans Paramètres pour utiliser cette fonctionnalité",
  "gate.ai_mode":
    "Passer en mode d'AI dans Paramètres pour activer cette fonctionnalité",
  "gate.broker":
    "Démarragez votre brocanteur local pour activer le mode AI local",

  "home.tagline": "Bundesrepublik Deutschland",
  "home.title": "The Law Vault",
  "home.subtitle":
    "A comprehensive repository of over 6,000 German federal statutes.",
  "home.categories": "Categories",
  "home.mode_basic": "Basic Search",
  "home.mode_basic_desc":
    "Search 6,000+ laws and read excerpts directly. No AI \u2014 you interpret the results.",
  "home.mode_browser": "Browser AI",
  "home.mode_browser_desc":
    "AI runs entirely in your browser via Qwen3. Fully private, no server calls. ~1GB download.",
  "home.mode_cloud": "Cloud AI",
  "home.mode_cloud_desc":
    "Bring your own OpenAI/Anthropic key. Best quality, fastest response. You control billing.",
  "home.mode_local": "Local AI",
  "home.mode_local_desc":
    "Connect to Ollama on your machine via the local broker. Fully offline, no data leaves your network.",
  "home.get_started": "Get Started",
};
