import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnimatedNumber } from "./AnimatedNumber";

describe("AnimatedNumber", () => {
  it("renders a span element", () => {
    render(<AnimatedNumber value={42} />);
    const span = screen.getByText("0"); // initial display is 0
    expect(span.tagName).toBe("SPAN");
  });

  it("displays 0 initially before animation", () => {
    render(<AnimatedNumber value={100} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("displays 0 when value is 0", () => {
    render(<AnimatedNumber value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("applies className when provided", () => {
    render(<AnimatedNumber value={42} className="test-class" />);
    const span = screen.getByText("0");
    expect(span.className).toBe("test-class");
  });
});
