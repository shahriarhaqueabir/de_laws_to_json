"use client";

import { useState, useEffect } from "react";
import { X, FolderPlus, Save, AlertCircle } from "lucide-react";
import type { FolderStatus } from "../lib/guidance";
import { FOLDER_STATUS_LABELS } from "../lib/guidance";

// ── Types ──────────────────────────────────────────────────────────────────

export interface FolderFormData {
  name: string;
  description: string;
  category: string;
  incident_date: string;
  dispute_value: number;
  status: FolderStatus;
  opposing_party: string;
  deadline_date: string;
  court_name: string;
  case_number: string;
  notes: string;
}

const DEFAULT_FORM: FolderFormData = {
  name: "",
  description: "",
  category: "other",
  incident_date: "",
  dispute_value: 0,
  status: "pre_action",
  opposing_party: "",
  deadline_date: "",
  court_name: "",
  case_number: "",
  notes: "",
};

const CATEGORIES = [
  { value: "labor", label: "Arbeitsrecht (Labor)" },
  { value: "housing", label: "Mietrecht (Housing)" },
  { value: "consumer", label: "Verbraucherschutz (Consumer)" },
  { value: "traffic", label: "Verkehrsrecht (Traffic)" },
  { value: "family", label: "Familienrecht (Family)" },
  { value: "criminal", label: "Strafrecht (Criminal)" },
  { value: "finance", label: "Steuerrecht (Finance)" },
  { value: "social", label: "Sozialrecht (Social)" },
  { value: "public", label: "Öffentliches Recht (Public)" },
  { value: "other", label: "Other" },
];

// ── Component ──────────────────────────────────────────────────────────────

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: FolderFormData) => Promise<void>;
  initialData?: Partial<FolderFormData>;
  title?: string;
}

export default function FolderModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  title = "New Case Folder",
}: FolderModalProps) {
  const [form, setForm] = useState<FolderFormData>({
    ...DEFAULT_FORM,
    ...initialData,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm({ ...DEFAULT_FORM, ...initialData });
      setError(null);
    }
  }, [isOpen, initialData]);

  const updateField = <K extends keyof FolderFormData>(
    key: K,
    value: FolderFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Folder name is required.");
      return;
    }

    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save folder");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-panel-heavy border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-white/5 bg-[#0d0d0d]/95 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <FolderPlus className="w-5 h-5 text-accent-cobalt" />
            <h2 className="font-serif font-bold text-xl text-white">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-600 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-900/30 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section: Basic Info */}
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-cobalt/60 mb-4">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">
                  Folder Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="e.g., Wrongful Dismissal Case"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:border-accent-cobalt/50 transition-colors"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Brief description of the case"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:border-accent-cobalt/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => updateField("category", e.target.value)}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-accent-cobalt/50 transition-colors appearance-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    updateField("status", e.target.value as FolderStatus)
                  }
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-accent-cobalt/50 transition-colors appearance-none"
                >
                  {(Object.keys(FOLDER_STATUS_LABELS) as FolderStatus[]).map(
                    (s) => (
                      <option key={s} value={s}>
                        {FOLDER_STATUS_LABELS[s]}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
          </section>

          {/* Section: Timeline & Value */}
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-cobalt/60 mb-4">
              Timeline & Value
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">
                  Incident Date
                </label>
                <input
                  type="date"
                  value={form.incident_date}
                  onChange={(e) =>
                    updateField("incident_date", e.target.value)
                  }
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-accent-cobalt/50 transition-colors"
                />
                <p className="text-[9px] text-zinc-700 mt-1">
                  AI calculates deadlines from this date
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">
                  Deadline Date
                </label>
                <input
                  type="date"
                  value={form.deadline_date}
                  onChange={(e) =>
                    updateField("deadline_date", e.target.value)
                  }
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-accent-cobalt/50 transition-colors"
                />
                <p className="text-[9px] text-zinc-700 mt-1">
                  AI warns when this deadline approaches
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">
                  Dispute Value (Streitwert) — EUR
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.dispute_value || ""}
                  onChange={(e) =>
                    updateField("dispute_value", parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:border-accent-cobalt/50 transition-colors"
                />
                <p className="text-[9px] text-zinc-700 mt-1">
                  Used for cost estimation (RVG/GKG)
                </p>
              </div>
            </div>
          </section>

          {/* Section: Parties & Court */}
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-cobalt/60 mb-4">
              Parties & Court
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">
                  Opposing Party
                </label>
                <input
                  type="text"
                  value={form.opposing_party}
                  onChange={(e) =>
                    updateField("opposing_party", e.target.value)
                  }
                  placeholder="e.g., Employer, Landlord"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:border-accent-cobalt/50 transition-colors"
                />
                <p className="text-[9px] text-zinc-700 mt-1">
                  AI checks specific protections (KSchG, BDSG, etc.)
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">
                  Court Name
                </label>
                <input
                  type="text"
                  value={form.court_name}
                  onChange={(e) => updateField("court_name", e.target.value)}
                  placeholder="e.g., Arbeitsgericht Berlin"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:border-accent-cobalt/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">
                  Case Number (Aktenzeichen)
                </label>
                <input
                  type="text"
                  value={form.case_number}
                  onChange={(e) => updateField("case_number", e.target.value)}
                  placeholder="e.g., 5 Ca 1234/24"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:border-accent-cobalt/50 transition-colors"
                />
              </div>
            </div>
          </section>

          {/* Section: Notes */}
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-cobalt/60 mb-4">
              Notes (AI Context)
            </h3>
            <textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Add any additional context about your case. The AI reads this when generating guidance."
              rows={4}
              className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:border-accent-cobalt/50 transition-colors resize-vertical"
            />
            <p className="text-[9px] text-zinc-700 mt-1">
              Free-text context — the AI reads this when generating guidance
              paths
            </p>
          </section>

          {/* Footer */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] bg-accent-cobalt text-white hover:bg-accent-cobalt/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="animate-pulse">Saving...</span>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Folder
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
