// Opções do filtro "Tipo de Cabine" da tela de Projetos.
//
// Fonte: cadastro oficial de Tipos de Cabine (master-data store) — nada
// hardcodado. O VALOR de cada opção é o ID (CabinType.id), não o nome.
//
// Regra de exibição:
// 1. todos os tipos ATIVOS;
// 2. tipos INATIVOS somente se ainda houver projeto vinculado a eles
//    (rotulados "Nome (inativo)") — inativar um cadastro não pode tornar
//    projetos históricos impossíveis de localizar;
// 3. o tipo SELECIONADO no filtro sempre permanece na lista, para o combobox
//    nunca mostrar um filtro ativo sem rótulo.
//
// Ordenação: ativos primeiro, depois inativos; cada grupo em ordem alfabética.

import type { TipoCabine } from "@/features/master-data/domain/master-data-types";
import type { Project } from "./project-types";

export const INACTIVE_CABIN_TYPE_SUFFIX = " (inativo)";

export type CabinTypeFilterOption = { value: string; label: string };

export function buildCabinTypeFilterOptions(
  tiposCabine: ReadonlyArray<Pick<TipoCabine, "id" | "name" | "active">>,
  projects: ReadonlyArray<Pick<Project, "tipo_cabine_id">>,
  selectedId: string,
): CabinTypeFilterOption[] {
  const linkedIds = new Set<string>();
  for (const project of projects) {
    if (project.tipo_cabine_id) linkedIds.add(project.tipo_cabine_id);
  }

  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

  const active = tiposCabine.filter((t) => t.active).sort(byName);
  const inactive = tiposCabine
    .filter((t) => !t.active && (linkedIds.has(t.id) || t.id === selectedId))
    .sort(byName);

  return [
    ...active.map((t) => ({ value: t.id, label: t.name })),
    ...inactive.map((t) => ({ value: t.id, label: `${t.name}${INACTIVE_CABIN_TYPE_SUFFIX}` })),
  ];
}
