import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
}));

import SearchBar from "../search-bar";

beforeEach(() => {
  mockPush.mockClear();
});

describe("SearchBar", () => {
  it("renders search input with aria-label", () => {
    render(<SearchBar />);
    const input = screen.getByLabelText(/Search laws/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("submitting with query navigates to /search?q=... in search mode", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);

    const input = screen.getByLabelText(/Search laws/i);
    await user.type(input, "BGB § 823");
    await user.type(input, "{Enter}");

    expect(mockPush).toHaveBeenCalledWith(
      "/search?q=" + encodeURIComponent("BGB § 823"),
    );
  });

  it("submitting with query navigates to /chat?q=... in analyze mode", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);

    // Switch to AI Analysis mode
    const analyzeBtn = screen.getByText(/AI Analysis/i);
    await user.click(analyzeBtn);

    const input = screen.getByLabelText(/Search laws/i);
    await user.type(input, "Kündigung");
    await user.type(input, "{Enter}");

    expect(mockPush).toHaveBeenCalledWith(
      "/chat?q=" + encodeURIComponent("Kündigung"),
    );
  });

  it("submitting with empty query does not navigate", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);

    const input = screen.getByLabelText(/Search laws/i);
    // Submit without typing anything
    await user.type(input, "{Enter}");

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("input value updates onChange", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);

    const input = screen.getByLabelText(/Search laws/i);
    await user.type(input, "Mietrecht");

    expect(input).toHaveValue("Mietrecht");
  });

  it("renders with initial value", () => {
    render(<SearchBar initialValue="StGB" />);
    const input = screen.getByLabelText(/Search laws/i);
    expect(input).toHaveValue("StGB");
  });
});
