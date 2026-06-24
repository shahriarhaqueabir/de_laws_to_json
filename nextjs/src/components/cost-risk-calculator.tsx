"use client";

import { useState, useMemo } from "react";
import { Calculator, Info } from "lucide-react";
import { calculateTotalLegalRisk } from "../lib/fees";

export default function CostRiskCalculator() {
  const [disputeValue, setDisputeValue] = useState<number>(5000);

  const fees = useMemo(
    () => calculateTotalLegalRisk(disputeValue),
    [disputeValue],
  );

  return (
    <div className="glass-panel p-8 shadow-premium border-white/5">
      <div className="flex items-center gap-3 mb-8">
        <Calculator className="w-6 h-6 text-accent-cobalt" />
        <h2 className="font-serif font-bold text-2xl text-white">
          Financial Risk Modeling
        </h2>
      </div>

      <div className="space-y-8">
        {/* Input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-[0.2em] text-muted mb-4">
            Dispute Value (Streitwert)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="500"
              max="100000"
              step="500"
              value={disputeValue}
              onChange={(e) => setDisputeValue(Number(e.target.value))}
              className="flex-1 accent-accent-cobalt"
            />
            <div className="w-32 bg-white/5 border border-white/10 px-4 py-2 text-right font-serif text-white">
              €{disputeValue.toLocaleString()}
            </div>
          </div>
          <p className="text-xs text-muted mt-2 flex items-center gap-1">
            <Info className="w-3 h-3" /> This is the total monetary value at
            stake in your dispute.
          </p>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-white/5 border border-white/5">
            <div className="text-xs font-bold text-muted uppercase tracking-widest mb-1">
              Court Fees (GKG)
            </div>
            <div className="text-2xl font-serif text-white">
              €{fees.courtFees.toLocaleString()}
            </div>
            <div className="text-xs text-muted mt-2 uppercase">
              Statutory Anlage 2 GKG
            </div>
          </div>

          <div className="p-4 bg-white/5 border border-white/5">
            <div className="text-xs font-bold text-muted uppercase tracking-widest mb-1">
              Lawyer Fees (RVG)
            </div>
            <div className="text-2xl font-serif text-white">
              €{fees.lawyerFees.toLocaleString()}
            </div>
            <div className="text-xs text-muted mt-2 uppercase">
              Per Instance (1.0 factor)
            </div>
          </div>

          <div className="p-4 bg-accent-cobalt/10 border border-accent-cobalt/20">
            <div className="text-xs font-bold text-accent-cobalt uppercase tracking-widest mb-1">
              Total Litigation Risk
            </div>
            <div className="text-2xl font-serif text-white">
              €{fees.totalRisk.toLocaleString()}
            </div>
            <div className="text-xs text-accent-cobalt/60 mt-2 uppercase font-bold">
              If Case is Lost
            </div>
          </div>
        </div>

        {/* Fine Print */}
        <div className="p-4 bg-tertiary/50 border-l-2 border-l-accent-amber">
          <p className="text-xs text-secondary leading-relaxed">
            <strong>Calculation Basis:</strong> These figures are statutory
            estimates based on the German Legal Fee Framework (RVG & GKG). Total
            risk includes your own lawyer&apos;s fees, the opposing party&apos;s
            lawyer&apos;s fees, and all court costs.
            <em>
              {" "}
              Actual costs may vary depending on out-of-court settlements.
            </em>
          </p>
        </div>
      </div>
    </div>
  );
}
