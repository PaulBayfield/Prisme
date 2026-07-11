import { render, screen } from "@testing-library/react";
import { Wallet } from "lucide-react";
import { describe, expect, it } from "vitest";

import { KpiCard } from "./kpi-card";

describe("KpiCard", () => {
  it("renders the label and value", () => {
    render(<KpiCard label="Solde total" value="1 234,56 €" icon={Wallet} />);
    expect(screen.getByText("Solde total")).toBeInTheDocument();
    expect(screen.getByText("1 234,56 €")).toBeInTheDocument();
  });

  it("renders the hint when provided", () => {
    render(<KpiCard label="Solde total" value="1 234,56 €" icon={Wallet} hint="Mis à jour hier" />);
    expect(screen.getByText("Mis à jour hier")).toBeInTheDocument();
  });

  it("omits the hint paragraph when not provided", () => {
    const { container } = render(<KpiCard label="Solde total" value="1 234,56 €" icon={Wallet} />);
    expect(container.querySelector("p")).toBeNull();
  });

  it("still renders the value as plain text (no tooltip wrapper) when details is empty", () => {
    render(<KpiCard label="Solde total" value="42 €" icon={Wallet} details={[]} />);
    expect(screen.getByText("42 €")).toBeInTheDocument();
  });

  it("renders the value inside a tooltip trigger when details are provided", () => {
    render(
      <KpiCard
        label="Solde total"
        value="42 €"
        icon={Wallet}
        details={[{ label: "Compte courant", value: "20 €" }]}
      />,
    );
    expect(screen.getByText("42 €")).toBeInTheDocument();
  });
});
