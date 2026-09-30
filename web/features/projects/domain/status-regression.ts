// Regressão administrativa de status (somente ADMIN) — regras PURAS, sem Prisma,
// usadas pelo cliente (destinos do modal) e pelo servidor (validação real).
//
// É uma operação SEPARADA do fluxo normal: não usa nem altera ALLOWED_TRANSITIONS.
// Cada etapa tem um NÍVEL explícito no caminho principal; o ADMIN pode voltar
// para qualquer etapa do caminho principal com nível MENOR que o atual.
// Revisões têm o nível do envio que as originou e NUNCA são destino (entrar em
// revisão é um evento do fluxo normal: contador, registro com motivo do cliente
// e SLA de 20 dias).

import type { ProjectStatus } from "./project-types";

/** Origem gravada no histórico — reservada: só o servidor, em regressStatus, a grava. */
export const ADMIN_REGRESSION_SOURCE = "admin_regression" as const;

export const REGRESSION_REASON_MIN = 5;
export const REGRESSION_REASON_MAX = 500;

const REGRESSION_LEVEL: Record<ProjectStatus, number> = {
  "CADASTRO INICIAL": 0,
  "ELABORAR ANTE-PROJETO": 1,
  "ANTE-PROJETO ENVIADO": 2,
  "REVISAO DE ESTUDO": 2,
  "ANTE-PROJETO APROVADO": 3,
  "PROJETO FINAL ENVIADO": 4,
  "REVISAO DE PROJETO FINAL": 4,
  "PROJETO APROVADO": 5,
};

/** Etapas do caminho principal — as únicas que podem ser destino, em ordem. */
const MAIN_PATH: ProjectStatus[] = [
  "CADASTRO INICIAL",
  "ELABORAR ANTE-PROJETO",
  "ANTE-PROJETO ENVIADO",
  "ANTE-PROJETO APROVADO",
  "PROJETO FINAL ENVIADO",
  "PROJETO APROVADO",
];

/** Destinos de regressão a partir do status atual (do mais antigo ao mais recente). */
export function getRegressionTargets(current: ProjectStatus): ProjectStatus[] {
  const level = REGRESSION_LEVEL[current];
  if (level === undefined) return [];
  return MAIN_PATH.filter((status) => REGRESSION_LEVEL[status] < level);
}

export function isRegressionTarget(current: ProjectStatus, target: ProjectStatus): boolean {
  return getRegressionTargets(current).includes(target);
}

export type RegressionReasonCheck = { ok: true; reason: string } | { ok: false; error: string };

/** Motivo obrigatório: trim, entre REGRESSION_REASON_MIN e REGRESSION_REASON_MAX caracteres. */
export function normalizeRegressionReason(input: unknown): RegressionReasonCheck {
  const reason = typeof input === "string" ? input.trim() : "";
  if (reason.length < REGRESSION_REASON_MIN) {
    return { ok: false, error: `Informe o motivo da regressão (mínimo ${REGRESSION_REASON_MIN} caracteres).` };
  }
  if (reason.length > REGRESSION_REASON_MAX) {
    return { ok: false, error: `O motivo da regressão deve ter no máximo ${REGRESSION_REASON_MAX} caracteres.` };
  }
  return { ok: true, reason };
}

/** Regredir para Cadastro Inicial desmarca "Alinhamento concluído" (evita o avanço automático na próxima edição). */
export function regressionResetsAlignment(target: ProjectStatus): boolean {
  return target === "CADASTRO INICIAL";
}
