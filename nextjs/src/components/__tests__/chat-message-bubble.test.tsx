import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessageBubble } from "../chat-message-bubble";

describe("ChatMessageBubble", () => {
  it("renders user message right-aligned with italic style", () => {
    render(
      <ChatMessageBubble role="user" content="What is BGB § 433?" index={0} />,
    );
    const text = screen.getByText("What is BGB § 433?");
    expect(text).toBeInTheDocument();

    const container = text.closest(".flex");
    expect(container?.className).toContain("justify-end");
  });

  it("renders assistant message left-aligned with serif style", () => {
    render(
      <ChatMessageBubble
        role="assistant"
        content="Section 433 BGB regulates the sales contract."
        index={1}
      />,
    );
    const text = screen.getByText(
      "Section 433 BGB regulates the sales contract.",
    );
    expect(text).toBeInTheDocument();

    const container = text.closest(".flex");
    expect(container?.className).toContain("justify-start");
  });

  it("shows response number label for assistant messages", () => {
    render(
      <ChatMessageBubble
        role="assistant"
        content="Legal analysis..."
        index={3}
      />,
    );
    expect(screen.getByText("Response #03")).toBeInTheDocument();
  });

  it("does not show response number label for user messages", () => {
    render(<ChatMessageBubble role="user" content="Hello" index={3} />);
    expect(screen.queryByText("Response #03")).not.toBeInTheDocument();
  });

  it("renders cited laws as links with law key and norm id", () => {
    render(
      <ChatMessageBubble
        role="assistant"
        content="See relevant statutes."
        index={0}
        citedLaws={[
          { law_key: "BGB", norm_id: "§ 433", law_title: "Kaufvertrag" },
          { law_key: "StGB", norm_id: "§ 123", law_title: "Straftat" },
        ]}
      />,
    );
    const bgbLinks = screen.getAllByRole("link", { name: /BGB/ });
    const stgbLinks = screen.getAllByRole("link", { name: /StGB/ });
    expect(bgbLinks[0]).toHaveAttribute("href", "/laws/BGB");
    expect(stgbLinks[0]).toHaveAttribute("href", "/laws/StGB");
  });

  it('shows "Referenced Statutes" heading when cited laws exist', () => {
    render(
      <ChatMessageBubble
        role="assistant"
        content="Analysis..."
        index={0}
        citedLaws={[{ law_key: "BGB", norm_id: "§ 433", law_title: "" }]}
      />,
    );
    expect(screen.getByText("Referenced Statutes")).toBeInTheDocument();
  });

  it("does not show cited laws section when citedLaws is undefined", () => {
    render(<ChatMessageBubble role="user" content="Question" index={0} />);
    expect(screen.queryByText("Referenced Statutes")).not.toBeInTheDocument();
  });

  it("does not show cited laws section when citedLaws is empty", () => {
    render(
      <ChatMessageBubble
        role="assistant"
        content="Answer"
        index={0}
        citedLaws={[]}
      />,
    );
    expect(screen.queryByText("Referenced Statutes")).not.toBeInTheDocument();
  });

  it("pads single-digit index with leading zero", () => {
    render(<ChatMessageBubble role="assistant" content="Test" index={5} />);
    expect(screen.getByText("Response #05")).toBeInTheDocument();
  });

  it("shows double-digit index without extra padding", () => {
    render(<ChatMessageBubble role="assistant" content="Test" index={42} />);
    expect(screen.getByText("Response #42")).toBeInTheDocument();
  });
});
