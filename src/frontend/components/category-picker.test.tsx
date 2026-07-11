import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeUseTranslations } from "@/test/mock-translations";
import type { Category, PredictedCategory } from "@/lib/types";

vi.mock("next-intl", () => ({
  useTranslations: makeUseTranslations(),
}));

const addTransactionCategory = vi.fn();
const removeTransactionCategory = vi.fn();
const acceptPredictedCategory = vi.fn();
const rejectPredictedCategory = vi.fn();
vi.mock("@/lib/actions", () => ({
  addTransactionCategory: (...args: unknown[]) => addTransactionCategory(...args),
  removeTransactionCategory: (...args: unknown[]) => removeTransactionCategory(...args),
  acceptPredictedCategory: (...args: unknown[]) => acceptPredictedCategory(...args),
  rejectPredictedCategory: (...args: unknown[]) => rejectPredictedCategory(...args),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (...args: unknown[]) => toastError(...args) },
}));

import { CategoryPicker } from "./category-picker";

const categories: Category[] = [
  { id: 1, parentId: null, name: "Alimentation", color: "#22c55e", effectiveColor: "#22c55e" },
  { id: 2, parentId: null, name: "Transport", color: "#3b82f6", effectiveColor: "#3b82f6" },
];

describe("CategoryPicker", () => {
  beforeEach(() => {
    addTransactionCategory.mockReset().mockResolvedValue(undefined);
    removeTransactionCategory.mockReset().mockResolvedValue(undefined);
    acceptPredictedCategory.mockReset().mockResolvedValue(undefined);
    rejectPredictedCategory.mockReset().mockResolvedValue(undefined);
    toastError.mockClear();
  });

  it("shows the placeholder text when no category is assigned", () => {
    render(<CategoryPicker rowId={1} assigned={[]} categories={categories} />);
    expect(screen.getByText("noCategory")).toBeInTheDocument();
  });

  it("shows assigned category names on the trigger", () => {
    render(
      <CategoryPicker
        rowId={1}
        assigned={[{ id: 1, name: "Alimentation", color: "#22c55e" }]}
        categories={categories}
      />,
    );
    expect(screen.getByText("Alimentation")).toBeInTheDocument();
    expect(screen.queryByText("noCategory")).not.toBeInTheDocument();
  });

  it("opens the popover and marks the assigned category with a visible check", async () => {
    const user = userEvent.setup();
    render(
      <CategoryPicker
        rowId={1}
        assigned={[{ id: 1, name: "Alimentation", color: "#22c55e" }]}
        categories={categories}
      />,
    );

    await user.click(screen.getByText("Alimentation"));

    // Both the trigger chip and the popover's own list rows can match a name
    // query for "Alimentation"/"Transport" (the chip renders the assigned
    // category's name too) - popover list rows are the `rounded-sm` buttons,
    // as opposed to the trigger's `rounded-full` pill, so key off that.
    const options = await screen.findAllByRole("button", { name: /Alimentation|Transport/ });
    const listOptions = options.filter((option) => option.className.includes("rounded-sm"));
    const assignedOption = listOptions.find((option) => option.textContent?.includes("Alimentation"));
    const unassignedOption = listOptions.find((option) => option.textContent?.includes("Transport"));

    expect(assignedOption?.querySelector("svg")?.getAttribute("class")).toContain("opacity-100");
    expect(unassignedOption?.querySelector("svg")?.getAttribute("class")).toContain("opacity-0");
  });

  it("filters the category list as the user types in the search box", async () => {
    const user = userEvent.setup();
    render(<CategoryPicker rowId={1} assigned={[]} categories={categories} />);

    await user.click(screen.getByText("noCategory"));
    const search = await screen.findByPlaceholderText("searchPlaceholder");
    await user.type(search, "trans");

    expect(screen.getByText("Transport")).toBeInTheDocument();
    expect(screen.queryByText("Alimentation")).not.toBeInTheDocument();
  });

  it("calls addTransactionCategory when clicking an unassigned category", async () => {
    const user = userEvent.setup();
    render(<CategoryPicker rowId={5} assigned={[]} categories={categories} />);

    await user.click(screen.getByText("noCategory"));
    await user.click(await screen.findByText("Transport"));

    expect(addTransactionCategory).toHaveBeenCalledWith(5, 2);
    expect(removeTransactionCategory).not.toHaveBeenCalled();
  });

  it("calls removeTransactionCategory when clicking an already-assigned category", async () => {
    const user = userEvent.setup();
    render(
      <CategoryPicker
        rowId={5}
        assigned={[{ id: 2, name: "Transport", color: "#3b82f6" }]}
        categories={categories}
      />,
    );

    await user.click(screen.getByText("Transport"));
    // Two "Transport" occurrences after opening: the trigger chip (a
    // `rounded-full` pill) and the popover list item (a `rounded-sm` row) -
    // target the list row.
    const popoverOption = (await screen.findAllByText("Transport")).find((el) =>
      el.closest("button")?.className.includes("rounded-sm"),
    );
    await user.click(popoverOption!);

    expect(removeTransactionCategory).toHaveBeenCalledWith(5, 2);
    expect(addTransactionCategory).not.toHaveBeenCalled();
  });

  it("renders predicted categories with accept/reject controls and confidence percentage", () => {
    const predicted: PredictedCategory[] = [
      { id: 3, name: "Loisirs", color: "#eab308", confidence: 0.87 },
    ];
    render(<CategoryPicker rowId={1} assigned={[]} categories={categories} predictedCategories={predicted} />);

    expect(screen.getByText("Loisirs")).toBeInTheDocument();
    expect(screen.getByText("87%")).toBeInTheDocument();
    // With a prediction pending, the empty-assignment placeholder changes.
    expect(screen.getByText("chooseAnother")).toBeInTheDocument();
  });

  it("calls acceptPredictedCategory when the accept control is clicked", async () => {
    const predicted: PredictedCategory[] = [
      { id: 3, name: "Loisirs", color: "#eab308", confidence: 0.87 },
    ];
    const user = userEvent.setup();
    render(<CategoryPicker rowId={9} assigned={[]} categories={categories} predictedCategories={predicted} />);

    await user.click(screen.getByRole("button", { name: "acceptSuggestion:{\"name\":\"Loisirs\"}" }));
    expect(acceptPredictedCategory).toHaveBeenCalledWith(9, 3);
  });

  it("calls rejectPredictedCategory when the reject control is clicked", async () => {
    const predicted: PredictedCategory[] = [
      { id: 3, name: "Loisirs", color: "#eab308", confidence: 0.87 },
    ];
    const user = userEvent.setup();
    render(<CategoryPicker rowId={9} assigned={[]} categories={categories} predictedCategories={predicted} />);

    await user.click(screen.getByRole("button", { name: "rejectSuggestion:{\"name\":\"Loisirs\"}" }));
    expect(rejectPredictedCategory).toHaveBeenCalledWith(9, 3);
  });

  it("shows the no-categories message when the category list is empty", async () => {
    const user = userEvent.setup();
    render(<CategoryPicker rowId={1} assigned={[]} categories={[]} />);

    await user.click(screen.getByText("noCategory"));
    expect(await screen.findByText("noCategories")).toBeInTheDocument();
  });
});
