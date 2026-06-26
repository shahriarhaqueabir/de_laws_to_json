import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ── Module-level mocks (hoisted) ──

const mockKyGet = vi.fn();
const mockKyDelete = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastCustom = vi.fn();
const mockToastDismiss = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("ky", () => ({
  default: {
    get: (...args: unknown[]) => mockKyGet(...args),
    delete: (...args: unknown[]) => mockKyDelete(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    custom: (...args: unknown[]) => mockToastCustom(...args),
    dismiss: (...args: unknown[]) => mockToastDismiss(...args),
  },
}));

vi.mock("../auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// ── Import after mocks ──

import ConversationList from "../conversation-list";

function kyJson<T>(data: T) {
  return { json: vi.fn().mockResolvedValue(data) };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const sampleConversations = [
  {
    id: "conv-1",
    title: "BGB § 823 question",
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:30:00Z",
  },
  {
    id: "conv-2",
    title: "Mietrecht issues",
    created_at: "2026-05-28T08:00:00Z",
    updated_at: "2026-05-28T09:00:00Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: "user-1", email: "a@b.com" } });
});

describe("ConversationList", () => {
  // ── Signed out state ──
  it("shows sign-in prompt when user is null", async () => {
    mockUseAuth.mockReturnValue({ user: null });

    render(<ConversationList isOpen onSelect={vi.fn()} onToggle={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    // Sidebar content appears twice (mobile + desktop)
    const prompts = screen.getAllByText(/Sign in to save conversations/i);
    expect(prompts).toHaveLength(2);
  });

  // ── Loading state ──
  it("shows loading spinner while fetching", () => {
    mockKyGet.mockReturnValue(new Promise(() => {})); // never resolves

    const { container } = render(
      <ConversationList isOpen onSelect={vi.fn()} onToggle={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    // Loader2 SVG with animate-spin class
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  // ── Error state ──
  it("shows error and retry button when fetch fails", async () => {
    const user = userEvent.setup();

    // First call fails, second call succeeds
    mockKyGet
      .mockReturnValueOnce({
        json: () => Promise.reject(new Error("Network error")),
      })
      .mockReturnValueOnce(kyJson([]));

    render(<ConversationList isOpen onSelect={vi.fn()} onToggle={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    // Wait for error state to appear (text appears twice in sidebars)
    await waitFor(() => {
      const errors = screen.getAllByText(/Failed to load/i);
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });

    // Find and click retry button (also appears twice)
    const retryButtons = screen.getAllByText(/Retry/i);
    await user.click(retryButtons[0]);

    // After retry, should show empty state
    await waitFor(() => {
      const empties = screen.getAllByText(/No conversations yet/i);
      expect(empties.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Empty state ──
  it("shows empty state when no conversations", async () => {
    mockKyGet.mockReturnValue(kyJson([]));

    render(<ConversationList isOpen onSelect={vi.fn()} onToggle={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const empties = screen.getAllByText(/No conversations yet/i);
      expect(empties.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Renders conversation list ──
  it("renders conversation list", async () => {
    mockKyGet.mockReturnValue(kyJson(sampleConversations));

    render(<ConversationList isOpen onSelect={vi.fn()} onToggle={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const titles = screen.getAllByText("BGB § 823 question");
      expect(titles.length).toBeGreaterThanOrEqual(1);
    });

    const mietrecht = screen.getAllByText("Mietrecht issues");
    expect(mietrecht.length).toBeGreaterThanOrEqual(1);
  });

  // ── Highlights active conversation ──
  it("highlights the current conversation", async () => {
    mockKyGet.mockReturnValue(kyJson(sampleConversations));

    const { container } = render(
      <ConversationList
        isOpen
        currentConversationId="conv-1"
        onSelect={vi.fn()}
        onToggle={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      // Find the conversation buttons that have bg-accent-gold/10 (active style)
      const activeBtns = container.querySelectorAll(".bg-accent-gold\\/10");
      expect(activeBtns.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Calls onSelect when clicked ──
  it("calls onSelect when a conversation is clicked", async () => {
    mockKyGet.mockReturnValue(kyJson(sampleConversations));
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(<ConversationList isOpen onSelect={onSelect} onToggle={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getAllByText("BGB § 823 question").length,
      ).toBeGreaterThanOrEqual(1);
    });

    // Click the first conversation title found
    await user.click(screen.getAllByText("BGB § 823 question")[0]);

    expect(onSelect).toHaveBeenCalledWith("conv-1");
  });

  // ── Desktop sidebar shows ──
  it("renders sidebar with New Chat link", async () => {
    mockKyGet.mockReturnValue(kyJson([]));

    render(<ConversationList isOpen onSelect={vi.fn()} onToggle={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const newChatLinks = screen.getAllByRole("link", { name: /New Chat/i });
      expect(newChatLinks.length).toBeGreaterThanOrEqual(1);
    });

    const newChatLink = screen.getAllByRole("link", { name: /New Chat/i })[0];
    expect(newChatLink).toHaveAttribute("href", "/chat");
  });

  // ── Mobile overlay toggle ──
  it("renders mobile overlay when isOpen is true", () => {
    render(<ConversationList isOpen onSelect={vi.fn()} onToggle={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    const overlay = document.querySelector(".fixed.inset-0");
    expect(overlay).toBeInTheDocument();
  });

  it("does not render mobile overlay when isOpen is false", async () => {
    mockKyGet.mockReturnValue(kyJson([]));

    render(
      <ConversationList isOpen={false} onSelect={vi.fn()} onToggle={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    const overlay = document.querySelector(".fixed.inset-0");
    expect(overlay).not.toBeInTheDocument();
  });

  it("calls onToggle when overlay is clicked", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();

    render(<ConversationList isOpen onSelect={vi.fn()} onToggle={onToggle} />, {
      wrapper: createWrapper(),
    });

    const overlay = document.querySelector(".fixed.inset-0");
    expect(overlay).toBeInTheDocument();

    await user.click(overlay!);
    expect(onToggle).toHaveBeenCalled();
  });

  // ── Delete confirmation shown ──
  it("shows delete confirmation when trash icon clicked", async () => {
    mockKyGet.mockReturnValue(kyJson(sampleConversations));
    const user = userEvent.setup();

    render(<ConversationList isOpen onSelect={vi.fn()} onToggle={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    // Wait for delete buttons to appear
    await waitFor(() => {
      const deleteBtns = screen.getAllByRole("button", {
        name: /Delete BGB/i,
      });
      expect(deleteBtns.length).toBeGreaterThanOrEqual(1);
    });

    // Click the first delete button
    await user.click(screen.getAllByRole("button", { name: /Delete BGB/i })[0]);

    // Custom toast should be shown
    expect(mockToastCustom).toHaveBeenCalled();
    const toastRenderFn = mockToastCustom.mock.calls[0][0];
    const { container } = render(toastRenderFn("toast-id"));
    expect(container.textContent).toContain("Delete");
  });

  // ── Delete mutation success ──
  it("calls ky.delete and toast.success on delete confirm", async () => {
    mockKyGet.mockReturnValue(kyJson(sampleConversations));
    mockKyDelete.mockReturnValue(kyJson({ success: true }));
    const user = userEvent.setup();

    render(<ConversationList isOpen onSelect={vi.fn()} onToggle={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: /Delete BGB/i }).length,
      ).toBeGreaterThanOrEqual(1);
    });

    // Click delete button
    await user.click(screen.getAllByRole("button", { name: /Delete BGB/i })[0]);

    // Extract and render the toast
    const toastRenderFn = mockToastCustom.mock.calls[0][0];
    const { getByText: toastGetByText } = render(
      toastRenderFn("test-toast-id"),
    );

    // Click Delete in confirmation
    await user.click(toastGetByText("Delete"));

    // Should have called ky.delete
    expect(mockKyDelete).toHaveBeenCalledWith("/api/chat/conversations/conv-1");

    // Wait for success toast
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Conversation deleted");
    });
  });

  // ── Delete mutation error ──
  it("shows error toast when delete fails", async () => {
    mockKyGet.mockReturnValue(kyJson(sampleConversations));
    mockKyDelete.mockReturnValue({
      json: () => Promise.reject(new Error("Delete failed")),
    });
    const user = userEvent.setup();

    render(<ConversationList isOpen onSelect={vi.fn()} onToggle={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: /Delete BGB/i }).length,
      ).toBeGreaterThanOrEqual(1);
    });

    // Click delete button
    await user.click(screen.getAllByRole("button", { name: /Delete BGB/i })[0]);

    // Extract and render the toast
    const toastRenderFn = mockToastCustom.mock.calls[0][0];
    const { getByText: toastGetByText } = render(
      toastRenderFn("test-toast-id"),
    );

    // Click Delete in confirmation
    await user.click(toastGetByText("Delete"));

    // Wait for error toast
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to delete conversation",
      );
    });
  });
});
