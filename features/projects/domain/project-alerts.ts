// Regras de Alertas — fonte única usada pela aba Alertas (exibição) e pelo
// contador da aba (badge). Tudo é calculado em tempo real a partir dos projetos
// reais (MySQL); sem mock/localStorage. Arquitetura pronta para, no futuro,
// anexar estado de leitura/ACK por (projectId + alertKey).

import { differenceInCalendarDays, parseISO } from "date-fns";
import { getCurrentStatusDeadline, todayIsoDate } from "./project-rules";
import type { Project } from "./project-types";

export type AlertSeverity = "critico" | "atencao" | "informativo";
export type AlertType = "prazo" | "urgencia" | "revisao" | "cadastro" | "qualidade";

export type AlertGroupDef = {
  key: string;
  title: string;
  helper: string;
  severity: AlertSeverity;
  type: AlertType;
  /** Ação recomendada exibida no card. */
  action: string;
  /** Predicado calculado sobre o projeto real (com data de hoje opcional p/ testes). */
  match: (project: Project, today?: string) => boolean;
};

export type AlertGroup = AlertGroupDef & { projects: Project[] };

const STALLED_DAYS = 10;
const REVIEW_CYCLES_ALERT = 3;

/** Projeto sem atualização há >= 10 dias (independente de prazo de status). */
export function isStalled(project: Project, today?: string): boolean {
  const ref = parseISO(today ?? todayIsoDate());
  const updated = parseISO(project.updated_at);
  return differenceInCalendarDays(ref, updated) >= STALLED_DAYS;
}

const isReviewStatus = (p: Project) =>
  p.status_atual === "REVISAO DE ESTUDO" || p.status_atual === "REVISAO DE PROJETO FINAL";

// Ordenado por severidade (críticos → atenção → informativo) para a exibição.
export const ALERT_GROUP_DEFS: AlertGroupDef[] = [
  {
    key: "urgent",
    title: "Urgentes",
    helper: "Projetos com prioridade operacional imediata.",
    severity: "critico",
    type: "urgencia",
    action: "Tratar a prioridade alta imediatamente.",
    match: (p) => p.urgente,
  },
  {
    key: "overdue",
    title: "Atrasados",
    helper: "Projetos com o prazo da etapa atual já vencido.",
    severity: "critico",
    type: "prazo",
    action: "Prazo da etapa vencido — priorizar a tratativa com o time técnico.",
    match: (p, t) => getCurrentStatusDeadline(p, t).isOverdue,
  },
  {
    key: "due-today",
    title: "Vencendo hoje",
    helper: "Projetos cujo prazo da etapa vence hoje.",
    severity: "critico",
    type: "prazo",
    action: "Concluir a etapa hoje para não estourar o prazo.",
    match: (p, t) => {
      const dl = getCurrentStatusDeadline(p, t);
      return dl.hasDeadline && !dl.isOverdue && dl.daysRemaining === 0;
    },
  },
  {
    key: "review-overdue",
    title: "Revisões atrasadas (acima de 20 dias)",
    helper: "Revisão de Estudo ou de Projeto Final com o prazo de 20 dias esgotado.",
    severity: "critico",
    type: "revisao",
    action: "Revisão acima de 20 dias — concluir com urgência.",
    match: (p, t) => isReviewStatus(p) && getCurrentStatusDeadline(p, t).isOverdue,
  },
  {
    key: "due-7",
    title: "Vencendo em até 7 dias",
    helper: "Projetos com o prazo da etapa a vencer em até 7 dias.",
    severity: "atencao",
    type: "prazo",
    action: "Programar a conclusão da etapa dentro do prazo.",
    match: (p, t) => {
      const dl = getCurrentStatusDeadline(p, t);
      const days = dl.daysRemaining ?? 999;
      return dl.hasDeadline && !dl.isOverdue && days >= 1 && days <= 7;
    },
  },
  {
    key: "elaborar-near",
    title: "Elaborar Ante-Projeto próximo do prazo (45 dias)",
    helper: "Projetos em Elaborar Ante-Projeto com até 15 dias do prazo de 45 dias.",
    severity: "atencao",
    type: "prazo",
    action: "Acelerar a elaboração do ante-projeto.",
    match: (p, t) => {
      if (p.status_atual !== "ELABORAR ANTE-PROJETO") return false;
      const dl = getCurrentStatusDeadline(p, t);
      return dl.hasDeadline && !dl.isOverdue && (dl.daysRemaining ?? 999) <= 15;
    },
  },
  {
    key: "review-multiple",
    title: "Muitos ciclos de revisão",
    helper: "Projetos com 3 ou mais ciclos de revisão (estudo ou projeto final).",
    severity: "atencao",
    type: "qualidade",
    action: "Avaliar a causa raiz das revisões recorrentes.",
    match: (p) => (p.reviewCount ?? 0) >= REVIEW_CYCLES_ALERT || (p.finalReviewCount ?? 0) >= REVIEW_CYCLES_ALERT,
  },
  {
    key: "cadastro-incompleto",
    title: "Cadastro inicial sem alinhamento completo",
    helper: "Projetos em Cadastro Inicial sem documentação, localização ou alinhamento concluídos.",
    severity: "atencao",
    type: "cadastro",
    action: "Concluir documentação, localização da cabine e alinhamento.",
    match: (p) =>
      p.status_atual === "CADASTRO INICIAL" &&
      !(p.proj_obra_recebido && p.local_cabine_definido && p.alinhamento),
  },
  {
    key: "stalled",
    title: "Parados há muitos dias",
    helper: "Projetos sem atualização há 10 dias ou mais.",
    severity: "atencao",
    type: "qualidade",
    action: "Revisar o andamento e destravar a próxima etapa.",
    match: (p, t) => isStalled(p, t),
  },
  {
    key: "review-study-active",
    title: "Em Revisão de Estudo",
    helper: "Projetos atualmente em ciclo de Revisão de Estudo.",
    severity: "informativo",
    type: "revisao",
    action: "Acompanhar a revisão de estudo em andamento.",
    match: (p) => p.status_atual === "REVISAO DE ESTUDO",
  },
  {
    key: "review-final-active",
    title: "Em Revisão de Projeto Final",
    helper: "Projetos atualmente em ciclo de Revisão de Projeto Final.",
    severity: "informativo",
    type: "revisao",
    action: "Acompanhar a revisão do projeto final em andamento.",
    match: (p) => p.status_atual === "REVISAO DE PROJETO FINAL",
  },
];

/** Grupos de alerta (apenas os com projetos) calculados sobre a lista filtrada. */
export function buildAlertGroups(projects: Project[], today?: string): AlertGroup[] {
  return ALERT_GROUP_DEFS.map((def) => ({
    ...def,
    projects: projects.filter((project) => def.match(project, today)),
  })).filter((group) => group.projects.length > 0);
}

/** Projetos DISTINTOS com ao menos um alerta (base do contador da aba). */
export function getAlertedProjects(projects: Project[], today?: string): Project[] {
  return projects.filter((project) => ALERT_GROUP_DEFS.some((def) => def.match(project, today)));
}

/** Contador da aba Alertas: nº de projetos distintos com ao menos um alerta. */
export function countAlerts(projects: Project[], today?: string): number {
  return getAlertedProjects(projects, today).length;
}
