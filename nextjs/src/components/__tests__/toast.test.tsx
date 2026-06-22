import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { toast, Toaster } from "sonner";

// Simple test to verify sonner toast integration
// Sonner is tested upstream — we just verify it mounts without error

function TestComponent() {
  return (
    <div>
      <button onClick={() => toast("Simple message")}>Show Toast</button>
      <button onClick={() => toast.success("Success!")}>Show Success</button>
      <button onClick={() => toast.error("Error!")}>Show Error</button>
    </div>
  );
}

describe("Toast (sonner)", () => {
  it("renders Toaster without crashing", () => {
    const { container } = render(
      <>
        <Toaster />
        <TestComponent />
      </>,
    );
    expect(container).toBeTruthy();
  });

  it("toast function exists (upstream sonner)", () => {
    expect(typeof toast).toBe("function");
    expect(typeof toast.success).toBe("function");
    expect(typeof toast.error).toBe("function");
    expect(typeof toast.info).toBe("function");
  });
});
