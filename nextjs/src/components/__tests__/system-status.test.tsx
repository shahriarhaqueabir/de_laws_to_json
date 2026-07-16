import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SystemStatus } from "../system-status";

// ── Hoisted mock state ──
const mockStatus = vi.hoisted(() => ({
  overall: "ok",
  services: [
    { label: "Database", status: "ok", message: "Connected" },
    { label: "Vector Search", status: "ok", message: "Active" },
    { label: "Authentication", status: "warn", message: "Not signed in" },
  ],
  mode: "basic",
  lastChecked: new Date().toISOString(),
}));

vi.mock("../../hooks/useSystemStatus", () => ({
  useSystemStatus: () => mockStatus,
}));

vi.mock("../chat-context", () => ({
  useChat: () => ({
    settings: { brokerUrl: "http://localhost:11434" },
  }),
}));

describe("SystemStatus", () => {
  beforeEach(() => {
    mockStatus.overall = "ok";
    mockStatus.services = [
      { label: "Database", status: "ok", message: "Connected" },
      { label: "Vector Search", status: "ok", message: "Active" },
      { label: "Authentication", status: "warn", message: "Not signed in" },
    ];
    mockStatus.mode = "basic";
  });

  // ── Compact variant ──

  describe("compact variant", () => {
    it("renders a status dot", () => {
      const { container } = render(<SystemStatus compact />);
      // Should have a rounded-full span (the dot)
      const dot = container.querySelector(".rounded-full");
      expect(dot).toBeInTheDocument();
    });

    it("has a title attribute with overall status", () => {
      render(<SystemStatus compact />);
      const el = screen.getByTitle(/SYSTEM: OK/i);
      expect(el).toBeInTheDocument();
    });

    it("shows tooltip on hover", () => {
      render(<SystemStatus compact />);
      const el = screen.getByTitle(/SYSTEM: OK/i);
      fireEvent.mouseEnter(el);
      // Tooltip should contain service labels
      expect(screen.getByText("Database")).toBeInTheDocument();
      expect(screen.getByText("Vector Search")).toBeInTheDocument();
    });

    it("hides tooltip on mouse leave", () => {
      render(<SystemStatus compact />);
      const el = screen.getByTitle(/SYSTEM: OK/i);
      fireEvent.mouseEnter(el);
      expect(screen.getByText("Database")).toBeInTheDocument();
      fireEvent.mouseLeave(el);
      expect(screen.queryByText("Database")).not.toBeInTheDocument();
    });
  });

  // ── Panel variant ──

  describe("panel variant", () => {
    it("renders all service rows", () => {
      render(<SystemStatus panel />);
      expect(screen.getByText("Database")).toBeInTheDocument();
      expect(screen.getByText("Vector Search")).toBeInTheDocument();
      expect(screen.getByText("Authentication")).toBeInTheDocument();
    });

    it("shows status symbols for each service", () => {
      render(<SystemStatus panel />);
      // "ok" services show ✓ (2 services), "warn" shows △
      const okSymbols = screen.getAllByText("✓");
      expect(okSymbols).toHaveLength(2);
      expect(screen.getByText("△")).toBeInTheDocument();
    });

    it("shows header with System label", () => {
      render(<SystemStatus panel />);
      expect(screen.getByText("System")).toBeInTheDocument();
    });

    it("toggles details on button click", () => {
      render(<SystemStatus panel />);
      const btn = screen.getByText("Show Details");
      fireEvent.click(btn);
      expect(screen.getByText("Hide Details")).toBeInTheDocument();
      // Detail messages should be visible
      expect(screen.getByText(/Connected/)).toBeInTheDocument();
      // Click again to hide
      fireEvent.click(screen.getByText("Hide Details"));
      expect(screen.getByText("Show Details")).toBeInTheDocument();
    });

    it("shows last checked timestamp in details", () => {
      render(<SystemStatus panel />);
      fireEvent.click(screen.getByText("Show Details"));
      expect(screen.getByText(/Last checked/i)).toBeInTheDocument();
    });
  });

  // ── Mode-specific display ──

  it("displays current mode label in panel header", () => {
    mockStatus.mode = "local";
    render(<SystemStatus panel />);
    expect(screen.getByText("Local AI (Ollama)")).toBeInTheDocument();
  });

  it("displays fallback mode string for unknown modes", () => {
    mockStatus.mode = "custom";
    render(<SystemStatus panel />);
    expect(screen.getByText("custom")).toBeInTheDocument();
  });

  // ── Status colour helpers via DOM ──

  it("renders green dot for ok status", () => {
    mockStatus.overall = "ok";
    const { container } = render(<SystemStatus compact />);
    const dot = container.querySelector(".rounded-full");
    expect(dot?.className).toContain("bg-emerald-400");
  });

  it("renders yellow dot for warn status", () => {
    mockStatus.overall = "warn";
    const { container } = render(<SystemStatus compact />);
    const dot = container.querySelector(".rounded-full");
    expect(dot?.className).toContain("bg-yellow-400");
  });

  it("renders red dot for error status", () => {
    mockStatus.overall = "error";
    const { container } = render(<SystemStatus compact />);
    const dot = container.querySelector(".rounded-full");
    expect(dot?.className).toContain("bg-red-400");
  });

  it("renders grey dot for unknown status", () => {
    mockStatus.overall = "unknown";
    const { container } = render(<SystemStatus compact />);
    const dot = container.querySelector(".rounded-full");
    expect(dot?.className).toContain("bg-zinc-600");
  });

  // ── Edge cases ──

  it("handles empty services array", () => {
    mockStatus.services = [];
    render(<SystemStatus panel />);
    // Should still render the panel header
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("shows error symbol for error status", () => {
    mockStatus.services = [
      { label: "Database", status: "error" as const, message: "Connection failed" },
    ];
    render(<SystemStatus panel />);
    expect(screen.getByText("✗")).toBeInTheDocument();
  });

  it("shows question mark for unknown status", () => {
    mockStatus.services = [
      { label: "Database", status: "unknown" as const, message: "Not checked" },
    ];
    render(<SystemStatus panel />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
