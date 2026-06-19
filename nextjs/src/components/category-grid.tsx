"use client";
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

const categories = [
  {
    key: "housing",
    name: "Wohnen & Miete",
    en: "Housing & Rent",
    icon: Home,
  },
  {
    key: "labor",
    name: "Arbeit & Beruf",
    en: "Labor & Career",
    icon: Briefcase,
  },
  {
    key: "consumer",
    name: "Einkaufen & Verträge",
    en: "Consumer Rights",
    icon: ShoppingCart,
  },
  {
    key: "traffic",
    name: "Verkehr & Transport",
    en: "Traffic & Transport",
    icon: Truck,
  },
  {
    key: "family",
    name: "Familie & Leben",
    en: "Family & Life",
    icon: Users,
  },
  {
    key: "criminal",
    name: "Strafrecht",
    en: "Criminal Law",
    icon: Gavel,
  },
  {
    key: "finance",
    name: "Steuern & Finanzen",
    en: "Taxes & Finance",
    icon: Landmark,
  },
  {
    key: "social",
    name: "Gesundheit & Soziales",
    en: "Health & Social",
    icon: HeartPulse,
  },
  {
    key: "public",
    name: "Staat & Rechte",
    en: "Public & Rights",
    icon: Building2,
  },
  {
    key: "tech",
    name: "Innovation & Umwelt",
    en: "Tech & Environment",
    icon: Cpu,
  },
  {
    key: "berlin",
    name: "Berlin",
    en: "Berlin Specific",
    icon: Map,
  },
  {
    key: "other",
    name: "Sonstiges",
    en: "Other",
    icon: HelpCircle,
  },
];

export default function CategoryGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
      {categories.map((cat) => (
        <Link
          key={cat.key}
          href={`/search?category=${cat.key}`}
          className="p-6 bg-white/[0.01] border border-white/5
                     hover:bg-white/[0.03] hover:border-accent-gold/20
                     transition-all duration-500 group text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-0 bg-accent-gold group-hover:h-full transition-all duration-700" />
          <cat.icon className="w-6 h-6 mx-auto mb-4 text-zinc-600 group-hover:text-accent-gold transition-colors duration-500" />
          <h3 className="font-serif font-bold text-white text-[13px] tracking-tight mb-1">{cat.name}</h3>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">{cat.en}</p>
        </Link>
      ))}
    </div>
  );
}
