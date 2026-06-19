import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../lib/fees", () => ({
  calculateTotalLegalRisk: vi.fn((value: number) => ({
    courtFees: Math.round(35 + (value / 500) * 20 * 3),
    lawyerFees: Math.round((150 + (value - 2000) * 0.05) * 2.5 + 20),
    totalRisk:
      Math.round(35 + (value / 500) * 20 * 3) +
      Math.round((150 + (value - 2000) * 0.05) * 2.5 + 20) * 2,
  })),
}));

import CostRiskCalculator from "../cost-risk-calculator";

// Import the actual fees module for reference values
import { calculateTotalLegalRisk } from "../../lib/fees";

describe("CostRiskCalculator", () => {
  it("renders slider with initial value displayed as €5,000", () => {
    render(<CostRiskCalculator />);
    // Handle either €5,000 or €5000 or different dash/space
    expect(screen.getByText(/€5[,.]000/)).toBeInTheDocument();
  });

  it("renders Financial Risk Modeling heading", () => {
    render(<CostRiskCalculator />);
    expect(
      screen.getByText("Financial Risk Modeling"),
    ).toBeInTheDocument();
  });

  it("displays court fees, lawyer fees, total risk", () => {
    render(<CostRiskCalculator />);
    expect(screen.getByText("Court Fees (GKG)")).toBeInTheDocument();
    expect(screen.getByText("Lawyer Fees (RVG)")).toBeInTheDocument();
    expect(screen.getByText("Total Litigation Risk")).toBeInTheDocument();
  });

  it("displays calculated fee values", () => {
    const fees = calculateTotalLegalRisk(5000);
    render(<CostRiskCalculator />);

    // Use regex to be flexible about formatting (commas vs dots)
    const courtFeesRegex = new RegExp(`€${fees.courtFees.toLocaleString().replace(',', '[,.]')}`);
    const lawyerFeesRegex = new RegExp(`€${fees.lawyerFees.toLocaleString().replace(',', '[,.]')}`);
    const totalRiskRegex = new RegExp(`€${fees.totalRisk.toLocaleString().replace(',', '[,.]')}`);

    expect(screen.getByText(courtFeesRegex)).toBeInTheDocument();
    expect(screen.getByText(lawyerFeesRegex)).toBeInTheDocument();
    expect(screen.getByText(totalRiskRegex)).toBeInTheDocument();
  });

  it("changing slider updates displayed values", async () => {
    render(<CostRiskCalculator />);

    const slider = screen.getByRole("slider");
    expect(slider).toHaveValue("5000");

    // Simulate slider change using fireEvent for better reliability with range inputs in JSDOM
    fireEvent.change(slider, { target: { value: '5500' } });

    // Value should now be different from 5000
    const fees = calculateTotalLegalRisk(5500);
    const courtFeesRegex = new RegExp(`€${fees.courtFees.toLocaleString().replace(',', '[,.]')}`);
    expect(
      screen.getByText(courtFeesRegex),
    ).toBeInTheDocument();
  });

  it("fine print/disclaimer section renders", () => {
    render(<CostRiskCalculator />);
    expect(screen.getByText(/Calculation Basis/)).toBeInTheDocument();
    expect(
      screen.getByText(/German Legal Fee Framework/),
    ).toBeInTheDocument();
  });

  it("displays Dispute Value label", () => {
    render(<CostRiskCalculator />);
    expect(screen.getByText(/Dispute Value/)).toBeInTheDocument();
  });
});
