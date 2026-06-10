import { NextRequest, NextResponse } from "next/server";
import { getCurrentStatusDeadline, computeNextAction } from "@/features/projects/domain/project-rules";
import { sendDeadlineWarningEmail } from "@/lib/mail/mail-service";
import {
  getProjectNotificationRecipients,
} from "@/features/projects/services/project-notification-service";
import type {
  ProjectNotificationPayload,
  ProjectNotificationRecord,
} from "@/features/projects/services/project-notification-service";
import type { Project } from "@/features/projects/domain/project-types";
import { prisma } from "@/lib/db/prisma";
import { recordNotification } from "@/lib/mail/notification-log";

function makeDedupeKey(
  projectId: string,
  type: string,
  status: string,
  dueDate: string,
): string {
  return `${projectId}:${type}:${status}:${dueDate}`;
}

export async function POST(request: NextRequest) {
  // ─── 1. Autenticação ──────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[check-deadlines] CRON_SECRET não configurado.");
    return NextResponse.json({ error: "Configuração incompleta." }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ─── 2. Lê payload ────────────────────────────────────────────────────────
  let body: { projects?: Project[]; sentNotifications?: ProjectNotificationRecord[] };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const projects: Project[] = body.projects ?? [];
  const alreadySent: Set<string> = new Set(
    (body.sentNotifications ?? []).map((r) => r.dedupeKey),
  );

  const today = new Date().toISOString().slice(0, 10);
  let processed = 0;
  let emailsSent = 0;
  let ignored = 0;
  const errors: string[] = [];

  // E-mail do vendedor vem do cadastro (Seller) — o tipo Project (UI) só tem o
  // nome. Sem isso, alertas de prazo iriam para ninguém sob a nova regra.
  let sellerEmailByName = new Map<string, string>();
  try {
    const sellers = await prisma.seller.findMany({
      where: { active: true },
      select: { name: true, email: true },
    });
    sellerEmailByName = new Map(
      sellers.map((s) => [s.name.trim().toLowerCase(), (s.email ?? "").trim()]),
    );
  } catch (e) {
    console.error("[check-deadlines] falha ao carregar vendedores:", (e as Error)?.message);
  }

  // ─── 3. Percorre projetos ─────────────────────────────────────────────────
  for (const project of projects) {
    if (project.status_atual === "PROJETO FINAL ENVIADO") continue;

    const dl = getCurrentStatusDeadline(project, today);
    if (!dl.hasDeadline || !dl.dueDate) continue;

    processed++;

    // Determina o tipo de alerta
    let eventType: ProjectNotificationPayload["eventType"] | null = null;
    const daysRemaining = dl.daysRemaining ?? 0;

    if (dl.isOverdue) {
      eventType = "DEADLINE_OVERDUE";
    } else if (daysRemaining === 0) {
      eventType = "DEADLINE_DUE_TODAY";
    } else if (daysRemaining <= 7) {
      eventType = "DEADLINE_7_DAYS_LEFT";
    }

    if (!eventType) continue;

    const dedupeKey = makeDedupeKey(
      project.id,
      eventType,
      project.status_atual,
      dl.dueDate,
    );

    if (alreadySent.has(dedupeKey)) continue;

    // Apenas o vendedor responsável recebe (sem time/cópia).
    const sellerEmail = sellerEmailByName.get((project.vendedor ?? "").trim().toLowerCase()) ?? "";

    const payload: ProjectNotificationPayload = {
      projectId: project.id,
      projectCode: project.codigo_projeto,
      constructorName: project.construtora,
      workName: project.obra,
      sellerName: project.vendedor,
      sellerEmail,
      newStatus: project.status_atual,
      eventType,
      changedBy: "Sistema",
      changedAt: new Date().toISOString(),
      dueDate: dl.dueDate,
      deadlineDays: dl.deadlineDays,
      statusEnteredAt: project.status_entered_at,
      nextAction: computeNextAction(project),
    };

    const recipients = getProjectNotificationRecipients(sellerEmail || undefined);

    // Sem vendedor/e-mail: não envia, registra ignorado e segue (não quebra o job).
    if (recipients.to.length === 0) {
      ignored++;
      await recordNotification({ payload, key: dedupeKey, sentTo: [], success: false, ignored: true });
      continue;
    }

    const result = await sendDeadlineWarningEmail(payload, recipients.to);
    await recordNotification({
      payload,
      key: dedupeKey,
      sentTo: recipients.to,
      success: result.success,
      error: result.success ? undefined : result.message,
    });

    if (result.success) {
      emailsSent++;
    } else {
      errors.push(`${project.codigo_projeto}: ${result.message}`);
    }
  }

  return NextResponse.json({ processed, emailsSent, ignored, errors });
}
