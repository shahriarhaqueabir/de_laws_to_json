import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPathname = vi.fn().mockReturnValue("/");
const mockSignOut = vi.fn();
let mockUser: { email: string } | null = null;

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

beforeEach(() => {
  mockPathname.mockReturnValue("/");
  mockUser = null;
  mockSignOut.mockClear();
  const store: Record<string, string> = {};
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(
    (k: string) => store[k] ?? null,
  );
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(
    (k: string, v: string) => {
      store[k] = v;
    },
  );
  // Mock localStorage.clear for tests
  Storage.prototype.clear = vi.fn().mockImplementation(() => {
    Object.keys(store).forEach(key => delete store[key]);
  });
});

const renderWithContext = (ui: React.ReactElement) => {
  return render(<ChatProvider>{ui}</ChatProvider>);
};

describe("NavBar", () => {
  it("renders navigation links: Vault, Consult, Archives", () => {
    renderWithContext(<NavBar />);
    // Use getAllByText and check for at least one visible link
    const vaultLinks = screen.getAllByText("Vault");
    expect(vaultLinks.length).toBeGreaterThan(0);
    expect(screen.getByText("Consult")).toBeInTheDocument();
    expect(screen.getByText("Archives")).toBeInTheDocument();
  });

  it("active link has accent styling", () => {
    renderWithContext(<NavBar />);
    // There are two "Vault" links: one brand link (group) and one nav item
    const navVaultLink = screen.getAllByText("Vault").find(el =>
        el.closest('a')?.className.includes('px-3') // Nav items have px-3 padding
    )!;
    expect(navVaultLink.closest('a')?.className).toContain("text-accent-gold");
  });

  it("shows sign-in link when not authenticated", () => {
    renderWithContext(<NavBar />);
    expect(screen.getByText("Initialize Session")).toBeInTheDocument();
  });

  it("shows user email and sign-out when authenticated", async () => {
    mockUser = { email: "user@example.com" };
    const user = userEvent.setup();
    renderWithContext(<NavBar />);

    expect(screen.getByText("user")).toBeInTheDocument();

    const signOutBtn = screen.getByTitle("Sign out");
    expect(signOutBtn).toBeInTheDocument();

    await user.click(signOutBtn);
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("mode indicator shows current mode", () => {
    renderWithContext(<NavBar />);
    expect(screen.getByText("Basic Search")).toBeInTheDocument();
  });

  it("mode switcher dropdown appears on click", async () => {
    const user = userEvent.setup();
    renderWithContext(<NavBar />);

    const modeBtn = screen.getByText("Basic Search").closest("button")!;
    await user.click(modeBtn);

    expect(screen.getByText("Operational Mode")).toBeInTheDocument();
    expect(screen.getByText("Local AI")).toBeInTheDocument();
    expect(screen.getByText("Cloud AI")).toBeInTheDocument();
    expect(screen.getByText("Browser AI")).toBeInTheDocument();
  });

  it("renders correctly in different viewports", () => {
    renderWithContext(<NavBar />);
    const vaultLinks = screen.getAllByText("Vault");
    expect(vaultLinks.length).toBeGreaterThan(0);
  });

  it("sign-out button is absent when not authenticated", () => {
    renderWithContext(<NavBar />);
    expect(screen.queryByTitle("Sign out")).not.toBeInTheDocument();
  });

  it("settings link points to /settings when authenticated", () => {
    mockUser = { email: "user@example.com" };
    renderWithContext(<NavBar />);
    const settingsLink = screen.getByTitle("user@example.com");
    expect(settingsLink).toHaveAttribute("href", "/settings");
  });

  it("settings link points to /auth when not authenticated", () => {
    renderWithContext(<NavBar />);
    const authLink = screen.getByRole("link", { name: /Initialize Session/i });
    expect(authLink).toHaveAttribute("href", "/auth");
  });
});
