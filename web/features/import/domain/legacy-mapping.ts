// Mapeamento de status do CSV legado para o enum interno. Módulo puro, testável.

import type { DbStatus } from "@/features/projects/domain/project-status-map";
import { normalizeName } from "./import-normalize";

export type AnteStatusResult =
  | { ok: true; status: DbStatus; urgente: boolean; assumed: boolean }
  | { ok: false; raw: string };

// Texto do CSV (normalizado) -> status interno.
const ANTE_STATUS_MAP: Record<string, DbStatus> = {
  "elaborar ante-projeto": "ELABORAR_ANTE_PROJETO",
  "ante-projeto enviado": "ANTE_PROJETO_ENVIADO",
  "ante-projeto aprovado": "ANTE_PROJETO_APROVADO",
  "revisao de estudo": "REVISAO_DE_ESTUDO",
  "projeto aprovado": "PROJETO_APROVADO",
  "projeto final enviado": "PROJETO_FINAL_ENVIADO",
};

/** Mapeia o STATUS do arquivo ANTE-PROJETO. "URGENTE!" não tem status original:
 *  assume ELABORAR_ANTE_PROJETO + urgente=true e marca `assumed` p/ revisão. */
export function mapAnteStatus(raw: string): AnteStatusResult {
  const key = normalizeName(raw);
  if (key in ANTE_STATUS_MAP) return { ok: true, status: ANTE_STATUS_MAP[key], urgente: false, assumed: false };
  if (key === "urgente!" || key === "urgente") {
    return { ok: true, status: "ELABORAR_ANTE_PROJETO", urgente: true, assumed: true };
  }
  return { ok: false, raw };
}

/** Status inicial do CADASTRO INICIAL a partir das 3 flags. */
export function cadastroInitialStatus(
  projObra: boolean,
  localCabine: boolean,
  alinhamento: boolean,
): DbStatus {
  return projObra && localCabine && alinhamento ? "ELABORAR_ANTE_PROJETO" : "CADASTRO_INICIAL";
}
