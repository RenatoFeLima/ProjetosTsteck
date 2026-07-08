import { NextResponse, type NextRequest } from "next/server";
import { requireUser, HttpError } from "@/server/auth/guards";
import { requireSameOrigin } from "@/server/auth/csrf";
import { fail } from "@/server/http";
import { startTimer, logPerf } from "@/server/perf";
import { validateKpiReport } from "@/features/projects/domain/kpi-report";
import { generateKpiReportPdf } from "@/server/services/kpiReportPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/projects/analytics/report
// Body: KpiReportViewModel (montado no cliente a partir do dashboard).
// Retorna: application/pdf (Relatório Executivo de KPIs).
//
// Segurança:
//  - CSRF (same-origin) + usuário autenticado;
//  - permissão kpis.export → 403 se ausente;
//  - o payload é SANEADO (validateKpiReport) — só campos de exibição conhecidos,
//    tamanhos limitados; nada de IDs internos/tokens é renderizado;
//  - "gerado por" vem do nome da SESSÃO, não do payload do cliente.
export async function POST(req: NextRequest) {
  const stop = startTimer();
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    if (actor.role !== "ADMIN" && !actor.permissions.kpis.export) {
      throw new HttpError(403, "Você não tem permissão para exportar o relatório de KPIs.");
    }

    const body = await req.json().catch(() => ({}));
    const viewModel = validateKpiReport(body);
    // Identidade de quem gerou vem da sessão (fonte confiável), não do cliente.
    viewModel.meta.geradoPor = actor.name;

    const pdf = await generateKpiReportPdf(viewModel);
    // NextResponse aceita BodyInit; copia para um ArrayBuffer puro (não Shared).
    const pdfBody = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;

    logPerf("POST /api/projects/analytics/report", stop(), { success: true, phases: { bytes: pdf.length } });
    return new NextResponse(pdfBody, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="relatorio-kpis-projetos.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    logPerf("POST /api/projects/analytics/report", stop(), { success: false });
    return fail(e);
  }
}
