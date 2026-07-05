"use client";

import React from "react";
import {
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { DiagnosisResult, calculateDeadline } from "../lib/diagnosis";

interface Step {
  id: string;
  title: string;
  description: string;
  deadline?: Date;
  status: "pending" | "current" | "completed";
}

interface RemediationRoadmapProps {
  diagnosis: DiagnosisResult;
  incidentDate?: string;
}

export default function RemediationRoadmap({
  diagnosis,
  incidentDate,
}: RemediationRoadmapProps) {
  const steps: Step[] = [
    {
      id: "1",
      title: "Initial Analysis",
      description:
        "Situation diagnosed as " + diagnosis.issueType.replace("_", " "),
      status: "completed",
    },
    ...diagnosis.deadlines.map((d, i) => ({
      id: `d-${i}`,
      title: d.label,
      description: `Mandatory deadline under ${d.statute}`,
      deadline: incidentDate
        ? calculateDeadline(new Date(incidentDate), d.days)
        : undefined,
      status: i === 0 ? ("current" as const) : ("pending" as const),
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <CheckCircle2 className="w-6 h-6 text-accent-electric" />
        <h2 className="font-serif font-bold text-2xl text-white">
          Your Resolution Roadmap
        </h2>
      </div>

      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-white/5" />

        <div className="space-y-10">
          {steps.map((step, idx) => (
            <div key={step.id} className="relative pl-12">
              {/* Node */}
              <div
                className={`absolute left-0 top-0 w-10 h-10 flex items-center justify-center border-2 z-10 ${step.status === "completed"
                  ? "bg-accent-electric border-accent-electric text-white"
                  : step.status === "current"
                    ? "bg-[#0d0d0d] border-accent-electric text-accent-electric shadow-[0_0_15px_rgba(0,187,255,0.4)]"
                    : "bg-[#0d0d0d] border-white/10 text-[#6b6b6b]"
                  }`}
              >
                {step.status === "completed" ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="text-xs font-bold">{idx + 1}</span>
                )}
              </div>

              {/* Content */}
              <div
                className={`p-5 glass-panel spotlight-glow transition-all duration-300 ${step.status === "current"
                  ? "border-accent-electric/30 scale-[1.02]"
                  : "border-white/5 opacity-70"
                  }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-white">{step.title}</h3>
                  {step.deadline && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-accent-amber uppercase tracking-widest bg-accent-amber/10 px-2 py-1">
                      <Clock className="w-3 h-3" />
                      Deadline: {step.deadline.toLocaleDateString()}
                    </div>
                  )}
                </div>
                <p className="text-sm text-[#a3a3a3] mb-4">
                  {step.description}
                </p>

                {step.status === "current" && (
                  <button className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent-electric hover:text-white transition-colors">
                    Start this step <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Outcome Simulator Insight */}
      <div className="mt-12 p-6 glass-panel-heavy border border-accent-neon/20 edge-glow-electric">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-accent-amber" />
          <h3 className="font-serif font-bold text-lg text-white">
            Strategic Outcome Simulation
          </h3>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <span className="text-xs text-[#6b6b6b] uppercase font-bold tracking-widest">
              Confidence Score
            </span>
            <span className="text-xl font-serif text-white">
              {Math.round(diagnosis.potentialOutcome.confidence * 100)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/5">
            <div
              className="h-full bg-accent-electric shadow-[0_0_10px_rgba(0,187,255,0.5)] transition-all duration-1000"
              style={{
                width: `${diagnosis.potentialOutcome.confidence * 100}%`,
              }}
            />
          </div>
          <p className="text-sm text-[#a3a3a3] italic">
            &quot;{diagnosis.potentialOutcome.reasoning}&quot;
          </p>
        </div>
      </div>
    </div>
  );
}
