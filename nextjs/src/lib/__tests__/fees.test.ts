import { describe, it, expect } from "vitest";
import {
  calculateCourtFees,
  calculateLawyerFees,
  calculateTotalLegalRisk,
} from "../fees";

describe("calculateCourtFees", () => {
  it("returns 38 for dispute value <= 500", () => {
    expect(calculateCourtFees(0)).toBe(38);
    expect(calculateCourtFees(500)).toBe(38);
  });

  it("returns 58 for dispute value between 501 and 1000", () => {
    expect(calculateCourtFees(501)).toBe(58);
    expect(calculateCourtFees(1000)).toBe(58);
  });

  it("returns 78 for dispute value between 1001 and 1500", () => {
    expect(calculateCourtFees(1001)).toBe(78);
    expect(calculateCourtFees(1500)).toBe(78);
  });

  it("returns 98 for dispute value between 1501 and 2000", () => {
    expect(calculateCourtFees(1501)).toBe(98);
    expect(calculateCourtFees(2000)).toBe(98);
  });

  it("calculates approximately for high values", () => {
    const high = calculateCourtFees(10000);
    expect(high).toBeGreaterThan(98);
    // baseFee = 35 + (10000 / 500) * 20 = 35 + 400 = 435; 435 * 3 = 1305
    expect(high).toBe(1305);
  });

  it("handles zero dispute value", () => {
    expect(calculateCourtFees(0)).toBe(38);
  });
});

describe("calculateLawyerFees", () => {
  it("returns 49 base for dispute value <= 500", () => {
    // 49 * 2.5 + 20 = 142.5 -> 143
    expect(calculateLawyerFees(0)).toBe(143);
    expect(calculateLawyerFees(500)).toBe(143);
  });

  it("returns 88 base for dispute value between 501 and 1000", () => {
    // 88 * 2.5 + 20 = 240
    expect(calculateLawyerFees(501)).toBe(240);
    expect(calculateLawyerFees(1000)).toBe(240);
  });

  it("returns 150 base for dispute value between 1001 and 2000", () => {
    // 150 * 2.5 + 20 = 395
    expect(calculateLawyerFees(1001)).toBe(395);
    expect(calculateLawyerFees(2000)).toBe(395);
  });

  it("calculates for high values above 2000", () => {
    // baseFee = 150 + (5000 - 2000) * 0.05 = 150 + 150 = 300
    // 300 * 2.5 + 20 = 770
    expect(calculateLawyerFees(5000)).toBe(770);
  });
});

describe("calculateTotalLegalRisk", () => {
  it("returns court + lawyer * 2 formula", () => {
    const result = calculateTotalLegalRisk(1000);
    // court = 58, lawyer = 240
    // total = 58 + 240 * 2 = 538
    expect(result.courtFees).toBe(58);
    expect(result.lawyerFees).toBe(240);
    expect(result.totalRisk).toBe(58 + 240 * 2);
  });

  it("handles zero dispute value", () => {
    const result = calculateTotalLegalRisk(0);
    expect(result.courtFees).toBe(38);
    expect(result.lawyerFees).toBe(143);
    expect(result.totalRisk).toBe(38 + 143 * 2);
  });

  it("returns correct LegalFees structure", () => {
    const result = calculateTotalLegalRisk(1500);
    expect(result).toHaveProperty("courtFees");
    expect(result).toHaveProperty("lawyerFees");
    expect(result).toHaveProperty("totalRisk");
  });
});
