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
  it("renders search input with placeholder text", () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText(/Describe your legal situation/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("submitting with query navigates to /search?q=...", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/Describe your legal situation/i);
    await user.type(input, "BGB § 823");
    await user.type(input, "{Enter}");

    expect(mockPush).toHaveBeenCalledWith(
      "/search?q=" + encodeURIComponent("BGB § 823"),
    );
  });

  it("submitting with empty query does not navigate", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/Describe your legal situation/i);
    // Submit without typing anything
    await user.type(input, "{Enter}");

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("input value updates onChange", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/Describe your legal situation/i);
    await user.type(input, "Mietrecht");

    expect(input).toHaveValue("Mietrecht");
  });

  it("renders with initial value", () => {
    render(<SearchBar initialValue="StGB" />);
    const input = screen.getByPlaceholderText(/Describe your legal situation/i);
    expect(input).toHaveValue("StGB");
  });
});
