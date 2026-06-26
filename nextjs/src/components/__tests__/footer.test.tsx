import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "../footer";

vi.mock("../../hooks/useLanguage", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        "footer.tagline": "German Law Vault",
        "footer.copyright": "© 2026",
      };
      return dict[key] ?? key;
    },
  }),
}));

describe("Footer", () => {
  it("renders tagline from translation", () => {
    render(<Footer />);
    expect(screen.getByText("German Law Vault")).toBeInTheDocument();
  });

  it("renders copyright from translation", () => {
    render(<Footer />);
    expect(screen.getByText("© 2026")).toBeInTheDocument();
  });

  it("has link to API docs", () => {
    render(<Footer />);
    const apiLink = screen.getByRole("link", { name: /API Docs/i });
    expect(apiLink).toHaveAttribute("href", "/api-docs");
  });
});
