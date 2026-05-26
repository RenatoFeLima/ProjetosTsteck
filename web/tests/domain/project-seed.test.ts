import { describe, expect, it } from "vitest";
import { buildSeedProjects } from "@/features/projects/domain/project-seed";

describe("project seed", () => {
  it("gera 20 a 30 projetos", () => {
    const seed = buildSeedProjects();
    expect(seed.length).toBeGreaterThanOrEqual(20);
    expect(seed.length).toBeLessThanOrEqual(30);
  });

  it("possui pelo menos um urgente e um sem alinhamento", () => {
    const seed = buildSeedProjects();
    expect(seed.some((project) => project.urgente)).toBe(true);
    expect(seed.some((project) => project.alinhamento === false)).toBe(true);
  });
});
