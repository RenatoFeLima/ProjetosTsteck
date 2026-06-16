import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectsPageShell } from "@/features/projects/components/projects-page-shell";

describe("projects page", () => {
  it("renderiza shell principal", () => {
    render(<ProjectsPageShell />);
    expect(screen.getByRole("heading", { name: /^Projetos$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Novo projeto/i })).toBeInTheDocument();
  });
});
