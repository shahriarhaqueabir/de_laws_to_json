"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Home,
  Briefcase,
  ShoppingCart,
  Truck,
  Users,
  Gavel,
  Landmark,
  HeartPulse,
  Building2,
  Cpu,
  Map,
  HelpCircle,
} from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { translateViaQwen } from "../lib/translate-via-qwen";
import { LANGUAGE_NAMES, type AppLanguage } from "../lib/types";

interface Category {
  key: string;
  name: string;
  labels: Record<AppLanguage, string>;
  icon: React.ComponentType<{ className?: string }>;
}

const categories: Category[] = [
  {
    key: "housing",
    name: "Wohnen & Miete",
    labels: {
      de: "Wohnen & Miete",
      en: "Housing & Rent",
      tr: "Konut & Kira",
      ar: "السكن والإيجار",
      fr: "Logement & Loyer",
      es: "Vivienda & Alquiler",
      pl: "Mieszkanie & Czynsz",
      uk: "Житло & Оренда",
      ru: "Жильё & Аренда",
    },
    icon: Home,
  },
  {
    key: "labor",
    name: "Arbeit & Beruf",
    labels: {
      de: "Arbeit & Beruf",
      en: "Labor & Career",
      tr: "İş & Kariyer",
      ar: "العمل والمهنة",
      fr: "Travail & Carrière",
      es: "Trabajo & Carrera",
      pl: "Praca & Kariera",
      uk: "Робота & Кар'єра",
      ru: "Работа & Карьера",
    },
    icon: Briefcase,
  },
  {
    key: "consumer",
    name: "Einkaufen & Verträge",
    labels: {
      de: "Einkaufen & Verträge",
      en: "Consumer Rights",
      tr: "Tüketici Hakları",
      ar: "حقوق المستهلك",
      fr: "Droits des consommateurs",
      es: "Derechos del consumidor",
      pl: "Prawa konsumenta",
      uk: "Права споживача",
      ru: "Права потребителя",
    },
    icon: ShoppingCart,
  },
  {
    key: "traffic",
    name: "Verkehr & Transport",
    labels: {
      de: "Verkehr & Transport",
      en: "Traffic & Transport",
      tr: "Trafik & Ulaşım",
      ar: "المرور والنقل",
      fr: "Circulation & Transport",
      es: "Tráfico & Transporte",
      pl: "Ruch drogowy & Transport",
      uk: "Дорожній рух & Транспорт",
      ru: "Дорожное движение & Транспорт",
    },
    icon: Truck,
  },
  {
    key: "family",
    name: "Familie & Leben",
    labels: {
      de: "Familie & Leben",
      en: "Family & Life",
      tr: "Aile & Yaşam",
      ar: "العائلة والحياة",
      fr: "Famille & Vie",
      es: "Familia & Vida",
      pl: "Rodzina & Życie",
      uk: "Сім'я & Життя",
      ru: "Семья & Жизнь",
    },
    icon: Users,
  },
  {
    key: "criminal",
    name: "Strafrecht",
    labels: {
      de: "Strafrecht",
      en: "Criminal Law",
      tr: "Ceza Hukuku",
      ar: "القانون الجنائي",
      fr: "Droit pénal",
      es: "Derecho penal",
      pl: "Prawo karne",
      uk: "Кримінальне право",
      ru: "Уголовное право",
    },
    icon: Gavel,
  },
  {
    key: "finance",
    name: "Steuern & Finanzen",
    labels: {
      de: "Steuern & Finanzen",
      en: "Taxes & Finance",
      tr: "Vergiler & Finans",
      ar: "الضرائب والمالية",
      fr: "Impôts & Finance",
      es: "Impuestos & Finanzas",
      pl: "Podatki & Finanse",
      uk: "Податки & Фінанси",
      ru: "Налоги & Финансы",
    },
    icon: Landmark,
  },
  {
    key: "social",
    name: "Gesundheit & Soziales",
    labels: {
      de: "Gesundheit & Soziales",
      en: "Health & Social",
      tr: "Sağlık & Sosyal",
      ar: "الصحة والاجتماعية",
      fr: "Santé & Social",
      es: "Salud & Social",
      pl: "Zdrowie & Społeczne",
      uk: "Здоров'я & Соціальне",
      ru: "Здоровье & Социальное",
    },
    icon: HeartPulse,
  },
  {
    key: "public",
    name: "Staat & Rechte",
    labels: {
      de: "Staat & Rechte",
      en: "Public & Rights",
      tr: "Kamu & Haklar",
      ar: "الدولة والحقوق",
      fr: "État & Droits",
      es: "Estado & Derechos",
      pl: "Państwo & Prawa",
      uk: "Держава & Права",
      ru: "Государство & Права",
    },
    icon: Building2,
  },
  {
    key: "tech",
    name: "Innovation & Umwelt",
    labels: {
      de: "Innovation & Umwelt",
      en: "Tech & Environment",
      tr: "Teknoloji & Çevre",
      ar: "التكنولوجيا والبيئة",
      fr: "Tech & Environnement",
      es: "Tecnología & Medio Ambiente",
      pl: "Technologia & Środowisko",
      uk: "Технології & Довкілля",
      ru: "Технологии & Окружающая среда",
    },
    icon: Cpu,
  },
  {
    key: "berlin",
    name: "Berlin",
    labels: {
      de: "Berlin",
      en: "Berlin Specific",
      tr: "Berlin Özel",
      ar: "برلين الخاصة",
      fr: "Berlin Spécifique",
      es: "Berlín Específico",
      pl: "Berlin Szczególny",
      uk: "Берлін Специфічний",
      ru: "Берлин Специфический",
    },
    icon: Map,
  },
  {
    key: "other",
    name: "Sonstiges",
    labels: {
      de: "Sonstiges",
      en: "Other",
      tr: "Diğer",
      ar: "أخرى",
      fr: "Autre",
      es: "Otro",
      pl: "Inne",
      uk: "Інше",
      ru: "Другое",
    },
    icon: HelpCircle,
  },
];

function CategoryCard({
  cat,
  accentColor,
}: {
  cat: Category;
  accentColor: string;
}) {
  const { language } = useLanguage();
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const staticLabel = cat.labels[language] || cat.labels.en;

  useEffect(() => {
    // Don't translate German to German
    if (language === "de") {
      setTranslated(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    translateViaQwen(cat.name, LANGUAGE_NAMES[language] || "English")
      .then((result) => {
        if (!cancelled) {
          setTranslated(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTranslated(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cat.name, language]);

  return (
    <div className="text-center">
      <cat.icon
        className={`w-6 h-6 mx-auto mb-4 text-zinc-600 group-hover:${accentColor} transition-colors duration-500`}
      />
      <h3 className="font-serif font-bold text-white text-[13px] tracking-tight mb-1">
        {loading ? staticLabel : translated || staticLabel}
      </h3>
      <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">
        {cat.name}
      </p>
    </div>
  );
}

export default function CategoryGrid() {
  const { language } = useLanguage();

  /* Alternating accent colors for visual rhythm */
  const accentCycle = [
    {
      text: "text-accent-gold",
      border: "border-accent-gold",
      bg: "bg-accent-gold",
    },
    {
      text: "text-accent-electric",
      border: "border-accent-electric",
      bg: "bg-accent-electric",
    },
    {
      text: "text-accent-neon",
      border: "border-accent-neon",
      bg: "bg-accent-neon",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
      {categories.map((cat, idx) => {
        const ac = accentCycle[idx % 3];
        return (
          <Link
            key={cat.key}
            href={`/search?category=${cat.key}`}
            className={`p-6 bg-white/[0.01] border border-white/5
                       hover:bg-white/[0.03] hover:border-[var(--accent-gold)]/20
                       transition-all duration-500 group relative overflow-hidden`}
          >
            <div
              className={`absolute top-0 left-0 w-1 h-0 ${ac.bg} group-hover:h-full transition-all duration-700`}
            />
            <CategoryCard cat={cat} accentColor={ac.text} />
          </Link>
        );
      })}
    </div>
  );
}
