import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatProvider, useChat } from "../chat-context";

// ── Mock system prompt ──
vi.mock("../../lib/chat", () => ({
  SYSTEM_PROMPT: "You are a legal assistant.",
}));

// ── Storage helper ──
const mockStore: Record<string, string> = {};

function setupLocalStorage() {
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: vi.fn((key: string) => mockStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStore[key];
      }),
      clear: vi.fn(() => {
        Object.keys(mockStore).forEach((k) => delete mockStore[k]);
      }),
      get length() {
        return Object.keys(mockStore).length;
      },
      key: vi.fn((index: number) => Object.keys(mockStore)[index] ?? null),
    },
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  setupLocalStorage();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Test component ──
function TestConsumer() {
  const { settings, updateSettings, mode, setMode } = useChat();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="broker-url">{settings.brokerUrl}</span>
      <span data-testid="system-prompt">
        {settings.ollamaParams?.system_prompt?.slice(0, 20) ?? "none"}
      </span>
      <button
        data-testid="set-mode-basic"
        onClick={() => setMode("basic" as any)}
      >
        Basic Mode
      </button>
      <button
        data-testid="set-mode-cloud"
        onClick={() => setMode("cloud" as any)}
      >
        Cloud Mode
      </button>
      <button
        data-testid="update-broker"
        onClick={() => updateSettings({ brokerUrl: "http://localhost:9999" })}
      >
        Update Broker
      </button>
      <button
        data-testid="update-bad-broker"
        onClick={() => updateSettings({ brokerUrl: "https://evil.com/proxy" })}
      >
        Bad Broker
      </button>
    </div>
  );
}

describe("ChatProvider", () => {
  it("renders children", () => {
    render(
      <ChatProvider>
        <div data-testid="child">Hello</div>
      </ChatProvider>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("shows children without opacity after hydration", async () => {
    render(
      <ChatProvider>
        <div data-testid="child">Hello</div>
      </ChatProvider>,
    );

    await waitFor(() => {
      const child = screen.getByTestId("child");
      expect(child.parentElement?.className).not.toContain("opacity-0");
    });
  });

  it("provides default settings via context", async () => {
    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("mode")).toHaveTextContent("basic");
    });

    expect(screen.getByTestId("broker-url")).toHaveTextContent(
      "http://localhost:9000",
    );
  });

  it("provides system prompt from chat module", async () => {
    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("system-prompt")).toHaveTextContent(
        "You are a legal ass",
      );
    });
  });

  it("loads saved settings from localStorage after mount", async () => {
    mockStore["glv_chat_settings"] = JSON.stringify({
      mode: "cloud",
      brokerUrl: "http://localhost:9999",
      ollamaParams: { system_prompt: "Custom prompt" },
    });

    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("mode")).toHaveTextContent("cloud");
    });

    expect(screen.getByTestId("broker-url")).toHaveTextContent(
      "http://localhost:9999",
    );
  });

  it("auto-migrates legacy broker URLs to port 9000", async () => {
    mockStore["glv_chat_settings"] = JSON.stringify({
      mode: "local",
      brokerUrl: "http://localhost:9090",
    });

    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("broker-url")).toHaveTextContent(
        "http://localhost:9000",
      );
    });
  });

  it("auto-migrates http://localhost:11434 to port 9000", async () => {
    mockStore["glv_chat_settings"] = JSON.stringify({
      mode: "local",
      brokerUrl: "http://localhost:11434",
    });

    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("broker-url")).toHaveTextContent(
        "http://localhost:9000",
      );
    });
  });

  it("rejects non-localhost broker URLs (SSRF protection)", async () => {
    mockStore["glv_chat_settings"] = JSON.stringify({
      mode: "local",
      brokerUrl: "https://evil.com/proxy",
    });

    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>,
    );

    // Should fall back to default
    await waitFor(() => {
      expect(screen.getByTestId("broker-url")).toHaveTextContent(
        "http://localhost:9000",
      );
    });
  });

  it("setMode updates the mode", async () => {
    const user = userEvent.setup();

    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("mode")).toHaveTextContent("basic");
    });

    await user.click(screen.getByTestId("set-mode-cloud"));

    expect(screen.getByTestId("mode")).toHaveTextContent("cloud");
  });

  it("updateSettings persists to localStorage", async () => {
    const user = userEvent.setup();

    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("broker-url")).toHaveTextContent(
        "http://localhost:9000",
      );
    });

    await user.click(screen.getByTestId("update-broker"));

    // Broker URL updated
    expect(screen.getByTestId("broker-url")).toHaveTextContent(
      "http://localhost:9999",
    );

    // localStorage was written
    const saved = JSON.parse(mockStore["glv_chat_settings"] ?? "{}");
    expect(saved.brokerUrl).toBe("http://localhost:9999");
  });

  it("updateSettings sanitizes bad broker URL (SSRF protection)", async () => {
    const user = userEvent.setup();

    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("broker-url")).toHaveTextContent(
        "http://localhost:9000",
      );
    });

    await user.click(screen.getByTestId("update-bad-broker"));

    // Broker URL should remain default due to SSRF sanitization
    expect(screen.getByTestId("broker-url")).toHaveTextContent(
      "http://localhost:9000",
    );
  });

  it("dispatches glv_settings_updated event on settings change", async () => {
    const user = userEvent.setup();
    const eventSpy = vi.fn();
    window.addEventListener("glv_settings_updated", eventSpy);

    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("broker-url")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("update-broker"));

    expect(eventSpy).toHaveBeenCalled();

    window.removeEventListener("glv_settings_updated", eventSpy);
  });
});

describe("useChat", () => {
  it("throws when used outside ChatProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    function BadComponent() {
      useChat();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow(
      "useChat must be used within a ChatProvider",
    );

    consoleSpy.mockRestore();
  });
});
