import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HealthBanner } from "./HealthBanner";

describe("HealthBanner", () => {
  it("renders nothing when health.ok is true", () => {
    const { container } = render(<HealthBanner health={{ ok: true, warnings: [] }} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders warning count when health has warnings", () => {
    render(
      <HealthBanner
        health={{
          ok: false,
          warnings: ["IDENTITY.md missing", "SOUL.md missing"],
        }}
      />,
    );
    expect(screen.getByText("2 health warnings")).toBeInTheDocument();
  });

  it("uses singular 'warning' for single warning", () => {
    render(
      <HealthBanner
        health={{
          ok: false,
          warnings: ["IDENTITY.md missing"],
        }}
      />,
    );
    expect(screen.getByText("1 health warning")).toBeInTheDocument();
  });

  it("renders each warning message", () => {
    const warnings = ["IDENTITY.md missing", "SOUL.md missing", ".awp/workspace.json missing"];
    render(<HealthBanner health={{ ok: false, warnings }} />);

    for (const w of warnings) {
      expect(screen.getByText(w)).toBeInTheDocument();
    }
  });

  it("renders warnings as list items", () => {
    render(
      <HealthBanner
        health={{
          ok: false,
          warnings: ["Warning 1", "Warning 2"],
        }}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
  });
});
