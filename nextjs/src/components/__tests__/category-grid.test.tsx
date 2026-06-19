import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoryGrid from "../category-grid";

describe("CategoryGrid", () => {
  it("renders all 12 category links", () => {
    render(<CategoryGrid />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(12);
  });

  it("each link has correct href with category parameter", () => {
    render(<CategoryGrid />);

    const expectedCategories = [
      "housing",
      "labor",
      "consumer",
      "traffic",
      "family",
      "criminal",
      "finance",
      "social",
      "public",
      "tech",
      "berlin",
      "other",
    ];

    for (const cat of expectedCategories) {
      const link = screen.getByRole("link", { name: new RegExp(cat, "i") });
      // Some links match by href since the category key might not be visible text
    }

    // Verify by href
    for (const cat of expectedCategories) {
      const links = screen.getAllByRole("link");
      const match = links.find(
        (l) => l.getAttribute("href") === `/search?category=${cat}`,
      );
      expect(match).toBeDefined();
    }
  });

  it('displays category name "Wohnen & Miete"', () => {
    render(<CategoryGrid />);
    expect(screen.getByText("Wohnen & Miete")).toBeInTheDocument();
  });

  it('displays category name "Arbeit & Beruf"', () => {
    render(<CategoryGrid />);
    expect(screen.getByText("Arbeit & Beruf")).toBeInTheDocument();
  });

  it('displays category name "Strafrecht"', () => {
    render(<CategoryGrid />);
    expect(screen.getByText("Strafrecht")).toBeInTheDocument();
  });

  it('displays category name "Berlin"', () => {
    render(<CategoryGrid />);
    expect(screen.getByText("Berlin")).toBeInTheDocument();
  });

  it('displays category name "Sonstiges"', () => {
    render(<CategoryGrid />);
    expect(screen.getByText("Sonstiges")).toBeInTheDocument();
  });

  it("renders English descriptions for each category", () => {
    render(<CategoryGrid />);
    expect(screen.getByText("Housing & Rent")).toBeInTheDocument();
    expect(screen.getByText("Labor & Career")).toBeInTheDocument();
    expect(screen.getByText("Criminal Law")).toBeInTheDocument();
    expect(screen.getByText("Berlin Specific")).toBeInTheDocument();
  });
});
