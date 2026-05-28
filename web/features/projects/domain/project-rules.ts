import { addDays, differenceInCalendarDays, formatISO, parseISO } from "date-fns";
import type {
  AlignmentAutomationResult,
  PrazoBadge,
  Project,
  StatusHistoryItem,
  ProjectStatus,
} from "./project-types";

export type SlaState = "ok" | "atencao" | "estourado";

export type ProjectOperationalKpis = {
  diasDesdeCadastro: number;
  diasSemAtualizacao: number;
  diasNoStatusAtual: number;
  slaTargetDias: number;
  slaRestanteDias: number;
  slaState: SlaState;
};

const STATUS_SLA_TARGET_DAYS: Record<ProjectStatus, number> = {
  "CADASTRO INICIAL": 3,
  "ELABORAR ANTE-PROJETO": 10,
  "ANTE-PROJETO ENVIADO": 7,
  "ANTE-PROJETO APROVADO": 7,
  "PROJETO APROVADO": 7,
  "PROJETO FINAL ENVIADO": 5,
  "REVISAO DE ESTUDO": 4,
};

export function todayIsoDate(): string {
  return formatISO(new Date(), { representation: "date" });
}

export function computePrazoEntrega(dataAlinhamento: string | null, prazoPrerequisitosOk = true): string | null {
  if (!prazoPrerequisitosOk || !dataAlinhamento) return null;
  return formatISO(addDays(parseISO(dataAlinhamento), 45), { representation: "date" });
}

export function computePrazoBadge(todayISO: string, prazoEntregaISO: string | null): PrazoBadge {
  if (!prazoEntregaISO) return "sem_prazo";
  const delta = differenceInCalendarDays(parseISO(prazoEntregaISO), parseISO(todayISO));
  if (delta < 0) return "atrasado";
  if (delta <= 15) return "atencao";
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
  if (input.currentStatus === "CADASTRO INICIAL" && input.nextStatus !== "ELABORAR ANTE-PROJETO") {
    throw new Error("Projeto em cadastro inicial so pode avancar para elaborar ante-projeto.");
  }

  if (input.currentStatus !== "CADASTRO INICIAL" && input.nextStatus === "CADASTRO INICIAL") {
    throw new Error("Este projeto ja foi liberado para elaboracao de anteprojeto e nao pode retornar automaticamente para a fase inicial.");
  }

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
    "CADASTRO INICIAL": 0,
    "ELABORAR ANTE-PROJETO": 1,
    "ANTE-PROJETO ENVIADO": 2,
    "ANTE-PROJETO APROVADO": 3,
    "PROJETO APROVADO": 4,
    "PROJETO FINAL ENVIADO": 5,
    "REVISAO DE ESTUDO": 6,
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

export function computeNextAction(project: Project): string {
  if (!project.proj_obra_recebido) return "Aguardando projeto do cliente";
  if (!project.local_cabine_definido) return "Aguardando localizacao da cabine";

  if (project.status_atual === "CADASTRO INICIAL") {
    if (!project.alinhamento) return "Aguardando alinhamento";
    return "Liberar para elaborar anteprojeto";
  }

  if (project.status_atual === "ELABORAR ANTE-PROJETO") return "Elaborar anteprojeto";
  if (project.status_atual === "ANTE-PROJETO ENVIADO") return "Aguardando aprovacao do cliente";
  if (project.status_atual === "ANTE-PROJETO APROVADO") return "Consolidar projeto aprovado";
  if (project.status_atual === "PROJETO APROVADO") return "Preparar envio do projeto final";
  if (project.status_atual === "PROJETO FINAL ENVIADO") return "Acompanhar validacao final";
  return "Revisar estudo e ajustar pendencias";
}

export function computeOperationalKpis(
  project: Project,
  statusHistory: StatusHistoryItem[],
  todayISO = todayIsoDate(),
): ProjectOperationalKpis {
  const today = parseISO(todayISO);
  const cadastro = parseISO(project.data_lancamento);
  const updated = parseISO(project.updated_at);

  const latestCurrentStatusEntry = statusHistory
    .filter((item) => item.status_para === project.status_atual)
    .sort((a, b) => (a.alterado_em < b.alterado_em ? 1 : -1))[0];

  const enteredStatusAt = parseISO(latestCurrentStatusEntry?.alterado_em ?? project.created_at);

  const diasDesdeCadastro = Math.max(differenceInCalendarDays(today, cadastro), 0);
  const diasSemAtualizacao = Math.max(differenceInCalendarDays(today, updated), 0);
  const diasNoStatusAtual = Math.max(differenceInCalendarDays(today, enteredStatusAt), 0);

  const slaTargetDias = STATUS_SLA_TARGET_DAYS[project.status_atual];
  const slaRestanteDias = slaTargetDias - diasNoStatusAtual;

  let slaState: SlaState = "ok";
  if (slaRestanteDias < 0) slaState = "estourado";
  else if (slaRestanteDias <= 2) slaState = "atencao";

  return {
    diasDesdeCadastro,
    diasSemAtualizacao,
    diasNoStatusAtual,
    slaTargetDias,
    slaRestanteDias,
    slaState,
  };
}
