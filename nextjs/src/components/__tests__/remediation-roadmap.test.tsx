import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DiagnosisResult } from "../../lib/diagnosis";
import { calculateDeadline } from "../../lib/diagnosis";

import RemediationRoadmap from "../remediation-roadmap";

const mockDiagnosis: DiagnosisResult = {
  category: "labor",
  issueType: "wrongful_dismissal",
  deadlines: [
    {
      label: "File suit with Labor Court (Kündigungsschutzklage)",
      days: 21,
      statute: "§ 4 KSchG",
    },
    {
      label: "Submit evidence to court",
      days: 30,
      statute: "§ 5 KSchG",
    },
  ],
  potentialOutcome: {
    label: "High Protection",
    confidence: 0.8,
    reasoning:
      "KSchG (Dismissal Protection Act) applies because the company has > 10 employees.",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RemediationRoadmap", () => {
  it("renders 'Your Resolution Roadmap' heading", () => {
    render(<RemediationRoadmap diagnosis={mockDiagnosis} />);
    expect(screen.getByText("Your Resolution Roadmap")).toBeInTheDocument();
  });

  it("shows timeline steps from diagnosis.deadlines", () => {
    render(<RemediationRoadmap diagnosis={mockDiagnosis} />);
    expect(
      screen.getByText(
        "File suit with Labor Court (Kündigungsschutzklage)",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Submit evidence to court"),
    ).toBeInTheDocument();
  });

  it("displays deadline statute references", () => {
    render(<RemediationRoadmap diagnosis={mockDiagnosis} />);
    expect(
      screen.getByText(/Mandatory deadline under § 4 KSchG/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Mandatory deadline under § 5 KSchG/),
    ).toBeInTheDocument();
  });

  it("shows Initial Analysis step with completed status", () => {
    render(<RemediationRoadmap diagnosis={mockDiagnosis} />);
    expect(screen.getByText("Initial Analysis")).toBeInTheDocument();
    expect(
      screen.getByText(/Situation diagnosed as wrongful dismissal/),
    ).toBeInTheDocument();
  });

  it("deadline date displayed when incidentDate provided", () => {
    const incidentDate = "2025-06-01";
    render(
      <RemediationRoadmap
        diagnosis={mockDiagnosis}
        incidentDate={incidentDate}
      />,
    );

    const expectedDeadline = calculateDeadline(
      new Date(incidentDate),
      21,
    );
    expect(
      screen.getByText(
        `Deadline: ${expectedDeadline.toLocaleDateString()}`,
      ),
    ).toBeInTheDocument();
  });

  it("does not show deadline dates when incidentDate is not provided", () => {
    render(<RemediationRoadmap diagnosis={mockDiagnosis} />);
    expect(screen.queryByText(/Deadline:/)).not.toBeInTheDocument();
  });

  it("outcome simulator shows confidence score as percentage", () => {
    render(<RemediationRoadmap diagnosis={mockDiagnosis} />);
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("outcome simulator shows reasoning quote", () => {
    render(<RemediationRoadmap diagnosis={mockDiagnosis} />);
    const expectedReasoning =
      /KSchG \(Dismissal Protection Act\) applies/;
    expect(screen.getByText(expectedReasoning)).toBeInTheDocument();
  });

  it("incident date updates multiple deadline dates", () => {
    const incidentDate = "2025-06-15";
    render(
      <RemediationRoadmap
        diagnosis={mockDiagnosis}
        incidentDate={incidentDate}
      />,
    );

    const deadline1 = calculateDeadline(new Date(incidentDate), 21);
    const deadline2 = calculateDeadline(new Date(incidentDate), 30);

    expect(
      screen.getByText(
        `Deadline: ${deadline1.toLocaleDateString()}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Deadline: ${deadline2.toLocaleDateString()}`,
      ),
    ).toBeInTheDocument();
  });

  it("renders Strategic Outcome Simulation section", () => {
    render(<RemediationRoadmap diagnosis={mockDiagnosis} />);
    expect(
      screen.getByText("Strategic Outcome Simulation"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Confidence Score"),
    ).toBeInTheDocument();
  });

  it("renders start step button for current step", () => {
    render(<RemediationRoadmap diagnosis={mockDiagnosis} />);
    expect(screen.getByText("Start this step")).toBeInTheDocument();
  });
});
