import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock motion/react to render plain elements
const motionProps = new Set(["initial", "animate", "transition", "variants", "whileHover", "whileTap", "layoutId", "exit"]);
function filterMotionProps(props: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(props).filter(([k]) => !motionProps.has(k)));
}

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      return <div {...(filterMotionProps(props) as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>;
    },
    circle: (props: Record<string, unknown>) => {
      return <circle {...(filterMotionProps(props) as React.SVGAttributes<SVGCircleElement>)} />;
    },
  },
}));

import { ScoreGauge } from "./ScoreGauge";

describe("ScoreGauge", () => {
  it("renders SVG with correct dimensions", () => {
    const { container } = render(<ScoreGauge score={0.85} size={100} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("width")).toBe("100");
    expect(svg!.getAttribute("height")).toBe("100");
  });

  it("displays percentage value when showValue is true (default)", () => {
    render(<ScoreGauge score={0.85} />);
    expect(screen.getByText("85")).toBeInTheDocument();
  });

  it("hides value when showValue is false", () => {
    render(<ScoreGauge score={0.85} showValue={false} />);
    expect(screen.queryByText("85")).not.toBeInTheDocument();
  });

  it("renders label when provided", () => {
    render(<ScoreGauge score={0.5} label="Score" />);
    expect(screen.getByText("Score")).toBeInTheDocument();
  });

  it("does not render label when not provided", () => {
    render(<ScoreGauge score={0.5} />);
    expect(screen.queryByText("Score")).not.toBeInTheDocument();
  });

  it("uses green color for high scores (>=0.7)", () => {
    render(<ScoreGauge score={0.85} />);
    const valueEl = screen.getByText("85");
    expect(valueEl.style.color).toBe("var(--rep-high)");
  });

  it("uses yellow color for mid scores (0.4-0.7)", () => {
    render(<ScoreGauge score={0.5} />);
    const valueEl = screen.getByText("50");
    expect(valueEl.style.color).toBe("var(--rep-mid)");
  });

  it("uses red color for low scores (<0.4)", () => {
    render(<ScoreGauge score={0.2} />);
    const valueEl = screen.getByText("20");
    expect(valueEl.style.color).toBe("var(--rep-low)");
  });

  it("renders two circle elements (background + score arc)", () => {
    const { container } = render(<ScoreGauge score={0.75} />);
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
  });
});
