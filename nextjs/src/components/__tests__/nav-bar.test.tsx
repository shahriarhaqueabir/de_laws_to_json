import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPathname = vi.fn().mockReturnValue("/");
const mockSignOut = vi.fn();
let mockUser: { email: string } | null = null;
let mockModeValue = "basic";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn() }),
}));

vi.mock("../auth-context", () => ({
  useAuth: () => ({
    user: mockUser,
    signOut: mockSignOut,
  }),
}));

import NavBar from "../nav-bar";
import { ChatProvider } from "../chat-context";

let mockStore: Record<string, string> = {};

beforeEach(() => {
  mockPathname.mockReturnValue("/");
  mockUser = null;
  mockSignOut.mockClear();
  mockModeValue = "basic";
  mockStore = {};

  // Override localStorage with a proper mock
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
});

const renderWithContext = (ui: React.ReactElement) => {
  return render(<ChatProvider>{ui}</ChatProvider>);
};

describe("NavBar", () => {
  it("renders navigation links", () => {
    renderWithContext(<NavBar />);
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Bookmarks")).toBeInTheDocument();
  });

  it("renders Guidance navigation link", () => {
    renderWithContext(<NavBar />);
    expect(screen.getByText("Guidance")).toBeInTheDocument();
  });

  it("active link has accent styling", () => {
    renderWithContext(<NavBar />);
    const navSearchLink = screen.getByText("Search").closest("a");
    expect(navSearchLink?.className).toContain("text-accent-gold-body");
  });

  it("highlights Chat when on /chat page", () => {
    mockPathname.mockReturnValue("/chat");
    renderWithContext(<NavBar />);

    const chatLink = screen.getByText("Chat").closest("a");
    expect(chatLink?.className).toContain("text-accent-gold-body");
  });

  it("highlights Guidance when on /guidance page", () => {
    mockPathname.mockReturnValue("/guidance");
    renderWithContext(<NavBar />);

    const guidanceLink = screen.getByText("Guidance").closest("a");
    expect(guidanceLink?.className).toContain("text-accent-gold-body");
  });

  it("shows sign-in link when not authenticated", () => {
    renderWithContext(<NavBar />);
    expect(screen.getByText("Sign In")).toBeInTheDocument();
  });

  it("shows user email and sign-out when authenticated", async () => {
    mockUser = { email: "user@example.com" };
    const user = userEvent.setup();
    renderWithContext(<NavBar />);

    expect(screen.getByText("user")).toBeInTheDocument();

    const signOutBtn = screen.getByTitle("Sign Out");
    expect(signOutBtn).toBeInTheDocument();

    await user.click(signOutBtn);
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("sign-out button is absent when not authenticated", () => {
    renderWithContext(<NavBar />);
    expect(screen.queryByTitle("Sign Out")).not.toBeInTheDocument();
  });

  it("settings link points to /settings when authenticated", () => {
    mockUser = { email: "user@example.com" };
    renderWithContext(<NavBar />);
    const settingsLink = screen.getByTitle("user@example.com");
    expect(settingsLink).toHaveAttribute("href", "/settings");
  });

  it("settings link points to /auth when not authenticated", () => {
    renderWithContext(<NavBar />);
    const authLink = screen.getByRole("link", { name: /Sign In/i });
    expect(authLink).toHaveAttribute("href", "/auth");
  });

  // ── Mobile drawer ──
  it("shows mobile hamburger button", () => {
    renderWithContext(<NavBar />);
    const hamburger = screen.getByLabelText("Open navigation menu");
    expect(hamburger).toBeInTheDocument();
  });

  it("opens mobile drawer when hamburger clicked", async () => {
    const user = userEvent.setup();
    renderWithContext(<NavBar />);

    await user.click(screen.getByLabelText("Open navigation menu"));

    // Mobile drawer should be visible
    const drawer = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(drawer).toBeInTheDocument();

    // Close button appears inside the drawer
    expect(
      within(drawer).getByLabelText("Close navigation menu"),
    ).toBeInTheDocument();
  });

  it("closes mobile drawer when close button clicked", async () => {
    const user = userEvent.setup();
    renderWithContext(<NavBar />);

    // Open drawer
    await user.click(screen.getByLabelText("Open navigation menu"));
    const drawer = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(drawer).toBeInTheDocument();

    // Find the close button inside the drawer
    const closeBtn = within(drawer).getByLabelText("Close navigation menu");
    await user.click(closeBtn);
    expect(
      screen.queryByRole("dialog", { name: "Navigation menu" }),
    ).not.toBeInTheDocument();
  });

  it("closes mobile drawer when backdrop overlay clicked", async () => {
    const user = userEvent.setup();
    renderWithContext(<NavBar />);

    await user.click(screen.getByLabelText("Open navigation menu"));
    expect(
      screen.getByRole("dialog", { name: "Navigation menu" }),
    ).toBeInTheDocument();

    // Click the backdrop overlay
    const backdrop = document.querySelector(".fixed.inset-0");
    expect(backdrop).toBeInTheDocument();
    await user.click(backdrop!);

    expect(
      screen.queryByRole("dialog", { name: "Navigation menu" }),
    ).not.toBeInTheDocument();
  });

  it("closes mobile drawer with Escape key", async () => {
    const user = userEvent.setup();
    renderWithContext(<NavBar />);

    await user.click(screen.getByLabelText("Open navigation menu"));
    expect(
      screen.getByRole("dialog", { name: "Navigation menu" }),
    ).toBeInTheDocument();

    // Escape on the drawer fires via the useEffect listener on window
    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "Navigation menu" }),
    ).not.toBeInTheDocument();
  });

  it("mobile drawer has Vault home link", async () => {
    const user = userEvent.setup();
    renderWithContext(<NavBar />);

    await user.click(screen.getByLabelText("Open navigation menu"));

    const vaultLinks = screen.getAllByText("Vault");
    // One in desktop nav, one in mobile drawer header
    expect(vaultLinks.length).toBeGreaterThanOrEqual(2);
  });

  it("mobile drawer shows sign-in link when not authenticated", async () => {
    const user = userEvent.setup();
    renderWithContext(<NavBar />);

    await user.click(screen.getByLabelText("Open navigation menu"));

    const signInLinks = screen.getAllByText("Sign In");
    expect(signInLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("mobile drawer shows user email when authenticated", async () => {
    mockUser = { email: "user@example.com" };
    const user = userEvent.setup();
    renderWithContext(<NavBar />);

    await user.click(screen.getByLabelText("Open navigation menu"));

    // The mobile drawer bottom shows truncated email
    const userLinks = screen.getAllByText("user");
    expect(userLinks.length).toBeGreaterThanOrEqual(2); // desktop + mobile
  });

  // ── Mode dropdown ──
  it("mode indicator shows current mode", async () => {
    renderWithContext(<NavBar />);

    await waitFor(() => {
      expect(screen.getByText("Basic")).toBeInTheDocument();
    });
  });

  it("mode switcher dropdown appears on click", async () => {
    const user = userEvent.setup();
    renderWithContext(<NavBar />);

    await waitFor(async () => {
      // The mode toggle button contains the mode text
      const basicTexts = screen.getAllByText("Basic");
      // Click the one that's a button (in the mode toggle, not the dropdown)
      const modeBtn = basicTexts[0].closest("button");
      if (modeBtn) {
        await user.click(modeBtn);
      }
    });

    expect(screen.getByText("Mode")).toBeInTheDocument();
    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("Cloud")).toBeInTheDocument();
    expect(screen.getByText("Browser")).toBeInTheDocument();
  });

  it("mode dropdown shows settings link", async () => {
    const user = userEvent.setup();
    renderWithContext(<NavBar />);

    await waitFor(async () => {
      const basicTexts = screen.getAllByText("Basic");
      const modeBtn = basicTexts[0].closest("button");
      if (modeBtn) {
        await user.click(modeBtn);
      }
    });

    expect(screen.getByText("Settings")).toBeInTheDocument();
    const settingsLink = screen.getByText("Settings").closest("a");
    expect(settingsLink).toHaveAttribute("href", "/settings");
  });

  it("closes mode dropdown when clicking outside", async () => {
    const user = userEvent.setup();
    renderWithContext(<NavBar />);

    await waitFor(async () => {
      const basicTexts = screen.getAllByText("Basic");
      const modeBtn = basicTexts[0].closest("button");
      if (modeBtn) {
        await user.click(modeBtn);
      }
    });

    expect(screen.getByText("Mode")).toBeInTheDocument();

    // Click the backdrop overlay
    const backdrop = document.querySelectorAll(".fixed.inset-0");
    // The first one is the mode dropdown backdrop, second is mobile drawer
    if (backdrop.length > 0) {
      await user.click(backdrop[0]);
    }

    // Mode dropdown should be closed
    expect(screen.queryByText("Mode")).not.toBeInTheDocument();
  });

  // ── Mode switching ──
  it("switches to Cloud mode from dropdown", async () => {
    const user = userEvent.setup();
    renderWithContext(<NavBar />);

    await waitFor(async () => {
      const basicTexts = screen.getAllByText("Basic");
      const modeBtn = basicTexts[0].closest("button");
      if (modeBtn) {
        await user.click(modeBtn);
      }
    });

    // Click Cloud in the dropdown
    await user.click(screen.getByText("Cloud"));

    // Mode should now show Cloud
    expect(screen.getByText("Cloud")).toBeInTheDocument();
  });

  it("switches to Local mode from dropdown", async () => {
    const user = userEvent.setup();
    renderWithContext(<NavBar />);

    await waitFor(async () => {
      const basicTexts = screen.getAllByText("Basic");
      const modeBtn = basicTexts[0].closest("button");
      if (modeBtn) {
        await user.click(modeBtn);
      }
    });

    // Click Local
    await user.click(screen.getByText("Local"));

    expect(screen.getByText("Local")).toBeInTheDocument();
  });

  // ── Language indicator ──
  it("shows language indicator with EN", () => {
    renderWithContext(<NavBar />);
    expect(screen.getByText("EN")).toBeInTheDocument();
  });

  // ── Desktop nav items have correct labels ──
  it("renders all desktop nav items", () => {
    renderWithContext(<NavBar />);
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Guidance")).toBeInTheDocument();
    expect(screen.getByText("Bookmarks")).toBeInTheDocument();
  });

  it("desktop nav has Vault home link", () => {
    renderWithContext(<NavBar />);
    const vaultLinks = screen.getAllByText("Vault");
    expect(vaultLinks[0]).toBeInTheDocument();
    expect(vaultLinks[0].closest("a")).toHaveAttribute("href", "/");
  });
});
