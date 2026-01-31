import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FolderKanban } from "lucide-react";
import { MetricCard } from "./MetricCard";

describe("MetricCard", () => {
  it("renders label text", () => {
    render(<MetricCard label="Projects" value={5} icon={FolderKanban} />);
    expect(screen.getByText("Projects")).toBeInTheDocument();
  });

  it("renders string values directly", () => {
    render(<MetricCard label="Status" value="Active" icon={FolderKanban} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders numeric values via AnimatedNumber (starts at 0)", () => {
    render(<MetricCard label="Count" value={42} icon={FolderKanban} />);
    // AnimatedNumber starts at 0
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders detail text when provided", () => {
    render(
      <MetricCard label="Tasks" value={10} icon={FolderKanban} detail="3 active" />,
    );
    expect(screen.getByText("3 active")).toBeInTheDocument();
  });

  it("does not render detail when not provided", () => {
    const { container } = render(
      <MetricCard label="Tasks" value={10} icon={FolderKanban} />,
    );
    // Should have label and value but no detail
    expect(container.querySelectorAll(".text-xs")).toHaveLength(0);
  });

  it("applies animation delay based on index prop", () => {
    const { container } = render(
      <MetricCard label="Tasks" value={5} icon={FolderKanban} index={3} />,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.style.animationDelay).toBe("180ms"); // 3 * 60
  });

  it("renders the icon", () => {
    const { container } = render(
      <MetricCard label="Projects" value={5} icon={FolderKanban} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });
});
