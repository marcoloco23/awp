import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock motion/react for MotionWrapper
const motionProps = new Set(["initial", "animate", "transition", "variants", "whileHover", "whileTap", "layoutId", "exit"]);
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const filtered = Object.fromEntries(Object.entries(props).filter(([k]) => !motionProps.has(k)));
      return <div {...(filtered as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>;
    },
  },
}));

import { AgentIdentityCard } from "./AgentIdentityCard";

const baseIdentity = {
  frontmatter: {
    name: "Clawd",
    emoji: "\u{1F43E}",
    capabilities: ["coding", "research"],
    creature: "Digital Fox",
  },
  body: "Identity body",
};

describe("AgentIdentityCard", () => {
  it("renders nothing when identity is null", () => {
    const { container } = render(
      <AgentIdentityCard identity={null} soul={null} manifest={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders agent name", () => {
    render(
      <AgentIdentityCard identity={baseIdentity as never} soul={null} manifest={null} />,
    );
    expect(screen.getByText("Clawd")).toBeInTheDocument();
  });

  it("renders emoji", () => {
    render(
      <AgentIdentityCard identity={baseIdentity as never} soul={null} manifest={null} />,
    );
    expect(screen.getByText("\u{1F43E}")).toBeInTheDocument();
  });

  it("renders creature type", () => {
    render(
      <AgentIdentityCard identity={baseIdentity as never} soul={null} manifest={null} />,
    );
    expect(screen.getByText("Digital Fox")).toBeInTheDocument();
  });

  it("renders capabilities as badges", () => {
    render(
      <AgentIdentityCard identity={baseIdentity as never} soul={null} manifest={null} />,
    );
    expect(screen.getByText("coding")).toBeInTheDocument();
    expect(screen.getByText("research")).toBeInTheDocument();
  });

  it("renders soul vibe when provided", () => {
    const soul = {
      frontmatter: { vibe: "Curious and methodical" },
      body: "",
    };
    render(
      <AgentIdentityCard
        identity={baseIdentity as never}
        soul={soul as never}
        manifest={null}
      />,
    );
    // The vibe is wrapped in curly quotes
    expect(screen.getByText(/Curious and methodical/)).toBeInTheDocument();
  });

  it("renders MCP badge when manifest has mcp protocol", () => {
    const manifest = { protocols: { mcp: true } };
    render(
      <AgentIdentityCard
        identity={baseIdentity as never}
        soul={null}
        manifest={manifest as never}
      />,
    );
    expect(screen.getByText("MCP")).toBeInTheDocument();
  });

  it("renders A2A badge when manifest has a2a protocol", () => {
    const manifest = { protocols: { a2a: true } };
    render(
      <AgentIdentityCard
        identity={baseIdentity as never}
        soul={null}
        manifest={manifest as never}
      />,
    );
    expect(screen.getByText("A2A")).toBeInTheDocument();
  });

  it("uses default robot emoji when no emoji provided", () => {
    const identity = {
      frontmatter: { name: "Bot", capabilities: [] },
      body: "",
    };
    render(
      <AgentIdentityCard identity={identity as never} soul={null} manifest={null} />,
    );
    expect(screen.getByText("\u{1F916}")).toBeInTheDocument();
  });
});
