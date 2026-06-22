import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
let mockUser: { email: string } | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn() }),
  usePathname: () => "/auth",
}));

vi.mock("../../components/auth-context", () => ({
  useAuth: () => ({
    user: mockUser,
    signIn: mockSignIn,
    signUp: mockSignUp,
    signOut: vi.fn(),
  }),
}));

import AuthPage from "../auth/page";

beforeEach(() => {
  mockUser = null;
  mockPush.mockClear();
  mockSignIn.mockClear();
  mockSignUp.mockClear();
});

describe("AuthPage", () => {
  it("shows sign-in form with email and password fields", () => {
    render(<AuthPage />);
    expect(
      screen.getByRole("heading", { name: /Sign In/i }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

  it("toggle to 'Create Account' changes form mode", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);

    expect(
      screen.getByRole("heading", { name: /Sign In/i }),
    ).toBeInTheDocument();

    const toggleBtn = screen.getByText("Create one");
    await user.click(toggleBtn);

    expect(
      screen.getByRole("heading", { name: /Create Account/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Create an account to save your progress"),
    ).toBeInTheDocument();
  });

  it("toggles back to 'Sign In' after switching to sign up", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);

    // Switch to sign up
    await user.click(screen.getByText("Create one"));
    expect(
      screen.getByRole("heading", { name: /Create Account/i }),
    ).toBeInTheDocument();

    // Switch back
    await user.click(screen.getByText("Sign in"));
    expect(
      screen.getByRole("heading", { name: /Sign In/i }),
    ).toBeInTheDocument();
  });

  it("error message displays on failed sign-in", async () => {
    mockSignIn.mockResolvedValue("Invalid login credentials");
    const user = userEvent.setup();
    render(<AuthPage />);

    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "bad@test.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "wrongpw");
    await user.click(screen.getByRole("button", { name: /Sign In$/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid login credentials")).toBeInTheDocument();
    });
  });

  it("success message displays on sign-up", async () => {
    mockSignUp.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<AuthPage />);

    // Switch to sign up
    await user.click(screen.getByText("Create one"));

    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "new@test.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(screen.getByRole("button", { name: /Create Account/ }));

    await waitFor(() => {
      expect(
        screen.getByText("Account created! Check your email for confirmation."),
      ).toBeInTheDocument();
    });
  });

  it("redirects to / if already authenticated", () => {
    mockUser = { email: "user@example.com" };
    render(<AuthPage />);

    // Should try to redirect
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("returns null when already authenticated (redirect)", () => {
    mockUser = { email: "user@example.com" };
    const { container } = render(<AuthPage />);

    // Should render nothing
    expect(container.innerHTML).toBe("");
  });

  it("shows loading spinner on submit", async () => {
    // Never-resolving promise to keep loading state
    mockSignIn.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<AuthPage />);

    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "test@test.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "password");
    await user.click(screen.getByRole("button", { name: /Sign In$/i }));

    // Button should show spinner
    const buttons = screen.getAllByRole("button");
    // Find the submit button specifically
    const submitBtn = buttons.find(
      (b) => b.tagName === "BUTTON" && b.closest("form"),
    );
    expect(submitBtn).toBeDisabled();
  });

  it("error resets when toggling between modes", async () => {
    mockSignIn.mockResolvedValue("Some error");
    const user = userEvent.setup();
    render(<AuthPage />);

    // Trigger error
    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "test@test.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "pw");
    await user.click(screen.getByRole("button", { name: /Sign In$/i }));

    await waitFor(() => {
      expect(screen.getByText("Some error")).toBeInTheDocument();
    });

    // Toggle mode
    await user.click(screen.getByText("Create one"));

    // Error should be gone
    expect(screen.queryByText("Some error")).not.toBeInTheDocument();
  });

  it("sign-in on success redirects to /", async () => {
    mockSignIn.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<AuthPage />);

    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "valid@test.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "correctpw");
    await user.click(screen.getByRole("button", { name: /Sign In$/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("clears sessionStorage on successful sign-in", async () => {
    mockSignIn.mockResolvedValue(null);
    const user = userEvent.setup();

    // Provide a mock for sessionStorage
    const mockRemoveItem = vi.fn();
    Object.defineProperty(window, "sessionStorage", {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: mockRemoveItem,
        clear: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    render(<AuthPage />);

    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "valid@test.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "correctpw");
    await user.click(screen.getByRole("button", { name: /Sign In$/i }));

    await waitFor(() => {
      expect(mockRemoveItem).toHaveBeenCalledWith("glv_guest_chat");
    });
  });
});
