import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPage from "../settings/page";
import { useChat } from "../../components/chat-context";
import { DEFAULT_CHAT_SETTINGS } from "../../lib/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/settings",
  useSearchParams: () => ({ get: vi.fn() }),
}));

// Mock lucide-react (already handled by vitest, but ensure)
vi.mock("lucide-react", () => ({
  Settings: () => <div data-testid="icon-settings" />,
  Cloud: () => <div data-testid="icon-cloud" />,
  Plug: () => <div data-testid="icon-plug" />,
  Brain: () => <div data-testid="icon-brain" />,
  FileText: () => <div data-testid="icon-filetext" />,
  Check: () => <div data-testid="icon-check" />,
  ChevronDown: () => <div data-testid="icon-chevron-down" />,
  Loader2: () => <div data-testid="icon-loader" />,
  CheckCircle2: () => <div data-testid="icon-check-circle" />,
  CheckCircle: () => <div data-testid="icon-check-circle" />,
  XCircle: () => <div data-testid="icon-x-circle" />,
  Info: () => <div data-testid="icon-info" />,
  Globe: () => <div data-testid="icon-globe" />,
  Compass: () => <div data-testid="icon-compass" />,
  Wifi: () => <div data-testid="icon-wifi" />,
  WifiOff: () => <div data-testid="icon-wifi-off" />,
  ArrowLeft: () => <div data-testid="icon-arrow-left" />,
  Server: () => <div data-testid="icon-server" />,
  Database: () => <div data-testid="icon-database" />,
  ShieldAlert: () => <div data-testid="icon-shield-alert" />,
  Key: () => <div data-testid="icon-key" />,
  Sliders: () => <div data-testid="icon-sliders" />,
  BookmarkCheck: () => <div data-testid="icon-bookmark-check" />,
  BookmarkPlus: () => <div data-testid="icon-bookmark-plus" />,
  Languages: () => <div data-testid="icon-languages" />,
  Scale: () => <div data-testid="icon-scale" />,
  Calculator: () => <div data-testid="icon-calculator" />,
  Wallet: () => <div data-testid="icon-wallet" />,
}));

// Mock auth context
vi.mock("../../components/auth-context", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock toast
vi.mock("../../components/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock useLanguage
vi.mock("../../hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "en",
    t: (key: string, vars?: Record<string, string | number>) => {
      const strings: Record<string, string> = {
        "onboarding.banner_text":
          "Set up your AI advisor and language in 2 minutes",
        "onboarding.start": "Start Setup",
        "onboarding.dismiss": "Maybe Later",
      };
      let text = strings[key] || key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
  }),
}));

// Mock onboarding context
vi.mock("../../components/onboarding-context", () => ({
  useOnboarding: () => ({
    state: {
      completed: false,
      step: 0,
      dismissed: false,
      completedDate: null,
      selectedMode: null,
      selectedLanguage: null,
    },
    setStep: vi.fn(),
    setCompleted: vi.fn(),
    setDismissed: vi.fn(),
    setSelectedMode: vi.fn(),
    setSelectedLanguage: vi.fn(),
    resetOnboarding: vi.fn(),
    showWizard: false,
    setShowWizard: vi.fn(),
  }),
  OnboardingProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock chat context
vi.mock("../../components/chat-context", () => ({
  useChat: vi.fn(() => ({
    settings: {
      mode: "basic",
      language: "en",
      localBrokerUrl: "http://localhost:9000",
      ollamaModel: "llama3",
      browserModel: "HuggingFaceTB/SmolLM2-360M-Instruct",
      apiKey: "",
      provider: "openai",
      model: "gpt-4o-mini",
      customEndpoint: "",
    },
    updateSettings: vi.fn(),
    mode: "basic",
    setMode: vi.fn(),
  })),
  ChatProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    // Provide a mock for localStorage if it's not present or broken
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      },
      writable: true,
    });
    localStorage.clear();
  });

  it("renders the settings page heading", () => {
    render(<SettingsPage />);
    expect(screen.getByText(/configuration/i)).toBeInTheDocument();
  });

  it("renders mode selection cards for all 4 chat modes", () => {
    render(<SettingsPage />);
    // Mode labels appear in both buttons and section headings
    expect(screen.getAllByText(/basic search/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/browser ai/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/cloud ai/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/local ai/i).length).toBeGreaterThanOrEqual(1);
  });

  it("highlights the selected mode", () => {
    render(<SettingsPage />);
    // In the new UI, the active mode card has "Active" badge
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it("renders the broker URL input when in local mode", () => {
    // Mock local mode
    vi.mocked(useChat).mockReturnValue({
      settings: {
        ...DEFAULT_CHAT_SETTINGS,
        mode: "local",
        brokerUrl: "http://localhost:9000",
      },
      updateSettings: vi.fn(),
      mode: "local",
      setMode: vi.fn(),
    });

    render(<SettingsPage />);
    const brokerInput = screen.getByDisplayValue("http://localhost:9000");
    expect(brokerInput).toBeInTheDocument();
  });

  it("renders model inputs in cloud mode", () => {
    // Mock cloud mode
    vi.mocked(useChat).mockReturnValue({
      settings: {
        ...DEFAULT_CHAT_SETTINGS,
        mode: "cloud",
        model: "gpt-4o-mini",
      },
      updateSettings: vi.fn(),
      mode: "cloud",
      setMode: vi.fn(),
    });

    render(<SettingsPage />);
    expect(
      screen.getByPlaceholderText(/e.g. gpt-4o-mini/i),
    ).toBeInTheDocument();
  });
});
