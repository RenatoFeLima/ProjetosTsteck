import { addDays, differenceInCalendarDays, formatISO, parseISO } from "date-fns";
import type {
  AlignmentAutomationResult,
  PrazoBadge,
  Project,
  ProjectStatus,
} from "./project-types";

export function todayIsoDate(): string {
  return formatISO(new Date(), { representation: "date" });
}

export function computePrazoEntrega(dataAlinhamento: string | null): string | null {
  if (!dataAlinhamento) return null;
  return formatISO(addDays(parseISO(dataAlinhamento), 45), { representation: "date" });
}

export function computePrazoBadge(todayISO: string, prazoEntregaISO: string | null): PrazoBadge {
  if (!prazoEntregaISO) return "sem_prazo";
  const delta = differenceInCalendarDays(parseISO(prazoEntregaISO), parseISO(todayISO));
  if (delta < 0) return "atrasado";
  if (delta <= 10) return "atencao";
  return "no_prazo";
}

export function prazoLabel(todayISO: string, prazoEntregaISO: string | null): string {
  if (!prazoEntregaISO) return "Sem prazo ativo";
  const delta = differenceInCalendarDays(parseISO(prazoEntregaISO), parseISO(todayISO));
  if (delta < 0) return `${Math.abs(delta)} dias atrasados`;
  return `${delta} dias restantes`;
}

export function canAdvanceStatus(aligned: boolean): boolean {
  return aligned;
}

export function applyAlignmentAutomation(input: {
  proj_obra_recebido: boolean;
  local_cabine_definido: boolean;
  alinhamento: boolean;
  data_alinhamento: string | null;
}): AlignmentAutomationResult {
  const prereqOk = input.proj_obra_recebido && input.local_cabine_definido;
  if (!prereqOk) {
    return { alinhamentoSuggested: false, nextDataAlinhamento: input.data_alinhamento };
  }
  return {
    alinhamentoSuggested: true,
    nextDataAlinhamento: input.data_alinhamento ?? todayIsoDate(),
  };
}

export function transitionStatus(input: {
  currentStatus: ProjectStatus;
  nextStatus: ProjectStatus;
  aligned: boolean;
  today: string;
  data_envio: string | null;
  data_aprovacao: string | null;
}) {
  if (input.currentStatus !== input.nextStatus && !input.aligned) {
    throw new Error("Nao e possivel avancar status sem alinhamento.");
  }

  return {
    data_envio:
      input.nextStatus === "ANTE-PROJETO ENVIADO" && !input.data_envio
        ? input.today
        : input.data_envio,
    data_aprovacao:
      input.nextStatus === "ANTE-PROJETO APROVADO" && !input.data_aprovacao
        ? input.today
        : input.data_aprovacao,
  };
}

export function statusOrder(status: ProjectStatus): number {
  const order: Record<ProjectStatus, number> = {
    "ELABORAR ANTE-PROJETO": 0,
    "ANTE-PROJETO ENVIADO": 1,
    "ANTE-PROJETO APROVADO": 2,
    "PROJETO APROVADO": 3,
    "PROJETO FINAL ENVIADO": 4,
    "REVISAO DE ESTUDO": 5,
  };
  return order[status];
}

export function validateRequiredFields(input: Partial<Project>): string[] {
  const required: Array<keyof Project> = [
    "construtora",
    "obra",
    "codigo_projeto",
    "vendedor",
    "equipamento",
    "data_lancamento",
  ];
  return required.filter((k) => !String(input[k] ?? "").trim());
}
