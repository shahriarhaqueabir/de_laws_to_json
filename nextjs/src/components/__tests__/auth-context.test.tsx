import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  mockGetUser,
  mockOnAuthStateChange,
  mockSignInWithPassword,
  mockSignUp,
  mockSignOut,
  mockUnsubscribe,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockSignUp: vi.fn(),
  mockSignOut: vi.fn(),
  mockUnsubscribe: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signOut: mockSignOut,
    },
  }),
}));

import { AuthProvider, useAuth } from "../auth-context";

function TestComponent() {
  const { user, loading, signIn, signUp, signOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading ? "loading" : "loaded"}</span>
      <span data-testid="user-email">{user?.email ?? "no-user"}</span>
      <button data-testid="sign-in" onClick={() => signIn("a@b.com", "pw")}>
        Sign In
      </button>
      <button data-testid="sign-up" onClick={() => signUp("a@b.com", "pw")}>
        Sign Up
      </button>
      <button data-testid="sign-out" onClick={() => signOut()}>
        Sign Out
      </button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: null } });
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  });
});

describe("AuthContext", () => {
  it("provides user, loading, signIn, signUp, signOut via context", async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("loaded");
    });

    expect(screen.getByTestId("user-email")).toHaveTextContent("no-user");
    expect(screen.getByTestId("sign-in")).toBeInTheDocument();
    expect(screen.getByTestId("sign-up")).toBeInTheDocument();
    expect(screen.getByTestId("sign-out")).toBeInTheDocument();
  });

  it("signIn returns null on success", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });

    // Create a component that captures the return value
    let signInResult: string | null | undefined = undefined;
    function CaptureComponent() {
      const { signIn } = useAuth();
      return (
        <button
          data-testid="do-signin"
          onClick={async () => {
            signInResult = await signIn("a@b.com", "pw");
          }}
        >
          Do Sign In
        </button>
      );
    }

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <CaptureComponent />
      </AuthProvider>,
    );

    await user.click(screen.getByTestId("do-signin"));

    await waitFor(() => {
      expect(signInResult).toBeNull();
    });
  });

  it("signIn returns error message on failure", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    let signInResult: string | null | undefined = undefined;
    function CaptureComponent() {
      const { signIn } = useAuth();
      return (
        <button
          data-testid="do-signin"
          onClick={async () => {
            signInResult = await signIn("a@b.com", "wrong");
          }}
        >
          Do Sign In
        </button>
      );
    }

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <CaptureComponent />
      </AuthProvider>,
    );

    await user.click(screen.getByTestId("do-signin"));

    await waitFor(() => {
      expect(signInResult).toBe("Invalid login credentials");
    });
  });

  it("signUp returns null on success", async () => {
    mockSignUp.mockResolvedValue({ error: null });

    let signUpResult: string | null | undefined = undefined;
    function CaptureComponent() {
      const { signUp } = useAuth();
      return (
        <button
          data-testid="do-signup"
          onClick={async () => {
            signUpResult = await signUp("a@b.com", "pw");
          }}
        >
          Do Sign Up
        </button>
      );
    }

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <CaptureComponent />
      </AuthProvider>,
    );

    await user.click(screen.getByTestId("do-signup"));

    await waitFor(() => {
      expect(signUpResult).toBeNull();
    });
  });

  it("signUp returns error message on failure", async () => {
    mockSignUp.mockResolvedValue({
      error: { message: "User already registered" },
    });

    let signUpResult: string | null | undefined = undefined;
    function CaptureComponent() {
      const { signUp } = useAuth();
      return (
        <button
          data-testid="do-signup"
          onClick={async () => {
            signUpResult = await signUp("a@b.com", "pw");
          }}
        >
          Do Sign Up
        </button>
      );
    }

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <CaptureComponent />
      </AuthProvider>,
    );

    await user.click(screen.getByTestId("do-signup"));

    await waitFor(() => {
      expect(signUpResult).toBe("User already registered");
    });
  });

  it("signOut clears user state", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "test@example.com" } },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("loaded");
    });

    // Should initially show the user
    expect(screen.getByTestId("user-email")).toHaveTextContent(
      "test@example.com",
    );
  });

  it("throws error when used outside AuthProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    function BadComponent() {
      useAuth();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow(
      "useAuth must be used within AuthProvider",
    );

    consoleSpy.mockRestore();
  });
});
