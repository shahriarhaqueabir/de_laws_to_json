'use client';
import Link from 'next/link';
import {
  Home, Briefcase, ShoppingCart, Truck, Users,
  Gavel, Landmark, HeartPulse, Building2, Cpu, Map, HelpCircle
} from 'lucide-react';

const categories = [
  { key: 'housing', name: 'Wohnen & Miete', en: 'Housing & Rent', icon: Home, color: 'text-blue-600' },
  { key: 'labor', name: 'Arbeit & Beruf', en: 'Labor & Career', icon: Briefcase, color: 'text-orange-600' },
  { key: 'consumer', name: 'Einkaufen & Verträge', en: 'Consumer Rights', icon: ShoppingCart, color: 'text-green-600' },
  { key: 'traffic', name: 'Verkehr & Transport', en: 'Traffic & Transport', icon: Truck, color: 'text-red-600' },
  { key: 'family', name: 'Familie & Leben', en: 'Family & Life', icon: Users, color: 'text-pink-600' },
  { key: 'criminal', name: 'Strafrecht', en: 'Criminal Law', icon: Gavel, color: 'text-purple-600' },
  { key: 'finance', name: 'Steuern & Finanzen', en: 'Taxes & Finance', icon: Landmark, color: 'text-amber-600' },
  { key: 'social', name: 'Gesundheit & Soziales', en: 'Health & Social', icon: HeartPulse, color: 'text-rose-600' },
  { key: 'public', name: 'Staat & Rechte', en: 'Public & Rights', icon: Building2, color: 'text-indigo-600' },
  { key: 'tech', name: 'Innovation & Umwelt', en: 'Tech & Environment', icon: Cpu, color: 'text-cyan-600' },
  { key: 'berlin', name: 'Berlin', en: 'Berlin Specific', icon: Map, color: 'text-red-700' },
  { key: 'other', name: 'Sonstiges', en: 'Other', icon: HelpCircle, color: 'text-slate-600' },
];

export default function CategoryGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-12">
      {categories.map((cat) => (
        <Link
          key={cat.key}
          href={`/search?category=${cat.key}`}
          className="p-4 bg-[#1a1a1a] rounded-none border border-[#2a2a2a]
                               hover:border-[#c4a86a] transition-all group text-center"
        >
          <cat.icon className={`w-8 h-8 mx-auto mb-3 ${cat.color} group-hover:scale-110 transition-transform`} />
          <h3 className="font-semibold text-[#e8e6e3] text-sm">{cat.name}</h3>
                    <p className="text-xs text-[#a09e9a]">{cat.en}</p>
        </Link>
      ))}
    </div>
  );
}
