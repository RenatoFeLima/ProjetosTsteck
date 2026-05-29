import { NextRequest, NextResponse } from "next/server";
import { sendProjectMovementEmail } from "@/lib/mail/mail-service";

/** Rota de teste — apenas em desenvolvimento. */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ success: false, message: "Disponível apenas em desenvolvimento." }, { status: 403 });
  }

  let to: string | undefined;

  try {
    const body = await request.json();
    to = typeof body.to === "string" ? body.to : undefined;
  } catch {
    // sem body: usa SMTP_USER como destinatário de fallback
  }

  const recipient = to ?? process.env.SMTP_USER;

  if (!recipient) {
    return NextResponse.json({ success: false, message: "Informe o campo 'to' no body ou configure SMTP_USER." }, { status: 400 });
  }

  const result = await sendProjectMovementEmail({
    projectId: "test-001",
    projectCode: "TST-EML-0001",
    constructorName: "TSTECK Construtora Teste",
    workName: "Obra de Teste",
    sellerName: "Vendedor Teste",
    sellerEmail: recipient,
    oldStatus: "CADASTRO INICIAL",
    newStatus: "ELABORAR ANTE-PROJETO",
    eventType: "STATUS_CHANGED",
    changedBy: "sistema.teste",
    changedAt: new Date().toISOString(),
    notes: "Este é um e-mail de teste do Pipeline de Projetos TSTECK.",
  });

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
