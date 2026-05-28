import { buildSeedProjects } from "./project-seed";

const projects = buildSeedProjects();

function sortValues(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
  );
}

export const PRESET_CONSTRUTORAS = sortValues(projects.map((project) => project.construtora));

export const PRESET_OBRAS_BY_CONSTRUTORA: Record<string, string[]> = PRESET_CONSTRUTORAS.reduce(
  (acc, construtora) => {
    acc[construtora] = sortValues(
      projects
        .filter((project) => project.construtora === construtora)
        .map((project) => project.obra),
    );
    return acc;
  },
  {} as Record<string, string[]>,
);

export const PRESET_OBRAS = sortValues(projects.map((project) => project.obra));
export const PRESET_VENDEDORES = sortValues(projects.map((project) => project.vendedor));
export const PRESET_EQUIPAMENTOS = sortValues(projects.map((project) => project.equipamento));
