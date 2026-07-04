import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FeatureGate } from "./feature-gate";

// Mock useAuth
vi.mock("./auth-context", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

// Use a mutable mock for useChat so each test can set its own mode
const mockUseChat = vi.fn();
vi.mock("./chat-context", () => ({
  useChat: () => mockUseChat(),
}));

beforeEach(() => {
  mockUseChat.mockReturnValue({ settings: { mode: "basic" } });
});

describe("FeatureGate", () => {
  it("renders children when requirement is met", () => {
    render(
      <FeatureGate requirement="auth" message="Sign in" met={true}>
        <button>Protected</button>
      </FeatureGate>,
    );
    expect(screen.getByText("Protected")).toBeDefined();
  });

  it("shows lock icon when requirement is not met", () => {
    const { container } = render(
      <FeatureGate requirement="auth" message="Sign in" met={false}>
        <button>Protected</button>
      </FeatureGate>,
    );
    expect(container.querySelector("[data-testid='lock-icon']")).toBeDefined();
  });

  it("renders children at reduced opacity when not met", () => {
    const { container } = render(
      <FeatureGate requirement="auth" message="Sign in" met={false}>
        <button>Protected</button>
      </FeatureGate>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("cursor-not-allowed");
  });

  it("shows tooltip on hover", async () => {
    render(
      <FeatureGate requirement="auth" message="Sign in required" met={false}>
        <button>Test</button>
      </FeatureGate>,
    );

    // Tooltip should not be visible initially
    expect(screen.queryByText("Sign in required")).toBeNull();

    // Trigger hover
    const container = screen.getByText("Test").closest(".group")!;
    fireEvent.mouseEnter(container);

    // Tooltip should appear
    expect(screen.getByText("Sign in required")).toBeDefined();

    // Leave
    fireEvent.mouseLeave(container);
    expect(screen.queryByText("Sign in required")).toBeNull();
  });

  it("calls action callback on click when not met", () => {
    const action = vi.fn();
    render(
      <FeatureGate
        requirement="auth"
        message="Sign in"
        met={false}
        action={action}
      >
        <button>Test</button>
      </FeatureGate>,
    );

    fireEvent.click(screen.getByText("Test").closest(".group")!);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("does not call action when met", () => {
    const action = vi.fn();
    render(
      <FeatureGate
        requirement="auth"
        message="Sign in"
        met={true}
        action={action}
      >
        <button>Test</button>
      </FeatureGate>,
    );

    fireEvent.click(screen.getByText("Test"));
    expect(action).not.toHaveBeenCalled();
  });

  it("shows mode-specific message for cloud mode with ai-mode requirement", () => {
    mockUseChat.mockReturnValue({ settings: { mode: "cloud" } });

    render(
      <FeatureGate requirement="ai-mode" message="Generic message" met={false}>
        <button>Test</button>
      </FeatureGate>,
    );

    const container = screen.getByText("Test").closest(".group")!;
    fireEvent.mouseEnter(container);

    expect(
      screen.getByText("Configure an API key in Settings to use this feature"),
    ).toBeDefined();
  });

  it("shows mode-specific message for local mode with ai-mode requirement", () => {
    mockUseChat.mockReturnValue({ settings: { mode: "local" } });

    render(
      <FeatureGate requirement="ai-mode" message="Generic message" met={false}>
        <button>Test</button>
      </FeatureGate>,
    );

    const container = screen.getByText("Test").closest(".group")!;
    fireEvent.mouseEnter(container);

    expect(
      screen.getByText("Start your local broker to enable Local AI"),
    ).toBeDefined();
  });

  it("shows mode-specific message for browser mode with ai-mode requirement", () => {
    mockUseChat.mockReturnValue({ settings: { mode: "browser" } });

    render(
      <FeatureGate requirement="ai-mode" message="Generic message" met={false}>
        <button>Test</button>
      </FeatureGate>,
    );

    const container = screen.getByText("Test").closest(".group")!;
    fireEvent.mouseEnter(container);

    expect(
      screen.getByText(
        "Browser AI needs ~1GB download — configure in Settings",
      ),
    ).toBeDefined();
  });

  it("shows generic message for non-ai-mode requirements", () => {
    render(
      <FeatureGate requirement="api-key" message="Add an API key" met={false}>
        <button>Test</button>
      </FeatureGate>,
    );

    const container = screen.getByText("Test").closest(".group")!;
    fireEvent.mouseEnter(container);

    expect(screen.getByText("Add an API key")).toBeDefined();
  });
});
