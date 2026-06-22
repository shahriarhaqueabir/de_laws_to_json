/**
 * Guided Fact-InTake & Diagnosis Engine
 */

export interface Question {
  id: string;
  text: string;
  type: "choice" | "date" | "number" | "text";
  options?: { label: string; value: string }[];
  nextId?: string | ((answer: string | number | boolean | null) => string);
}

export interface SituationData {
  notice_received?: string;
  date_received?: string;
  employee_count?: string;
  [key: string]: string | number | boolean | undefined | null;
}

export interface DiagnosisResult {
  category: string;
  issueType: string;
  deadlines: {
    label: string;
    days: number;
    statute: string;
  }[];
  potentialOutcome: {
    label: string;
    confidence: number;
    reasoning: string;
  };
}

/**
 * Example Flow for Labor Law (Wrongful Dismissal)
 */
export const LABOR_DIAGNOSIS_FLOW: Record<string, Question> = {
  start: {
    id: "notice_received",
    text: "Did you receive a written notice of termination?",
    type: "choice",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
    nextId: (ans) => (ans === "yes" ? "date_received" : "not_dismissed"),
  },
  date_received: {
    id: "date_received",
    text: "When did you receive the notice?",
    type: "date",
    nextId: "employee_count",
  },
  employee_count: {
    id: "employee_count",
    text: "How many employees (excluding trainees) work at the company?",
    type: "choice",
    options: [
      { label: "10 or fewer", value: "small" },
      { label: "More than 10", value: "large" },
    ],
    nextId: "end",
  },
};

export function calculateDeadline(incidentDate: Date, days: number): Date {
  const result = new Date(incidentDate);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Determines the legal roadmap based on situation data
 */
export function diagnoseCase(
  category: string,
  data: SituationData,
): DiagnosisResult {
  const result: DiagnosisResult = {
    category,
    issueType: "general",
    deadlines: [],
    potentialOutcome: { label: "Inconclusive", confidence: 0, reasoning: "" },
  };

  if (category === "labor" && data.notice_received === "yes") {
    result.issueType = "wrongful_dismissal";
    result.deadlines.push({
      label: "File suit with Labor Court (Kündigungsschutzklage)",
      days: 21,
      statute: "§ 4 KSchG",
    });

    if (data.employee_count === "large") {
      result.potentialOutcome = {
        label: "High Protection",
        confidence: 0.8,
        reasoning:
          "KSchG (Dismissal Protection Act) applies because the company has > 10 employees.",
      };
    } else {
      result.potentialOutcome = {
        label: "Limited Protection",
        confidence: 0.6,
        reasoning:
          'Company is classified as a "Kleinbetrieb". General protection applies, but not the specific KSchG requirements.',
      };
    }
  }

  return result;
}
