import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// App Router não está montado no jsdom — mock mínimo do useRouter.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
}));

import { ProjectsPageShell } from "@/features/projects/components/projects-page-shell";

describe("projects page", () => {
  it("renderiza shell principal", () => {
    render(<ProjectsPageShell />);
    expect(screen.getByRole("heading", { name: /^Projetos$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Novo projeto/i })).toBeInTheDocument();
  });
});
