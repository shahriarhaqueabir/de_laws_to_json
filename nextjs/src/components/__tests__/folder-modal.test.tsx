import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FolderModal from "../folder-modal";

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn().mockResolvedValue(undefined),
};

describe("FolderModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <FolderModal {...defaultProps} isOpen={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders all form fields when open", () => {
    render(<FolderModal {...defaultProps} />);

    expect(screen.getByText("New Case Folder")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Wrongful Dismissal/),
    ).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Incident Date")).toBeInTheDocument();
    expect(screen.getByText("Deadline Date")).toBeInTheDocument();
    expect(screen.getByText(/Dispute Value/)).toBeInTheDocument();
    expect(screen.getByText("Opposing Party")).toBeInTheDocument();
    expect(screen.getByText(/Court Name/)).toBeInTheDocument();
    expect(screen.getByText(/Case Number/)).toBeInTheDocument();
    expect(screen.getByText(/Notes/)).toBeInTheDocument();
  });

  it("shows error when submitting without name", () => {
    const { container } = render(<FolderModal {...defaultProps} />);
    const form = container.querySelector("form");

    if (form) {
      fireEvent.submit(form);
    }

    expect(screen.getByText("Folder name is required.")).toBeInTheDocument();
  });

  it("calls onSave with form data when submitted", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<FolderModal {...defaultProps} onSave={onSave} />);

    // Fill name
    const nameInput = screen.getByPlaceholderText(/Wrongful Dismissal/);
    await user.type(nameInput, "Test Case");

    // Submit
    const submitBtn = screen.getByRole("button", { name: /save folder/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const savedData = onSave.mock.calls[0][0];
    expect(savedData.name).toBe("Test Case");
    expect(savedData.status).toBe("pre_action");
    expect(savedData.category).toBe("other");
  });

  it("calls onClose when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<FolderModal {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows edit title when initialData is provided", () => {
    render(
      <FolderModal
        {...defaultProps}
        initialData={{ name: "Existing" }}
        title="Edit Folder"
      />,
    );

    expect(screen.getByText("Edit Folder")).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText(
      /Wrongful Dismissal/,
    ) as HTMLInputElement;
    expect(nameInput.value).toBe("Existing");
  });

  it("shows saving state while submitting", async () => {
    const user = userEvent.setup();
    const onSave = vi
      .fn()
      .mockImplementation(() => new Promise((r) => setTimeout(r, 100)));

    render(<FolderModal {...defaultProps} onSave={onSave} />);

    const nameInput = screen.getByPlaceholderText(/Wrongful Dismissal/);
    await user.type(nameInput, "Test");

    const saveBtn = screen.getByRole("button", { name: /save folder/i });
    await user.click(saveBtn);

    expect(screen.getByText("Saving...")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Saving...")).not.toBeInTheDocument();
    });
  });
});
