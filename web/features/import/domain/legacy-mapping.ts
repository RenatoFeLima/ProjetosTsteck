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
  // No sistema novo PROJETO_APROVADO é o status terminal; PROJETO_FINAL_ENVIADO vem antes.
  // O CSV legado usava a nomenclatura invertida — trocamos aqui na importação.
  "projeto aprovado": "PROJETO_FINAL_ENVIADO",
  "projeto final enviado": "PROJETO_APROVADO",
};

/** Mapeia o STATUS do arquivo ANTE-PROJETO.
 *  "URGENTE!" sozinho → ELABORAR_ANTE_PROJETO + urgente=true (assumed=true).
 *  "URGENTE! PROJETO FINAL ENVIADO" → status real extraído + urgente=true.
 *  Status desconhecido → ok:false para listagem no dry-run. */
export function mapAnteStatus(raw: string): AnteStatusResult {
  const key = normalizeName(raw);

  // Match direto.
  if (key in ANTE_STATUS_MAP) return { ok: true, status: ANTE_STATUS_MAP[key], urgente: false, assumed: false };

  // Contém "urgente" — verifica se há status real após remover o prefixo urgente.
  if (key.startsWith("urgente!") || key.startsWith("urgente ") || key === "urgente!" || key === "urgente") {
    const remainder = key.replace(/^urgente!?\s*/, "").trim();
    if (remainder && remainder in ANTE_STATUS_MAP) {
      return { ok: true, status: ANTE_STATUS_MAP[remainder], urgente: true, assumed: false };
    }
    // URGENTE! sozinho ou com texto desconhecido → assume ELABORAR_ANTE_PROJETO.
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
