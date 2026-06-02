import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type AuditInput = {
  action: string;
  actorUserId?: string | null;
  actorName?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  message: string;
  metadata?: Prisma.InputJsonValue;
};

/** Registra um evento de auditoria. Nunca lança — auditoria não pode quebrar o fluxo. */
export async function writeAudit(entry: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        actorUserId: entry.actorUserId ?? null,
        actorName: entry.actorName ?? null,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        message: entry.message,
        metadataJson: entry.metadata,
      },
    });
  } catch (err) {
    console.error("[audit] falha ao gravar log:", err);
  }
}
