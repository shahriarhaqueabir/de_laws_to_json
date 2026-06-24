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
    Object.keys(store).forEach((key) => delete store[key]);
  });
});

const renderWithContext = (ui: React.ReactElement) => {
  return render(<ChatProvider>{ui}</ChatProvider>);
};

describe("NavBar", () => {
  it("renders navigation links", () => {
    renderWithContext(<NavBar />);
    // Use getAllByText and check for at least one visible link
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Bookmarks")).toBeInTheDocument();
  });

  it("active link has accent styling", () => {
    renderWithContext(<NavBar />);
    // Find the Search nav link
    const navSearchLink = screen.getByText("Search").closest("a");
    expect(navSearchLink?.className).toContain("text-accent-gold-body");
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

  it("mode indicator shows current mode", () => {
    renderWithContext(<NavBar />);
    expect(screen.getByText("Basic")).toBeInTheDocument();
  });

  it("mode switcher dropdown appears on click", async () => {
    const user = userEvent.setup();
    renderWithContext(<NavBar />);

    const modeBtn = screen.getByText("Basic").closest("button")!;
    await user.click(modeBtn);

    expect(screen.getByText("Mode")).toBeInTheDocument();
    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("Cloud")).toBeInTheDocument();
    expect(screen.getByText("Browser")).toBeInTheDocument();
  });

  it("renders correctly in different viewports", () => {
    renderWithContext(<NavBar />);
    expect(screen.getByText("Search")).toBeInTheDocument();
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
    const authLink = screen.getByRole("link", { name: /Sign In/i });
    expect(authLink).toHaveAttribute("href", "/auth");
  });
});
