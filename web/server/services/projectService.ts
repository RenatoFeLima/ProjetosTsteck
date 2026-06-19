// Serviço de Projetos — MySQL como fonte única da verdade.
// Resolve nomes dos Cadastros Mestres -> FKs (pronto para reuso em importação CSV),
// calcula status inicial, valida transições, grava histórico/revisões/observações
// e auditoria. RBAC validado server-side em toda operação.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertPermission, HttpError } from "@/server/auth/guards";
import type { SessionUser } from "@/server/auth/session";
import {
  UI_TO_DB_STATUS,
  DB_TO_UI_STATUS,
  ALLOWED_DB_TRANSITIONS,
  type DbStatus,
} from "@/features/projects/domain/project-status-map";
import { writeAudit } from "./auditService";
import { startTimer, logPerf } from "@/server/perf";
import {
  dispatchProjectNotification,
  QUEUE_MESSAGE,
  ELABORATE_MESSAGE,
} from "@/lib/mail/notify-project";
import {
  maxCodeSuffix,
  padSuffix,
  hasValidFinalCode,
  extractCodeSuffix,
  suggestNextCode,
} from "@/features/projects/domain/project-code";
import {
  buildProjectsCsv,
  exportFileName,
  type ProjectExportRow,
} from "@/features/projects/domain/project-export";
import { resolveProjectScope, canViewKpis, canMutateProjects, isReadOnlyRole } from "@/features/auth/lib/project-scope";

// Cláusula Prisma `where` derivada do escopo de visibilidade do usuário.
// SELLER vê só os projetos do seu vendedor; demais veem tudo. Vendedor sem
// vínculo é bloqueado (403) — defesa em profundidade, no backend.
function scopeWhere(actor: SessionUser): Prisma.ProjectWhereInput {
  const scope = resolveProjectScope(actor);
  if (scope.kind === "blocked") throw new HttpError(403, scope.reason);
  if (scope.kind === "own") return { sellerId: scope.sellerId };
  return {};
}

/** Extrai relações (vendedor/construtora/obra) do row Prisma para a notificação. */
function relProject(row: unknown): {
  seller?: { name?: string; email?: string };
  builder?: { name?: string };
  work?: { name?: string };
} {
  return row as never;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

const PROJECT_INCLUDE = {
  builder: { select: { id: true, name: true } },
  work: { select: { id: true, name: true } },
  seller: { select: { id: true, name: true, email: true } },
  equipment: { select: { id: true, code: true, description: true } },
  cabinType: { select: { id: true, name: true } },
  engineer: { select: { id: true, name: true, phone: true, email: true } },
} as unknown as Prisma.ProjectInclude;

const REVIEW_STUDY = "REVISAO_DE_ESTUDO" as const;
const REVIEW_FINAL = "REVISAO_DE_PROJETO_FINAL" as const;

// ─── Serialização (DB -> formato da UI) ──────────────────────────────────────

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function serializeProject(p: any) {
  return {
    id: p.id,
    construtora: p.builder?.name ?? "",
    obra: p.work?.name ?? "",
    engenheiro_nome: p.engineerName ?? p.engineer?.name ?? "",
    engenheiro_celular: p.engineerPhone ?? p.engineer?.phone ?? "",
    equipamento: p.equipment?.code ?? "",
    tipo_cabine: p.cabinType?.name ?? "",
    codigo_projeto: p.code,
    vendedor: p.seller?.name ?? "",
    proj_obra_recebido: p.projectReceived,
    local_cabine_definido: p.cabinLocationDefined,
    alinhamento: p.alignmentCompleted,
    data_lancamento: iso(p.createdAt) ?? "",
    data_alinhamento: iso(p.alignmentDate),
    status_atual: DB_TO_UI_STATUS[p.status as DbStatus],
    status_entered_at: iso(p.currentStatusEnteredAt) ?? "",
    data_envio: null,
    data_aprovacao: null,
    urgente: p.priority === "URGENTE",
    deadline: iso(p.deadline),
    urgentDeadline: iso(p.urgentDeadline),
    urgentReason: p.urgentReason ?? null,
    reviewCount: p.reviewStudyCount,
    finalReviewCount: p.finalReviewCount,
    created_at: iso(p.createdAt) ?? "",
    updated_at: iso(p.updatedAt) ?? "",
  };
}

export type SerializedProject = ReturnType<typeof serializeProject>;

// ─── Resolução de cadastros mestres por nome (CSV-ready) ─────────────────────

export type ProjectInput = {
  codigo_projeto?: string;
  construtora?: string;
  obra?: string;
  vendedor?: string;
  equipamento?: string;
  tipo_cabine?: string;
  engenheiro_nome?: string;
  engenheiro_celular?: string;
  proj_obra_recebido?: boolean;
  local_cabine_definido?: boolean;
  alinhamento?: boolean;
  data_alinhamento?: string | null;
  urgente?: boolean;
  urgentDeadline?: string | null;
  urgentReason?: string | null;
};

async function resolveRefs(data: ProjectInput) {
  const construtora = (data.construtora ?? "").trim();
  const constructor = construtora
    ? await prisma.constructor.findFirst({ where: { name: construtora, active: true } })
    : null;
  if (!constructor) throw new HttpError(400, `Construtora "${construtora}" não encontrada nos cadastros ativos.`);

  // Obra depende da construtora; o resto é independente → roda em paralelo
  // (1 round-trip em vez de ~5 sequenciais entre Vercel e o MySQL).
  const obra = (data.obra ?? "").trim();
  const vendedor = (data.vendedor ?? "").trim();
  const equipamento = (data.equipamento ?? "").trim();
  const tipo = (data.tipo_cabine ?? "").trim();
  const engNome = (data.engenheiro_nome ?? "").trim();

  const [work, seller, equipment, cabinType, engineer] = await Promise.all([
    obra ? prisma.work.findFirst({ where: { name: obra, constructorId: constructor.id, active: true }, select: { id: true } }) : null,
    vendedor ? prisma.seller.findFirst({ where: { name: vendedor, active: true }, select: { id: true } }) : null,
    equipamento ? prisma.equipment.findFirst({ where: { code: equipamento, active: true }, select: { id: true } }) : null,
    tipo ? prisma.cabinType.findFirst({ where: { name: tipo, active: true }, select: { id: true } }) : null,
    engNome ? prisma.engineer.findFirst({ where: { name: engNome, active: true }, select: { id: true } }) : null,
  ]);

  if (!work) throw new HttpError(400, `Obra "${obra}" não encontrada para a construtora selecionada.`);
  if (!seller) throw new HttpError(400, `Vendedor "${vendedor}" não encontrado nos cadastros ativos.`);
  if (!equipment) throw new HttpError(400, `Equipamento "${equipamento}" não encontrado nos cadastros ativos.`);

  return {
    constructorId: constructor.id,
    workId: work.id,
    sellerId: seller.id,
    equipmentId: equipment.id,
    cabinTypeId: cabinType?.id ?? null,
    engineerId: engineer?.id ?? null,
  };
}

function toDbStatus(input: string): DbStatus {
  if (input in UI_TO_DB_STATUS) return UI_TO_DB_STATUS[input as keyof typeof UI_TO_DB_STATUS];
  if (input in DB_TO_UI_STATUS) return input as DbStatus;
  throw new HttpError(400, `Status inválido: ${input}.`);
}

// ─── Operações ────────────────────────────────────────────────────────────────

export async function listProjects(actor: SessionUser): Promise<SerializedProject[]> {
  assertPermission(actor, (p) => p.projects.view);
  const rows = await prisma.project.findMany({
    where: scopeWhere(actor),
    include: PROJECT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serializeProject);
}

/** Exporta TODOS os projetos do sistema como CSV (compatível com Excel pt-BR).
 *  Somente leitura: não altera dados, não envia e-mail. */
export async function exportProjectsCsv(actor: SessionUser): Promise<{ fileName: string; content: string }> {
  assertPermission(actor, (p) => p.projects.view);
  // Perfis comerciais (Vendedor/Gerente Comercial) não exportam a base.
  if (isReadOnlyRole(actor.role)) {
    throw new HttpError(403, "Seu perfil não pode exportar a base de projetos.");
  }

  const rows = await prisma.project.findMany({
    where: scopeWhere(actor),
    include: {
      ...PROJECT_INCLUDE,
      observations: { orderBy: { createdAt: "desc" }, select: { text: true } },
    } as unknown as Prisma.ProjectInclude,
    orderBy: { createdAt: "desc" },
  });

  const exportRows: ProjectExportRow[] = rows.map((p: any) => {
    const obs: { text: string }[] = p.observations ?? [];
    return {
      id: p.id,
      code: p.code,
      status: p.status,
      construtora: p.builder?.name ?? null,
      obra: p.work?.name ?? null,
      vendedor: p.seller?.name ?? null,
      equipamento: p.equipment?.code ?? null,
      tipoCabine: p.cabinType?.name ?? null,
      engenheiro: p.engineerName ?? p.engineer?.name ?? null,
      telefone: p.engineerPhone ?? p.engineer?.phone ?? null,
      dataLancamento: p.createdAt ?? null,
      projetoObraRecebido: !!p.projectReceived,
      localCabineDefinido: !!p.cabinLocationDefined,
      alinhamentoConcluido: !!p.alignmentCompleted,
      dataAlinhamento: p.alignmentDate ?? null,
      urgente: p.priority === "URGENTE",
      prazoUrgencia: p.urgentDeadline ?? null,
      motivoUrgencia: p.urgentReason ?? null,
      prazoOperacional: p.deadline ?? null,
      createdAt: p.createdAt ?? null,
      updatedAt: p.updatedAt ?? null,
      qtdObservacoes: obs.length,
      ultimaObservacao: obs[0]?.text ?? null,
    };
  });

  const now = new Date();
  await writeAudit({
    action: "PROJECTS_EXPORTED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "export",
    message: `${actor.name} exportou ${exportRows.length} projeto(s) para CSV.`,
    metadata: { count: exportRows.length },
  });

  return { fileName: exportFileName(now, "csv"), content: buildProjectsCsv(exportRows) };
}

export async function getProject(actor: SessionUser, id: string): Promise<SerializedProject> {
  assertPermission(actor, (p) => p.projects.view);
  const row = await prisma.project.findUnique({ where: { id }, include: PROJECT_INCLUDE });
  if (!row) throw new HttpError(404, "Projeto não encontrado.");
  assertProjectInScope(actor, row.sellerId);
  return serializeProject(row);
}

/** Garante que o projeto está no escopo do usuário (404 para projeto de outro
 *  vendedor — não revela existência). Defesa em profundidade no detalhe/histórico. */
function assertProjectInScope(actor: SessionUser, projectSellerId: string | null): void {
  const scope = resolveProjectScope(actor);
  if (scope.kind === "blocked") throw new HttpError(403, scope.reason);
  if (scope.kind === "own" && projectSellerId !== scope.sellerId) {
    throw new HttpError(404, "Projeto não encontrado.");
  }
}

/** Exige acesso a KPIs/analytics (vendedor nunca acessa; requer kpis.view). */
function requireKpiAccess(actor: SessionUser): void {
  if (!canViewKpis(actor)) {
    throw new HttpError(403, "Você não tem permissão para visualizar os indicadores.");
  }
}

/** Bloqueia mutações de projeto para perfis comerciais (SELLER/COMMERCIAL),
 *  por ROLE — vale mesmo para usuários antigos com permissionsJson permissivo.
 *  Defesa em profundidade: roda antes de qualquer escrita. */
function assertCanMutate(actor: SessionUser): void {
  if (!canMutateProjects(actor)) {
    throw new HttpError(403, "Seu perfil é somente de visualização e não pode alterar projetos.");
  }
}

export async function createProject(actor: SessionUser, data: ProjectInput): Promise<SerializedProject> {
  assertCanMutate(actor);
  assertPermission(actor, (p) => p.projects.create);

  const stop = startTimer();
  const code = (data.codigo_projeto ?? "").trim();
  if (!code) throw new HttpError(400, "Código do projeto é obrigatório.");
  if (await prisma.project.findUnique({ where: { code }, select: { id: true } })) {
    throw new HttpError(409, `Já existe um projeto com o código "${code}".`);
  }

  if (data.urgente) {
    if (!data.urgentDeadline) throw new HttpError(400, "Prazo de urgência é obrigatório ao marcar o projeto como urgente.");
  }

  const tRefs = startTimer();
  const refs = await resolveRefs(data);
  const refsMs = tRefs();

  const projectReceived = !!data.proj_obra_recebido;
  const cabinLocationDefined = !!data.local_cabine_definido;
  const alignmentCompleted = !!data.alinhamento;

  // Status inicial automático (calculado no backend).
  const initialStatus: DbStatus =
    projectReceived && cabinLocationDefined && alignmentCompleted
      ? "ELABORAR_ANTE_PROJETO"
      : "CADASTRO_INICIAL";

  const now = new Date();

  const tCreate = startTimer();
  const created = await prisma.project.create({
    data: {
      code,
      ...refs,
      engineerName: (data.engenheiro_nome ?? "").trim() || null,
      engineerPhone: (data.engenheiro_celular ?? "").trim() || null,
      status: initialStatus,
      priority: data.urgente ? "URGENTE" : "NORMAL",
      urgentDeadline: data.urgente && data.urgentDeadline ? new Date(data.urgentDeadline) : null,
      urgentReason: data.urgente ? (data.urgentReason?.trim() || null) : null,
      projectReceived,
      cabinLocationDefined,
      alignmentCompleted,
      alignmentDate: data.data_alinhamento ? new Date(data.data_alinhamento) : null,
      currentStatusEnteredAt: now,
      createdById: actor.id,
      statusHistory: {
        create: { fromStatus: null, toStatus: initialStatus, enteredAt: now, source: "formulario", changedById: actor.id },
      },
    },
    include: PROJECT_INCLUDE,
  });
  const createMs = tCreate();

  const tAudit = startTimer();
  await writeAudit({
    action: "PROJECT_CREATED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "project",
    entityId: created.id,
    message: `${actor.name} criou o projeto ${code} (status inicial ${DB_TO_UI_STATUS[initialStatus]}).`,
  });
  logPerf("service.createProject", stop(), { success: true, phases: { refs: refsMs, prismaCreate: createMs, audit: tAudit() } });

  // E-mail ao vendedor (best-effort; awaitado para garantir o envio no serverless).
  // Cadastro Inicial -> "em fila"; criado já em Elaborar Ante-Projeto -> "esteira".
  const releasedOnCreate = initialStatus === "ELABORAR_ANTE_PROJETO";
  const rel = relProject(created);
  await dispatchProjectNotification({
    projectId: created.id,
    projectCode: code,
    constructorName: rel.builder?.name ?? "",
    workName: rel.work?.name ?? "",
    sellerName: rel.seller?.name ?? "",
    sellerEmail: rel.seller?.email ?? "",
    newStatus: DB_TO_UI_STATUS[initialStatus],
    eventType: releasedOnCreate ? "PROJECT_RELEASED_TO_ELABORATE_ANTE_PROJECT" : "PROJECT_CREATED",
    changedBy: actor.name,
    changedAt: now.toISOString(),
    nextAction: releasedOnCreate ? undefined : QUEUE_MESSAGE,
    notes: releasedOnCreate ? ELABORATE_MESSAGE : undefined,
  });

  return serializeProject(created);
}

export async function updateProject(actor: SessionUser, id: string, data: ProjectInput): Promise<SerializedProject> {
  assertCanMutate(actor);
  assertPermission(actor, (p) => p.projects.edit);
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Projeto não encontrado.");

  if (data.urgente === true) {
    if (!data.urgentDeadline) throw new HttpError(400, "Prazo de urgência é obrigatório ao marcar o projeto como urgente.");
  }

  // Reaproveita resolução de cadastros (edição mantém os relacionamentos por nome).
  const refs = await resolveRefs(data);

  // Código do projeto: editável via formulário. Valida duplicidade se o campo vier
  // preenchido e diferente do código atual.
  let codeUpdate: { code: string } | undefined;
  if (data.codigo_projeto !== undefined) {
    const newCode = data.codigo_projeto.trim();
    if (newCode && newCode !== existing.code) {
      const clash = await prisma.project.findFirst({ where: { code: newCode, id: { not: id } }, select: { id: true } });
      if (clash) throw new HttpError(409, `Já existe um projeto com o código "${newCode}".`);
      codeUpdate = { code: newCode };
    }
  }

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...refs,
      ...codeUpdate,
      engineerName: data.engenheiro_nome !== undefined ? (data.engenheiro_nome.trim() || null) : undefined,
      engineerPhone: data.engenheiro_celular !== undefined ? (data.engenheiro_celular.trim() || null) : undefined,
      projectReceived: data.proj_obra_recebido,
      cabinLocationDefined: data.local_cabine_definido,
      alignmentCompleted: data.alinhamento,
      alignmentDate: data.data_alinhamento !== undefined ? (data.data_alinhamento ? new Date(data.data_alinhamento) : null) : undefined,
      // Urgência editável pelo formulário: persiste priority + deadline + reason.
      priority: data.urgente === undefined ? undefined : data.urgente ? "URGENTE" : "NORMAL",
      ...(data.urgente === true ? {
        urgentDeadline: data.urgentDeadline ? new Date(data.urgentDeadline) : undefined,
        urgentReason: data.urgentReason?.trim() || null,
      } : data.urgente === false ? {
        urgentDeadline: null,
        urgentReason: null,
      } : {}),
      updatedById: actor.id,
    },
    include: PROJECT_INCLUDE,
  });

  await writeAudit({
    action: "PROJECT_UPDATED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "project",
    entityId: id,
    message: `${actor.name} editou o projeto ${updated.code}.`,
  });

  // Alinhamento automático: projeto em CADASTRO_INICIAL que passou a ter os 3
  // pré-requisitos avança sozinho para ELABORAR_ANTE_PROJETO (prazo de 45 dias).
  if (
    updated.status === "CADASTRO_INICIAL" &&
    updated.projectReceived &&
    updated.cabinLocationDefined &&
    updated.alignmentCompleted
  ) {
    return changeStatus(actor, id, "ELABORAR_ANTE_PROJETO", {
      source: "alinhamento-automatico",
      note: "Alinhamento concluído na edição — liberado automaticamente.",
    });
  }

  return serializeProject(updated);
}

export async function changeStatus(
  actor: SessionUser,
  id: string,
  toStatusInput: string,
  opts: { reason?: string; source?: string; note?: string; finalCode?: string } = {},
): Promise<SerializedProject> {
  assertCanMutate(actor);
  assertPermission(actor, (p) => p.projects.changeStatus);

  const stop = startTimer();
  const tQuery = startTimer();
  const project = await prisma.project.findUnique({ where: { id } });
  const queryMs = tQuery();
  if (!project) throw new HttpError(404, "Projeto não encontrado.");

  const from = project.status as DbStatus;
  const to = toDbStatus(toStatusInput);
  if (from === to) return serializeProject(await reload(id));

  if (!(ALLOWED_DB_TRANSITIONS[from] ?? []).includes(to)) {
    throw new HttpError(
      400,
      `Movimentação de "${DB_TO_UI_STATUS[from]}" para "${DB_TO_UI_STATUS[to]}" não é permitida no fluxo.`,
    );
  }

  const enteringReview = to === REVIEW_STUDY || to === REVIEW_FINAL;
  if (enteringReview && !opts.reason?.trim()) {
    throw new HttpError(400, "Informe o motivo da revisão.");
  }

  // Código: ao entrar em "Projeto Final Enviado" pode-se confirmar/atualizar o código.
  // Valida formato e duplicidade ANTES da transação.
  let finalCodeToApply: string | null = null;
  if (to === "PROJETO_FINAL_ENVIADO" && opts.finalCode?.trim()) {
    const code = opts.finalCode.trim();
    if (!hasValidFinalCode(code)) {
      throw new HttpError(400, "Código final inválido: deve terminar com 4 dígitos numéricos.");
    }
    if (code !== project.code) {
      const clash = await prisma.project.findFirst({ where: { code, id: { not: id } }, select: { id: true } });
      if (clash) throw new HttpError(409, `Já existe um projeto com o código "${code}".`);
      finalCodeToApply = code;
    }
  }

  const now = new Date();

  const tTx = startTimer();
  await prisma.$transaction(async (tx) => {
    // Fecha o registro de histórico aberto do status anterior.
    await tx.projectStatusHistory.updateMany({
      where: { projectId: id, exitedAt: null },
      data: { exitedAt: now },
    });
    await tx.projectStatusHistory.create({
      data: {
        projectId: id,
        fromStatus: from,
        toStatus: to,
        enteredAt: now,
        source: opts.source ?? "sistema",
        note: opts.note ?? null,
        changedById: actor.id,
      },
    });

    // Revisão de Estudo
    if (to === REVIEW_STUDY) {
      await tx.projectReviewStudyHistory.create({
        data: { projectId: id, enteredAt: now, reason: opts.reason ?? null, requestedBy: actor.name, changedById: actor.id },
      });
    }
    if (from === REVIEW_STUDY) {
      await tx.projectReviewStudyHistory.updateMany({ where: { projectId: id, exitedAt: null }, data: { exitedAt: now } });
    }
    // Revisão de Projeto Final
    if (to === REVIEW_FINAL) {
      await tx.projectFinalReviewHistory.create({
        data: { projectId: id, enteredAt: now, reason: opts.reason ?? null, requestedBy: actor.name, changedById: actor.id },
      });
    }
    if (from === REVIEW_FINAL) {
      await tx.projectFinalReviewHistory.updateMany({ where: { projectId: id, exitedAt: null }, data: { exitedAt: now } });
    }

    // Ao sair de CADASTRO_INICIAL, as 3 flags de pré-requisito são marcadas true.
    const leavingCadastroInicial = from === "CADASTRO_INICIAL";
    await tx.project.update({
      where: { id },
      data: {
        status: to,
        currentStatusEnteredAt: now,
        updatedById: actor.id,
        ...(leavingCadastroInicial ? { projectReceived: true, cabinLocationDefined: true, alignmentCompleted: true } : {}),
        ...(finalCodeToApply ? { code: finalCodeToApply } : {}),
        ...(to === REVIEW_STUDY ? { reviewStudyCount: { increment: 1 } } : {}),
        ...(to === REVIEW_FINAL ? { finalReviewCount: { increment: 1 } } : {}),
        ...(to === "PROJETO_APROVADO" ? { priority: "NORMAL" } : {}),
      },
    });
  });
  const txMs = tTx();

  const tAudit = startTimer();
  await writeAudit({
    action: "PROJECT_STATUS_CHANGED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "project",
    entityId: id,
    message: `${actor.name} alterou o status do projeto ${project.code}: ${DB_TO_UI_STATUS[from]} → ${DB_TO_UI_STATUS[to]}.${finalCodeToApply ? ` Código final: ${project.code} → ${finalCodeToApply}.` : ""}`,
    metadata: {
      ...(opts.reason ? { reason: opts.reason } : {}),
      ...(finalCodeToApply ? { finalCode: finalCodeToApply, previousCode: project.code } : {}),
    },
  });
  const auditMs = tAudit();

  const reloaded = await reload(id);
  const result = serializeProject(reloaded);
  logPerf("service.changeStatus", stop(), {
    success: true,
    phases: { query: queryMs, transaction: txMs, audit: auditMs },
  });

  // E-mails de etapa ao vendedor (best-effort, awaitado): liberação para
  // anteprojeto e finalização — esta usa o CÓDIGO FINAL já atualizado (reloaded).
  if (to === "ELABORAR_ANTE_PROJETO" || to === "PROJETO_APROVADO") {
    const rel = relProject(reloaded);
    const isFinal = to === "PROJETO_APROVADO";
    await dispatchProjectNotification({
      projectId: id,
      projectCode: reloaded.code,
      constructorName: rel.builder?.name ?? "",
      workName: rel.work?.name ?? "",
      sellerName: rel.seller?.name ?? "",
      sellerEmail: rel.seller?.email ?? "",
      newStatus: DB_TO_UI_STATUS[to],
      eventType: isFinal ? "PROJECT_FINISHED" : "PROJECT_RELEASED_TO_ELABORATE_ANTE_PROJECT",
      changedBy: actor.name,
      changedAt: now.toISOString(),
      notes: isFinal ? undefined : ELABORATE_MESSAGE,
    });
  }

  return result;
}

export async function setUrgency(
  actor: SessionUser,
  id: string,
  urgent: boolean,
  reason?: string,
  deadline?: string,
): Promise<SerializedProject> {
  assertCanMutate(actor);
  assertPermission(actor, (p) => p.projects.markUrgent);
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new HttpError(404, "Projeto não encontrado.");

  if (urgent && project.status === "PROJETO_APROVADO") {
    throw new HttpError(400, "Projetos aprovados não podem ser marcados como urgentes.");
  }
  if (urgent && !deadline) throw new HttpError(400, "Informe o prazo de urgência.");

  const trimmedReason = reason?.trim() || null;

  await prisma.project.update({
    where: { id },
    data: urgent
      ? { priority: "URGENTE", urgentDeadline: new Date(deadline!), urgentReason: trimmedReason, updatedById: actor.id }
      : { priority: "NORMAL", urgentDeadline: null, urgentReason: null, updatedById: actor.id },
  });

  const obsText = urgent
    ? trimmedReason
      ? `Marcado como urgente (prazo: ${deadline}): ${trimmedReason}`
      : `Marcado como urgente (prazo: ${deadline}).`
    : trimmedReason
      ? `Urgência removida: ${trimmedReason}`
      : "Urgência removida.";

  await prisma.projectObservation.create({
    data: { projectId: id, author: actor.name, text: obsText },
  });

  await writeAudit({
    action: urgent ? "PROJECT_MARKED_URGENT" : "PROJECT_URGENCY_REMOVED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "project",
    entityId: id,
    message: `${actor.name} ${urgent ? `marcou como urgente (prazo: ${deadline})` : "removeu a urgência d"}o projeto ${project.code}.`,
  });

  return serializeProject(await reload(id));
}

export async function addObservation(actor: SessionUser, id: string, text: string) {
  assertCanMutate(actor);
  assertPermission(actor, (p) => p.projects.edit);
  if (!text?.trim()) throw new HttpError(400, "A observação não pode ser vazia.");
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new HttpError(404, "Projeto não encontrado.");

  const obs = await prisma.projectObservation.create({
    data: { projectId: id, author: actor.name, text: text.trim() },
  });

  await writeAudit({
    action: "PROJECT_OBSERVATION_ADDED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "project",
    entityId: id,
    message: `${actor.name} adicionou uma observação ao projeto ${project.code}.`,
  });

  return { id: obs.id, projeto_id: id, usuario: obs.author, texto: obs.text, criado_em: obs.createdAt.toISOString() };
}

export async function getHistory(actor: SessionUser, id: string) {
  assertPermission(actor, (p) => p.projects.viewHistory || p.projects.view);
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new HttpError(404, "Projeto não encontrado.");
  assertProjectInScope(actor, project.sellerId);

  const [status, observations, reviewStudy, reviewFinal] = await Promise.all([
    prisma.projectStatusHistory.findMany({ where: { projectId: id }, orderBy: { enteredAt: "asc" } }),
    prisma.projectObservation.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" } }),
    prisma.projectReviewStudyHistory.findMany({ where: { projectId: id }, orderBy: { enteredAt: "asc" } }),
    prisma.projectFinalReviewHistory.findMany({ where: { projectId: id }, orderBy: { enteredAt: "asc" } }),
  ]);

  return {
    statusHistory: status.map((h) => ({
      id: h.id,
      projeto_id: id,
      status_de: h.fromStatus ? DB_TO_UI_STATUS[h.fromStatus as DbStatus] : null,
      status_para: DB_TO_UI_STATUS[h.toStatus as DbStatus],
      alterado_em: h.enteredAt.toISOString(),
      origem: (h.source ?? "sistema") as any,
      nota: h.note ?? undefined,
    })),
    observations: observations.map((o) => ({
      id: o.id,
      projeto_id: id,
      usuario: o.author,
      texto: o.text,
      criado_em: o.createdAt.toISOString(),
    })),
    reviewStudyHistory: reviewStudy.map((r) => ({
      id: r.id,
      enteredAt: r.enteredAt.toISOString(),
      exitedAt: r.exitedAt ? r.exitedAt.toISOString() : null,
      reason: r.reason ?? "",
      changedBy: r.requestedBy ?? "",
    })),
    finalReviewHistory: reviewFinal.map((r) => ({
      id: r.id,
      enteredAt: r.enteredAt.toISOString(),
      exitedAt: r.exitedAt ? r.exitedAt.toISOString() : null,
      reason: r.reason ?? "",
      changedBy: r.requestedBy ?? "",
    })),
  };
}

// Histórico de status de TODOS os projetos — base real para os KPIs de tempo
// (tempo médio por status, fluxo completo, SLA, gargalos). Sem isso o dashboard
// só teria o histórico carregado pontualmente na sessão.
export async function listAllStatusHistory(actor: SessionUser) {
  requireKpiAccess(actor);
  const rows = await prisma.projectStatusHistory.findMany({
    orderBy: { enteredAt: "asc" },
    select: { id: true, projectId: true, fromStatus: true, toStatus: true, enteredAt: true, source: true, note: true },
  });
  return rows.map((h) => ({
    id: h.id,
    projeto_id: h.projectId,
    status_de: h.fromStatus ? DB_TO_UI_STATUS[h.fromStatus as DbStatus] : null,
    status_para: DB_TO_UI_STATUS[h.toStatus as DbStatus],
    alterado_em: h.enteredAt.toISOString(),
    origem: (h.source ?? "sistema") as any,
    nota: h.note ?? undefined,
  }));
}

// Revisões agregadas de TODOS os projetos (entrada/saída) — base dos SLAs de
// revisão (20 dias). O cálculo de prazo e o respeito aos filtros são feitos no
// cliente, cruzando projectId com os projetos filtrados.
export async function listAllReviews(actor: SessionUser) {
  requireKpiAccess(actor);
  const [study, finalRev] = await Promise.all([
    prisma.projectReviewStudyHistory.findMany({ select: { projectId: true, enteredAt: true, exitedAt: true } }),
    prisma.projectFinalReviewHistory.findMany({ select: { projectId: true, enteredAt: true, exitedAt: true } }),
  ]);
  const map = (r: { projectId: string; enteredAt: Date; exitedAt: Date | null }) => ({
    projectId: r.projectId,
    enteredAt: r.enteredAt.toISOString(),
    exitedAt: r.exitedAt ? r.exitedAt.toISOString() : null,
  });
  return { reviewStudy: study.map(map), finalReview: finalRev.map(map) };
}

export type NextCodeSuggestion = {
  /** Maior sufixo GLOBAL (compat) — usado como fallback quando não há finalizados. */
  maxSuffix: number;
  /** Próximo sufixo GLOBAL (compat). */
  nextSuffix: string;
  /** Código do último/maior projeto que já chegou em ANTE_PROJETO_ENVIADO ou PROJETO_APROVADO. */
  lastFinalCode: string | null;
  /** Código provisório do projeto sendo movimentado (informação secundária). */
  currentDraftCode: string | null;
  /** Sugestão do código final: próximo sequencial sobre o último finalizado. */
  suggestedFinalCode: string | null;
};

/** Sugestão do próximo código. A referência principal é o ÚLTIMO projeto
 *  que já chegou em ANTE_PROJETO_ENVIADO ou PROJETO_APROVADO (maior sufixo
 *  numérico): "De:" = esse código, "Para:" = prefixo + sufixo + 1. Se não
 *  existir nenhum anterior, usa o código provisório atual como fallback. */
export async function nextCodeSuggestion(
  actor: SessionUser,
  currentCode?: string,
): Promise<NextCodeSuggestion> {
  assertPermission(actor, (p) => p.projects.view);

  // Compat: sufixo global (todos os projetos).
  const allRows = await prisma.project.findMany({ select: { code: true } });
  const globalMax = maxCodeSuffix(allRows.map((r) => r.code));

  // Projetos que já chegaram em ANTE_PROJETO_APROVADO ou PROJETO_APROVADO — status
  // atual OU histórico (um projeto pode sair e voltar para esses status).
  const ids = new Set<string>();
  const [historyHits, currentFinal] = await Promise.all([
    prisma.projectStatusHistory.findMany({
      where: { toStatus: { in: ["ANTE_PROJETO_APROVADO", "PROJETO_APROVADO"] } },
      select: { projectId: true },
    }),
    prisma.project.findMany({
      where: { status: { in: ["ANTE_PROJETO_APROVADO", "PROJETO_APROVADO"] } },
      select: { id: true },
    }),
  ]);
  historyHits.forEach((r) => ids.add(r.projectId));
  currentFinal.forEach((p) => ids.add(p.id));

  const finalProjects = ids.size
    ? await prisma.project.findMany({ where: { id: { in: [...ids] } }, select: { code: true } })
    : [];

  // Referência = código finalizado de maior sufixo numérico.
  let lastFinalCode: string | null = null;
  let maxFinalSuffix = -1;
  for (const p of finalProjects) {
    const n = extractCodeSuffix(p.code);
    if (n !== null && n > maxFinalSuffix) {
      maxFinalSuffix = n;
      lastFinalCode = p.code;
    }
  }

  // Base da sugestão: último finalizado; senão, código provisório atual.
  const draft = currentCode?.trim() || null;
  let suggestedFinalCode: string | null = null;
  if (lastFinalCode) {
    suggestedFinalCode = suggestNextCode(lastFinalCode, maxFinalSuffix);
  } else if (draft) {
    const draftSuffix = extractCodeSuffix(draft);
    suggestedFinalCode = suggestNextCode(draft, draftSuffix ?? globalMax);
  }

  return {
    maxSuffix: globalMax,
    nextSuffix: padSuffix(globalMax + 1),
    lastFinalCode,
    currentDraftCode: draft,
    suggestedFinalCode,
  };
}

async function reload(id: string) {
  return prisma.project.findUniqueOrThrow({ where: { id }, include: PROJECT_INCLUDE });
}
