// Opções do filtro "Tipo de Cabine": ativos + inativos ainda vinculados.
import { describe, expect, it } from "vitest";
import { buildCabinTypeFilterOptions } from "@/features/projects/domain/cabin-type-filter";

const TIPOS = [
  { id: "ct-simples", name: "Simples", active: true },
  { id: "ct-dupla", name: "Dupla", active: true },
  { id: "ct-especial", name: "Especial", active: true },
  { id: "ct-legado", name: "Modelo Legado", active: false },
  { id: "ct-orfao", name: "Modelo Descontinuado", active: false },
];

const PROJETOS = [
  { tipo_cabine_id: "ct-simples" },
  { tipo_cabine_id: "ct-legado" }, // inativo COM projeto
  { tipo_cabine_id: null }, // sem tipo
  {}, // campo ausente (DTO antigo)
];

describe("buildCabinTypeFilterOptions", () => {
  it("usa o ID como valor e o nome como rótulo (nada hardcodado)", () => {
    const options = buildCabinTypeFilterOptions(TIPOS, PROJETOS, "");
    expect(options.find((o) => o.label === "Simples")?.value).toBe("ct-simples");
  });

  it("lista TODOS os ativos, mesmo sem projeto vinculado", () => {
    const values = buildCabinTypeFilterOptions(TIPOS, PROJETOS, "").map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(["ct-simples", "ct-dupla", "ct-especial"]));
  });

  it("inclui inativo com projeto vinculado, rotulado '(inativo)'", () => {
    const legado = buildCabinTypeFilterOptions(TIPOS, PROJETOS, "").find((o) => o.value === "ct-legado");
    expect(legado?.label).toBe("Modelo Legado (inativo)");
  });

  it("omite inativo SEM projeto vinculado", () => {
    const values = buildCabinTypeFilterOptions(TIPOS, PROJETOS, "").map((o) => o.value);
    expect(values).not.toContain("ct-orfao");
  });

  it("mantém o tipo selecionado na lista mesmo se inativo e sem projetos", () => {
    const orfao = buildCabinTypeFilterOptions(TIPOS, PROJETOS, "ct-orfao").find(
      (o) => o.value === "ct-orfao",
    );
    expect(orfao?.label).toBe("Modelo Descontinuado (inativo)");
  });

  it("ativos primeiro em ordem alfabética, inativos depois", () => {
    const labels = buildCabinTypeFilterOptions(TIPOS, PROJETOS, "").map((o) => o.label);
    expect(labels).toEqual(["Dupla", "Especial", "Simples", "Modelo Legado (inativo)"]);
  });

  it("ativo nunca recebe o sufixo '(inativo)'", () => {
    const labels = buildCabinTypeFilterOptions(TIPOS, PROJETOS, "").map((o) => o.label);
    expect(labels.filter((l) => !l.includes("Legado")).every((l) => !l.includes("(inativo)"))).toBe(true);
  });

  it("sem cadastro carregado → lista vazia (não quebra)", () => {
    expect(buildCabinTypeFilterOptions([], PROJETOS, "")).toEqual([]);
  });
});
