import { describe, it, expect } from "vitest";
import { calculateDeadline, diagnoseCase } from "../diagnosis";

describe("calculateDeadline", () => {
  it("adds days correctly within the same month", () => {
    const start = new Date("2025-06-01");
    const result = calculateDeadline(start, 10);
    expect(result.getDate()).toBe(11);
    expect(result.getMonth()).toBe(5); // June
  });

  it("wraps to the next month", () => {
    const start = new Date("2025-06-25");
    const result = calculateDeadline(start, 10);
    expect(result.getDate()).toBe(5);
    expect(result.getMonth()).toBe(6); // July
  });

  it("wraps to the next year", () => {
    const start = new Date("2025-12-25");
    const result = calculateDeadline(start, 10);
    expect(result.getDate()).toBe(4);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getFullYear()).toBe(2026);
  });
});

describe("diagnoseCase", () => {
  it("labor + notice_received=yes returns wrongful_dismissal issueType", () => {
    const result = diagnoseCase("labor", { notice_received: "yes" });

    expect(result.category).toBe("labor");
    expect(result.issueType).toBe("wrongful_dismissal");
    expect(result.deadlines).toHaveLength(1);
    expect(result.deadlines[0].label).toContain("Kündigungsschutzklage");
    expect(result.deadlines[0].days).toBe(21);
    expect(result.deadlines[0].statute).toBe("§ 4 KSchG");
  });

  it("labor + large employee_count gives High Protection", () => {
    const result = diagnoseCase("labor", {
      notice_received: "yes",
      employee_count: "large",
    });

    expect(result.potentialOutcome.label).toBe("High Protection");
    expect(result.potentialOutcome.confidence).toBe(0.8);
    expect(result.potentialOutcome.reasoning).toContain("> 10 employees");
  });

  it("labor + small employee_count gives Limited Protection", () => {
    const result = diagnoseCase("labor", {
      notice_received: "yes",
      employee_count: "small",
    });

    expect(result.potentialOutcome.label).toBe("Limited Protection");
    expect(result.potentialOutcome.confidence).toBe(0.6);
    expect(result.potentialOutcome.reasoning).toContain("Kleinbetrieb");
  });

  it("labor + no notice_received gives Inconclusive", () => {
    const result = diagnoseCase("labor", {
      notice_received: "no",
    });

    expect(result.issueType).toBe("general");
    expect(result.potentialOutcome.label).toBe("Inconclusive");
    expect(result.potentialOutcome.confidence).toBe(0);
  });

  it("unknown category returns defaults", () => {
    const result = diagnoseCase("traffic", {});

    expect(result.category).toBe("traffic");
    expect(result.issueType).toBe("general");
    expect(result.deadlines).toHaveLength(0);
    expect(result.potentialOutcome.label).toBe("Inconclusive");
  });
});
