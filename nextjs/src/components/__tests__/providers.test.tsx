import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Providers } from "../providers";

describe("Providers", () => {
  it("renders children inside QueryClientProvider", () => {
    render(
      <Providers>
        <div data-testid="child">Hello</div>
      </Providers>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
