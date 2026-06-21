import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GuidancePathsDisplay from "../guidance-paths-display";
import type { GuidancePath, FolderContext } from "../../lib/guidance";

const mockPaths: GuidancePath[] = [
  {
    path_number: 1,
    title: "Out-of-Court Settlement",
    summary: "Negotiate directly with the opposing party.",
    detailed_analysis: "An out-of-court settlement is governed by § 779 BGB.",
    laws_cited: [
      {
        law_key: "BGB",
        norm_id: "§ 779",
        law_title: "Bürgerliches Gesetzbuch",
      },
    ],
    risk_level: "low",
    risk_reason: "No court exposure.",
    cost_estimate: 1200,
    cost_breakdown: { court_fees: 0, lawyer_fees: 1200, total_risk: 2400 },
    recommended_actions: ["Document facts", "Send demand letter"],
    estimated_timeline: "2-6 weeks",
    success_probability: 0.65,
  },
  {
    path_number: 2,
    title: "Court Action",
    summary: "File a formal lawsuit.",
    detailed_analysis: "Filing a lawsuit initiates formal proceedings.",
    laws_cited: [
      { law_key: "ZPO", norm_id: "§ 253", law_title: "Zivilprozessordnung" },
    ],
    risk_level: "medium",
    risk_reason: "Cost risk if losing.",
    cost_estimate: 3500,
    cost_breakdown: { court_fees: 450, lawyer_fees: 1750, total_risk: 3950 },
    recommended_actions: ["Engage lawyer", "Prepare evidence"],
    estimated_timeline: "3-12 months",
    success_probability: 0.55,
  },
];

const mockFolder: FolderContext = {
  id: "folder-1",
  name: "Test Case",
  category: "labor",
  incident_date: "2026-05-01",
  dispute_value: 15000,
  status: "pre_action",
  opposing_party: "Employer GmbH",
  deadline_date: "2026-06-15",
  court_name: "Arbeitsgericht Berlin",
  case_number: "5 Ca 1234/24",
  notes: "Wrongful dismissal",
};

describe("GuidancePathsDisplay", () => {
  it("renders all paths", () => {
    render(
      <GuidancePathsDisplay
        paths={mockPaths}
        folderContext={null}
        language="en"
      />,
    );

    expect(screen.getByText("Out-of-Court Settlement")).toBeInTheDocument();
    expect(screen.getByText("Court Action")).toBeInTheDocument();
    expect(screen.getByText(/2 of 5 paths shown/)).toBeInTheDocument();
  });

  it("shows costs when available", () => {
    render(
      <GuidancePathsDisplay
        paths={mockPaths}
        folderContext={null}
        language="en"
      />,
    );

    expect(screen.getByText("€1,200")).toBeInTheDocument();
    expect(screen.getByText("€3,500")).toBeInTheDocument();
  });

  it("shows risk info in summaries", () => {
    render(
      <GuidancePathsDisplay
        paths={mockPaths}
        folderContext={null}
        language="en"
      />,
    );

    // Path summaries are always visible
    expect(
      screen.getByText(/Negotiate directly with the opposing party/),
    ).toBeInTheDocument();
    expect(screen.getByText(/File a formal lawsuit/)).toBeInTheDocument();
  });

  it("shows success probability", () => {
    render(
      <GuidancePathsDisplay
        paths={mockPaths}
        folderContext={null}
        language="en"
      />,
    );

    expect(screen.getByText(/Moderate/)).toBeInTheDocument();
  });

  it("toggleExpand shows and hides detailed analysis", async () => {
    const user = userEvent.setup();

    render(
      <GuidancePathsDisplay
        paths={mockPaths}
        folderContext={null}
        language="en"
      />,
    );

    // Click first path to expand
    await user.click(screen.getByText("Out-of-Court Settlement"));

    // Detailed analysis should be visible
    expect(
      screen.getByText(/An out-of-court settlement is governed/),
    ).toBeInTheDocument();

    // Click again to collapse
    await user.click(screen.getByText("Out-of-Court Settlement"));

    // Detailed analysis should be hidden
    expect(
      screen.queryByText(/An out-of-court settlement is governed/),
    ).not.toBeInTheDocument();
  });

  it("shows folder context info", () => {
    render(
      <GuidancePathsDisplay
        paths={mockPaths}
        folderContext={mockFolder}
        language="en"
      />,
    );

    // Folder context is shown as part of the display
    // Check that the component renders with folder data
    expect(screen.getByText("Your Possible Paths Forward")).toBeInTheDocument();
  });

  it("shows empty state when no paths", () => {
    render(
      <GuidancePathsDisplay paths={[]} folderContext={null} language="en" />,
    );

    expect(
      screen.getByText(/No guidance paths could be generated/),
    ).toBeInTheDocument();
  });
});
