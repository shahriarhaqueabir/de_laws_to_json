import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { Diagnostics } from "../diagnostic";

describe("Diagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders mount state after mount", async () => {
    render(<Diagnostics />);
    expect(await screen.findByText(/mounted ✓/)).toBeInTheDocument();
  });

  it("renders hydration state after mount", async () => {
    render(<Diagnostics />);
    expect(await screen.findByText(/Hydrated: ✓/)).toBeInTheDocument();
  });

  it("shows body className and background info after hydration", async () => {
    document.body.className = "test-body-class";
    render(<Diagnostics />);

    await waitFor(() => {
      const info = screen.getByText(/^cls=/);
      expect(info).toBeInTheDocument();
      expect(info.textContent).toContain("cls=test-body-class");
    });
  });

  it("captures error events and displays them in the panel", async () => {
    render(<Diagnostics />);
    await screen.findByText(/mounted ✓/);

    act(() => {
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "Something went wrong",
          filename: "http://localhost/test.js",
          lineno: 42,
        }),
      );
    });

    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
    expect(await screen.findByText(/test\.js:42/)).toBeInTheDocument();
  });

  it("increments error count when multiple errors fire", async () => {
    render(<Diagnostics />);
    await screen.findByText(/mounted ✓/);

    act(() => {
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "Err 1",
          filename: "a.js",
          lineno: 1,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "Err 2",
          filename: "b.js",
          lineno: 2,
        }),
      );
    });

    expect(await screen.findByText(/Errors \(2\)/)).toBeInTheDocument();
  });

  it("uses unique IDs for multiple instances", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    render(
      <>
        <Diagnostics />
        <Diagnostics />
      </>,
    );

    // Wait for both to mount
    const mounted = await screen.findAllByText(/mounted ✓/);
    expect(mounted).toHaveLength(2);

    const mountLogs = logSpy.mock.calls.filter(
      (call) =>
        typeof call[0] === "string" && call[0].includes("Diagnostics mounted"),
    );

    expect(mountLogs).toHaveLength(2);

    const ids = mountLogs.map((call) => {
      const match = (call[0] as string).match(/\[DIAG\]\s+\[([^\]]+)\]/);
      return match ? match[1] : null;
    });

    expect(ids[0]).not.toBeNull();
    expect(ids[1]).not.toBeNull();
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("shows red background when errors exist", async () => {
    render(<Diagnostics />);
    await screen.findByText(/mounted ✓/);

    act(() => {
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "Display error",
          filename: "f.js",
          lineno: 1,
        }),
      );
    });

    await screen.findByText(/Display error/);

    const panel = screen.getByText(/mounted ✓/).closest('[id="diag-panel"]');
    expect(panel).toHaveStyle({ background: "#cc3333" });
  });

  it("shows dark background when no errors", async () => {
    render(<Diagnostics />);
    await screen.findByText(/mounted ✓/);

    const panel = screen.getByText(/mounted ✓/).closest('[id="diag-panel"]');
    expect(panel).toHaveStyle({ background: "#1a1a1a" });
  });

  it("cleans up error listener on unmount", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = render(<Diagnostics />);
    await screen.findByText(/mounted ✓/);

    expect(addSpy).toHaveBeenCalledWith("error", expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("error", expect.any(Function));
  });
});
