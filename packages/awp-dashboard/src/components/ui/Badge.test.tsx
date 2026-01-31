import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, StatusBadge, PriorityBadge } from "./Badge";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Hello</Badge>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders as a span element", () => {
    render(<Badge>Test</Badge>);
    expect(screen.getByText("Test").tagName).toBe("SPAN");
  });

  it("applies default variant classes", () => {
    render(<Badge>Default</Badge>);
    const el = screen.getByText("Default");
    expect(el.className).toContain("font-mono");
    expect(el.className).toContain("border");
    expect(el.className).toContain("rounded-md");
  });

  it("applies sm size by default", () => {
    render(<Badge>Small</Badge>);
    const el = screen.getByText("Small");
    expect(el.className).toContain("text-[10px]");
  });

  it("applies md size when specified", () => {
    render(<Badge size="md">Medium</Badge>);
    const el = screen.getByText("Medium");
    expect(el.className).toContain("text-xs");
  });

  it("applies variant-specific classes for success", () => {
    render(<Badge variant="success">Pass</Badge>);
    const el = screen.getByText("Pass");
    expect(el.className).toContain("success");
  });

  it("applies variant-specific classes for danger", () => {
    render(<Badge variant="danger">Fail</Badge>);
    const el = screen.getByText("Fail");
    expect(el.className).toContain("danger");
  });
});

describe("StatusBadge", () => {
  it("renders status text", () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("maps 'blocked' to danger variant", () => {
    render(<StatusBadge status="blocked" />);
    const el = screen.getByText("blocked");
    expect(el.className).toContain("danger");
  });

  it("maps 'review' to warning variant", () => {
    render(<StatusBadge status="review" />);
    const el = screen.getByText("review");
    expect(el.className).toContain("warning");
  });

  it("falls back to default for unknown status", () => {
    render(<StatusBadge status="unknown" />);
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });
});

describe("PriorityBadge", () => {
  it("renders priority text", () => {
    render(<PriorityBadge priority="high" />);
    expect(screen.getByText("high")).toBeInTheDocument();
  });

  it("maps 'critical' to danger variant", () => {
    render(<PriorityBadge priority="critical" />);
    const el = screen.getByText("critical");
    expect(el.className).toContain("danger");
  });
});
