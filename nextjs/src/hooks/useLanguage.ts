/**
 * useLanguage — global language access hook.
 *
 * Reads the user's language preference from ChatContext (→ localStorage).
 * Provides:
 *  - `language`: current AppLanguage
 *  - `setLanguage(lang)`: update language globally
 *  - `t(key)`: translate a known UI string key to the user's language
 */

"use client";

import { useChat } from "../components/chat-context";
import type { AppLanguage } from "../lib/types";

// ── Language-Aware UI Strings ─────────────────────────────────────────────
// These are the hardcoded English status messages used across pages.
// The map provides translations for all 9 supported languages.

const UI_STRINGS: Record<
  string,
  Record<AppLanguage, string>
> = {
  "search.loading": {
    de: "Durchsuche Archiv...",
    en: "Scanning Archives...",
    tr: "Arşiv taranıyor...",
    ar: "جارٍ مسح الأرشيف...",
    fr: "Analyse des archives...",
    es: "Escaneando archivos...",
    pl: "Skanowanie archiwów...",
    uk: "Сканування архіву...",
    ru: "Сканирование архива...",
  },
  "search.results_count": {
    de: "{n} Gesetze gefunden",
    en: "{n} Statutes Retrieved",
    tr: "{n} Yasa Bulundu",
    ar: "تم استرداد {n} قانونًا",
    fr: "{n} Lois trouvées",
    es: "{n} Leyes encontradas",
    pl: "Znaleziono {n} ustaw",
    uk: "Знайдено {n} законів",
    ru: "Найдено {n} законов",
  },
  "search.empty": {
    de: "Keine Gesetze gefunden.",
    en: "No statutes found matching the inquiry parameters.",
    tr: "Sorgu kriterlerine uygun yasa bulunamadı.",
    ar: "لم يتم العثور على قوانين تطابق معايير الاستعلام.",
    fr: "Aucune loi trouvée correspondant aux paramètres.",
    es: "No se encontraron leyes que coincidan.",
    pl: "Nie znaleziono pasujących ustaw.",
    uk: "Не знайдено законів, що відповідають параметрам пошуку.",
    ru: "Не найдено законов, соответствующих параметрам запроса.",
  },
  "search.error": {
    de: "Fehler bei der Suche",
    en: "Failed to fetch search results.",
    tr: "Arama sonuçları alınamadı.",
    ar: "فشل في جلب نتائج البحث.",
    fr: "Échec de la récupération des résultats.",
    es: "Error al obtener resultados.",
    pl: "Nie udało się pobrać wyników wyszukiwania.",
    uk: "Не вдалося отримати результати пошуку.",
    ru: "Не удалось получить результаты поиска.",
  },
  "laws.loading": {
    de: "Entschlüssele Gesetz...",
    en: "Decrypting Statute...",
    tr: "Yasa çözülüyor...",
    ar: "جارٍ فك تشفير القانون...",
    fr: "Déchiffrement de la loi...",
    es: "Descifrando ley...",
    pl: "Odszyfrowywanie ustawy...",
    uk: "Розшифрування закону...",
    ru: "Расшифровка закона...",
  },
  "laws.not_found": {
    de: "Gesetz nicht gefunden",
    en: "Law not found or could not be loaded.",
    tr: "Yasa bulunamadı veya yüklenemedi.",
    ar: "لم يتم العثور على القانون أو تعذر تحميله.",
    fr: "Loi introuvable ou impossible à charger.",
    es: "Ley no encontrada o no se pudo cargar.",
    pl: "Nie znaleziono ustawy lub nie można załadować.",
    uk: "Закон не знайдено або не вдалося завантажити.",
    ru: "Закон не найден или не может быть загружен.",
  },
  "laws.norms_empty": {
    de: "Gesetzesabschnitte nicht im neuronalen Speicher indiziert.",
    en: "Statutory fragments not currently indexed in neural memory.",
    tr: "Yasa parçaları sinirsel bellekte indekslenmemiş.",
    ar: "أجزاء القانون غير مفهرسة حاليًا في الذاكرة العصبية.",
    fr: "Fragments législatifs non indexés dans la mémoire neuronale.",
    es: "Fragmentos legales no indexados en la memoria neuronal.",
    pl: "Fragmenty ustaw nie są obecnie indeksowane w pamięci neuronowej.",
    uk: "Фрагменти законів наразі не індексовані в нейронній пам'яті.",
    ru: "Фрагменты законов в настоящее время не проиндексированы в нейронной памяти.",
  },
  "search.awaiting": {
    de: "Warte auf Anfrage",
    en: "Awaiting Inquiry",
    tr: "Sorgu Bekleniyor",
    ar: "في انتظار الاستعلام",
    fr: "En attente de requête",
    es: "Esperando consulta",
    pl: "Oczekiwanie na zapytanie",
    uk: "Очікування запиту",
    ru: "Ожидание запроса",
  },
  "search.init": {
    de: "Initialisiere Suche...",
    en: "Initializing Search Environment...",
    tr: "Arama Ortamı Başlatılıyor...",
    ar: "جارٍ تهيئة بيئة البحث...",
    fr: "Initialisation de l'environnement de recherche...",
    es: "Inicializando entorno de búsqueda...",
    pl: "Inicjowanie środowiska wyszukiwania...",
    uk: "Ініціалізація середовища пошуку...",
    ru: "Инициализация среды поиска...",
  },
  "guidance.loading": {
    de: "Analysiere Situation...",
    en: "Analyzing Situation...",
    tr: "Durum analiz ediliyor...",
    ar: "جارٍ تحليل الموقف...",
    fr: "Analyse de la situation...",
    es: "Analizando situación...",
    pl: "Analizowanie sytuacji...",
    uk: "Аналіз ситуації...",
    ru: "Анализ ситуации...",
  },
  "common.error": {
    de: "Betriebsfehler",
    en: "Operational Error",
    tr: "Operasyonel Hata",
    ar: "خطأ تشغيلي",
    fr: "Erreur opérationnelle",
    es: "Error operativo",
    pl: "Błąd operacyjny",
    uk: "Операційна помилка",
    ru: "Операционная ошибка",
  },
};

/**
 * useLanguage — reads/writes global language from ChatContext.
 * Provides a `t(key, vars?)` function for translated UI strings.
 */
export function useLanguage() {
  const { settings, updateSettings } = useChat();
  const language = settings.language || "en";

  const setLanguage = (lang: AppLanguage) => {
    updateSettings({ language: lang });
  };

  /**
   * Translate a UI string key to the current language.
   * Supports `{n}` style variable interpolation.
   * Falls back to English if the key or language is not found.
   *
   * @example
   *   t("search.results_count", { n: 12 }) // → "12 Statutes Retrieved"
   */
  const t = (
    key: string,
    vars?: Record<string, string | number>,
  ): string => {
    const translations = UI_STRINGS[key];
    if (!translations) return key;

    let text = translations[language] || translations["en"] || key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  };

  return { language, setLanguage, t };
}
