// Serviço de Cadastros Mestres — MySQL como fonte única da verdade.
// Arquitetura genérica por entidade (pronta para reuso no futuro importService/CSV):
// cada entidade declara delegate Prisma, campos permitidos, obrigatórios e regra
// de deduplicação. Todas as operações validam permissão e gravam auditoria.

import { prisma } from "@/lib/db/prisma";
import { assertPermission, HttpError } from "@/server/auth/guards";
import type { SessionUser } from "@/server/auth/session";
import { type MasterEntityKey } from "@/features/master-data/lib/master-entity-keys";
import { writeAudit } from "./auditService";

export type { MasterEntityKey };

/* eslint-disable @typescript-eslint/no-explicit-any */
type Delegate = {
  findMany: (args?: any) => Promise<any[]>;
  findFirst: (args: any) => Promise<any | null>;
  findUnique: (args: any) => Promise<any | null>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
};

type EntityConfig = {
  delegate: () => Delegate;
  label: string;
  /** Campo "nome" exibido em mensagens e usado na deduplicação textual. */
  displayField: "name" | "code";
  /** Campos graváveis (whitelist — protege contra injeção de campos). */
  allowed: string[];
  /** Campos obrigatórios na criação. */
  required: string[];
  /** include do Prisma na listagem (ex.: obra inclui construtora). */
  include?: any;
};

const REGISTRY: Record<MasterEntityKey, EntityConfig> = {
  construtoras: {
    delegate: () => prisma.constructor as unknown as Delegate,
    label: "Construtora",
    displayField: "name",
    allowed: ["name", "cnpj", "phone", "email", "notes"],
    required: ["name"],
  },
  obras: {
    delegate: () => prisma.work as unknown as Delegate,
    label: "Obra",
    displayField: "name",
    allowed: ["constructorId", "name", "code", "address", "city", "state", "notes"],
    required: ["name", "constructorId"],
    include: { constructor: { select: { id: true, name: true } } },
  },
  equipamentos: {
    delegate: () => prisma.equipment as unknown as Delegate,
    label: "Equipamento",
    displayField: "code",
    allowed: ["code", "description", "family", "capacity", "dimension", "notes"],
    required: ["code"],
  },
  tiposCabine: {
    delegate: () => prisma.cabinType as unknown as Delegate,
    label: "Tipo de cabine",
    displayField: "name",
    allowed: ["name", "description"],
    required: ["name"],
  },
  vendedores: {
    delegate: () => prisma.seller as unknown as Delegate,
    label: "Vendedor",
    displayField: "name",
    allowed: ["name", "email", "phone"],
    required: ["name"],
  },
  engenheiros: {
    delegate: () => prisma.engineer as unknown as Delegate,
    label: "Engenheiro",
    displayField: "name",
    allowed: ["name", "email", "phone"],
    required: ["name"],
  },
};

function configOf(entity: string): EntityConfig {
  const cfg = REGISTRY[entity as MasterEntityKey];
  if (!cfg) throw new HttpError(404, "Tipo de cadastro inválido.");
  return cfg;
}

/** Normaliza texto para comparação/armazenamento (trim + colapsa espaços). */
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Extrai apenas os campos permitidos do payload. Strings são trimadas. */
function pickAllowed(cfg: EntityConfig, data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of cfg.allowed) {
    if (data[key] === undefined) continue;
    let val = data[key];
    if (typeof val === "string") {
      val = key === cfg.displayField ? normalize(val) : val.trim();
      if (val === "") val = null; // campos vazios viram null (exceto se obrigatório, validado antes)
    }
    out[key] = val;
  }
  return out;
}

/** Verifica duplicidade pela regra da entidade. Lança 409 se duplicado. */
async function assertNoDuplicate(
  entity: MasterEntityKey,
  cfg: EntityConfig,
  data: Record<string, unknown>,
  excludeId?: string,
): Promise<void> {
  const field = cfg.displayField;
  const value = data[field];
  if (typeof value !== "string" || !value) return;

  const where: Record<string, unknown> = { [field]: value };
  if (excludeId) where.id = { not: excludeId };
  // Obra: duplicidade é por nome DENTRO da mesma construtora.
  if (entity === "obras" && data.constructorId) where.constructorId = data.constructorId;

  const clash = await cfg.delegate().findFirst({ where });
  if (clash) {
    const scope = entity === "obras" ? " nesta construtora" : "";
    throw new HttpError(409, `Já existe ${cfg.label.toLowerCase()} "${value}"${scope}.`);
  }
}

/** Mapeia o registro do banco para um formato estável p/ o cliente. */
function serialize(entity: MasterEntityKey, row: any): any {
  if (entity === "obras") {
    return { ...row, construtoraName: row.constructor?.name ?? "" };
  }
  return row;
}

// ─── Operações ──────────────────────────────────────────────────────────────

export async function listEntities(
  actor: SessionUser,
  entity: string,
  includeInactive = false,
): Promise<any[]> {
  assertPermission(actor, (p) => p.masterData.view);
  const cfg = configOf(entity);
  const rows = await cfg.delegate().findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: { [cfg.displayField]: "asc" },
    include: cfg.include,
  });
  return rows.map((r) => serialize(entity as MasterEntityKey, r));
}

export async function createEntity(
  actor: SessionUser,
  entity: string,
  data: Record<string, unknown>,
): Promise<any> {
  assertPermission(actor, (p) => p.masterData.create);
  const cfg = configOf(entity);
  const key = entity as MasterEntityKey;

  const clean = pickAllowed(cfg, data);
  for (const field of cfg.required) {
    if (!clean[field] || (typeof clean[field] === "string" && !clean[field])) {
      throw new HttpError(400, `Campo obrigatório ausente: ${field}.`);
    }
  }

  if (key === "obras") {
    const exists = await prisma.constructor.findUnique({ where: { id: String(clean.constructorId) } });
    if (!exists) throw new HttpError(400, "Construtora informada não existe.");
  }

  await assertNoDuplicate(key, cfg, clean);

  const created = await cfg.delegate().create({ data: clean, include: cfg.include });

  await writeAudit({
    action: "MASTER_DATA_CREATED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: key,
    entityId: created.id,
    message: `${actor.name} criou ${cfg.label.toLowerCase()} "${created[cfg.displayField]}".`,
  });

  return serialize(key, created);
}

export async function updateEntity(
  actor: SessionUser,
  entity: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<any> {
  assertPermission(actor, (p) => p.masterData.edit);
  const cfg = configOf(entity);
  const key = entity as MasterEntityKey;

  const existing = await cfg.delegate().findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, `${cfg.label} não encontrado(a).`);

  const clean = pickAllowed(cfg, patch);
  if (clean[cfg.displayField] !== undefined) {
    const dedupData = { ...clean, constructorId: clean.constructorId ?? existing.constructorId };
    await assertNoDuplicate(key, cfg, dedupData, id);
  }

  const updated = await cfg.delegate().update({ where: { id }, data: clean, include: cfg.include });

  await writeAudit({
    action: "MASTER_DATA_UPDATED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: key,
    entityId: id,
    message: `${actor.name} editou ${cfg.label.toLowerCase()} "${updated[cfg.displayField]}".`,
  });

  return serialize(key, updated);
}

export async function setEntityActive(
  actor: SessionUser,
  entity: string,
  id: string,
  active: boolean,
): Promise<any> {
  assertPermission(actor, (p) => p.masterData.edit);
  const cfg = configOf(entity);
  const key = entity as MasterEntityKey;

  const existing = await cfg.delegate().findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, `${cfg.label} não encontrado(a).`);

  const updated = await cfg.delegate().update({ where: { id }, data: { active }, include: cfg.include });

  await writeAudit({
    action: active ? "MASTER_DATA_ACTIVATED" : "MASTER_DATA_INACTIVATED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: key,
    entityId: id,
    message: `${actor.name} ${active ? "reativou" : "inativou"} ${cfg.label.toLowerCase()} "${updated[cfg.displayField]}".`,
  });

  return serialize(key, updated);
}
