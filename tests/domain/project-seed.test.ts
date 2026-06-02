import { describe, expect, it } from "vitest";
import { buildSeedProjects } from "@/features/projects/domain/project-seed";

describe("project seed", () => {
  it("gera base consolidada com volume significativo", () => {
    const seed = buildSeedProjects();
    expect(seed.length).toBeGreaterThanOrEqual(200);
  });

  it("possui pelo menos um urgente e um sem alinhamento", () => {
    const seed = buildSeedProjects();
    expect(seed.some((project) => project.urgente)).toBe(true);
    expect(seed.some((project) => project.alinhamento === false)).toBe(true);
  });

  it("nao possui duplicidade de codigo de projeto", () => {
    const seed = buildSeedProjects();
    const normalizedCodes = seed.map((project) => project.codigo_projeto.trim().toUpperCase());
    const unique = new Set(normalizedCodes);
    expect(unique.size).toBe(normalizedCodes.length);
  });
});
