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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-12">
      {categories.map((cat) => (
        <Link
          key={cat.key}
          href={`/search?category=${cat.key}`}
          className="p-4 bg-[#141414] border border-[#2a2a2a]
                     shadow-[0_1px_3px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.4)]
                     hover:shadow-[0_4px_12px_rgba(0,0,0,0.7),0_2px_4px_rgba(0,0,0,0.5)]
                     hover:border-[#888888] transition-shadow group text-center"
        >
          <cat.icon className="w-8 h-8 mx-auto mb-3 text-[#888888] group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-[#e8e8e8] text-sm">{cat.name}</h3>
          <p className="text-xs text-[#a3a3a3]">{cat.en}</p>
        </Link>
      ))}
    </div>
  );
}
