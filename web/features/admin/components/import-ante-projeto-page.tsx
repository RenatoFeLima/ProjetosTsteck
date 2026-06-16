"use client";

import { useRef, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, FileUp, Loader2, Trash2, UploadCloud } from "lucide-react";
import type { AnteProjetoReport } from "@/features/import/domain/ante-projeto-import-types";

type Phase = "idle" | "dry-running" | "dry-done" | "committing" | "committed";

const MAX_BYTES = 4 * 1024 * 1024;

export function ImportAnteProjetoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<AnteProjetoReport | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const busy = phase === "dry-running" || phase === "committing";

  async function readCsv(): Promise<string> {
    if (!file) throw new Error("Nenhum arquivo selecionado.");
    if (file.size > MAX_BYTES) {
      throw new Error(`Arquivo "${file.name}" é grande demais (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: 4 MB.`);
    }
    return file.text();
  }

  async function runDry() {
    setError("");
    setPhase("dry-running");
    try {
      const csv = await readCsv();
      const res = await fetch("/api/admin/import-ante-projeto/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Falha no dry-run.");
      setReport(data as AnteProjetoReport);
      setPhase("dry-done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      setPhase("idle");
    }
  }

  /** Retorna motivo de bloqueio ou null se pode prosseguir. */
  function commitBlockReason(r: AnteProjetoReport): string | null {
    if (r.rowsValid === 0) return "Nenhuma linha válida no CSV. Corrija o arquivo e faça novo dry-run.";
    if (r.projectsToCreate.length === 0) return "Nenhum projeto seria criado. Verifique o CSV.";
    if (r.projectsToDelete.length > 0 && r.projectsToCreate.length === 0)
      return "Haveria projetos removidos mas nenhum criado. Operação bloqueada.";
    if (r.projectsSkipped.some((s) => s.reason.includes("STATUS desconhecido")))
      return "Há linhas com STATUS desconhecido no CSV. Corrija antes de confirmar.";
    return null;
  }

  async function runCommit() {
    if (!report) return;
    const block = commitBlockReason(report);
    if (block) {
      setError(block);
      return;
    }
    const confirmed = window.confirm(
      `⚠️  ATENÇÃO: Esta operação é IRREVERSÍVEL.\n\n` +
      `Serão REMOVIDOS ${report.projectsToDelete.length} projeto(s) do banco\n` +
      `(status: Elaborar Ante-Projeto, Ante-Projeto Enviado e Ante-Projeto Aprovado).\n\n` +
      `Em seguida, serão CRIADOS ${report.projectsToCreate.length} projeto(s) do CSV.\n\n` +
      `Confirmar a importação?`,
    );
    if (!confirmed) return;

    setError("");
    setPhase("committing");
    try {
      const csv = await readCsv();
      const res = await fetch("/api/admin/import-ante-projeto/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Falha no commit.");
      setReport(data as AnteProjetoReport);
      setPhase("committed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      setPhase("dry-done");
    }
  }

  function reset() {
    setFile(null);
    setReport(null);
    setPhase("idle");
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Importar Ante-Projeto CSV</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Substitui <strong>todos</strong> os projetos em Elaborar Ante-Projeto, Ante-Projeto Enviado e
          Ante-Projeto Aprovado pelo conteúdo do CSV. Operação irreversível — faça dry-run antes de confirmar.
        </p>
      </div>

      {/* Aviso de risco */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="text-sm space-y-1">
          <p className="font-semibold">Operação destrutiva</p>
          <p>
            O commit remove todos os projetos dos 3 status de ante-projeto do banco antes de criar os do CSV.
            Projetos em outros status (<em>Cadastro Inicial, Projeto Final Enviado, Projeto Aprovado…</em>) não são
            afetados. Não há envio de e-mail.
          </p>
        </div>
      </div>

      {/* Upload */}
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <label className="block text-sm font-medium">Arquivo CSV de Ante-Projeto</label>
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            className="flex-1 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setReport(null);
              setPhase("idle");
              setError("");
            }}
          />
          {file && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {(file.size / 1024).toFixed(1)} KB
            </span>
          )}
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={runDry}
            disabled={!file || busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {phase === "dry-running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {phase === "dry-running" ? "Analisando…" : "Dry-run (simular)"}
          </button>
          {phase === "dry-done" && report && (
            <button
              onClick={runCommit}
              disabled={busy || !!commitBlockReason(report)}
              title={commitBlockReason(report) ?? undefined}
              className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-sm hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UploadCloud className="h-4 w-4" />
              Confirmar importação
            </button>
          )}
          {phase === "committing" && (
            <button disabled className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground opacity-50">
              <Loader2 className="h-4 w-4 animate-spin" />
              Importando…
            </button>
          )}
          {(phase === "dry-done" || phase === "committed") && (
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Recomeçar
            </button>
          )}
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Relatório */}
      {report && (phase === "dry-done" || phase === "committed") && (
        <ReportView report={report} />
      )}
    </div>
  );
}

// ─── Relatório ────────────────────────────────────────────────────────────────

function ReportView({ report }: { report: AnteProjetoReport }) {
  const committed = !report.dryRun && report.committed;

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${committed ? "border-green-300 bg-green-50 text-green-800" : "border-blue-300 bg-blue-50 text-blue-800"}`}>
        {committed ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <FileUp className="h-5 w-5 shrink-0" />}
        <div>
          <p className="font-semibold text-sm">
            {committed ? "Importação concluída" : "Resultado do dry-run (simulação — nada gravado)"}
          </p>
          {committed && report.committed && (
            <p className="text-sm mt-0.5">
              {report.committed.deleted} removido(s) · {report.committed.projects} criado(s) ·{" "}
              {report.committed.works} obra(s) · {report.committed.constructors} construtora(s)
            </p>
          )}
        </div>
      </div>

      {/* Diagnóstico do CSV */}
      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-xs space-y-1.5">
        <p className="font-medium text-sm">Diagnóstico do CSV</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
          <p><span className="text-muted-foreground">Separador detectado:</span> <span className="font-mono font-medium">{report.diagnostic.delimiterLabel}</span></p>
          <p><span className="text-muted-foreground">Colunas ({report.diagnostic.columns.length}):</span> {report.diagnostic.columns.join(", ")}</p>
          <p className="sm:col-span-2">
            <span className="text-muted-foreground">Status únicos encontrados:</span>{" "}
            {report.diagnostic.uniqueStatusValues.length > 0
              ? report.diagnostic.uniqueStatusValues.map((s) => (
                  <span key={s} className="inline-block mr-2 rounded bg-muted px-1.5 py-0.5 font-mono">{s}</span>
                ))
              : <span className="text-amber-600 font-medium">nenhum — coluna STATUS não encontrada ou vazia</span>}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Linhas lidas" value={report.rowsRead} />
        <Stat label="Válidas" value={report.rowsValid} variant="ok" />
        <Stat label="Inválidas / ignoradas" value={report.rowsInvalid + report.projectsSkipped.length} variant={report.rowsInvalid > 0 ? "warn" : undefined} />
        <Stat label="Urgentes" value={report.projectsUrgente} variant={report.projectsUrgente > 0 ? "warn" : undefined} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Projetos a remover" value={report.projectsToDelete.length} variant={report.projectsToDelete.length > 0 ? "danger" : undefined} />
        <Stat label="Projetos a criar" value={report.projectsToCreate.length} />
        <Stat label="Construtoras novas" value={report.constructorsToCreate.length} />
        <Stat label="Obras novas" value={report.worksToCreate.length} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Com prazo" value={report.projectsWithDeadline} />
        <Stat label="Sem prazo" value={report.projectsWithoutDeadline} variant={report.projectsWithoutDeadline > 0 ? "warn" : undefined} />
        <Stat label="Atrasados" value={report.projectsOverdue} variant={report.projectsOverdue > 0 ? "danger" : undefined} />
        <Stat label="Vence hoje" value={report.projectsDueToday} variant={report.projectsDueToday > 0 ? "warn" : undefined} />
        <Stat label="Prazo futuro" value={report.projectsFuture} variant="ok" />
        <Stat label="Erros de data" value={report.dateErrors.length} variant={report.dateErrors.length > 0 ? "warn" : undefined} />
      </div>

      {/* Status breakdown */}
      <Section title="Distribuição por status">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Elaborar" value={report.byStatus.ELABORAR_ANTE_PROJETO} />
          <Stat label="Enviado" value={report.byStatus.ANTE_PROJETO_ENVIADO} />
          <Stat label="Aprovado" value={report.byStatus.ANTE_PROJETO_APROVADO} />
        </div>
      </Section>

      {/* Projetos a remover */}
      {report.projectsToDelete.length > 0 && (
        <Section title={`Projetos que serão removidos (${report.projectsToDelete.length})`} variant="danger">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="pb-1 pr-3">Código</th>
                  <th className="pb-1 pr-3">Construtora</th>
                  <th className="pb-1 pr-3">Obra</th>
                  <th className="pb-1">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.projectsToDelete.map((p) => (
                  <tr key={p.id}>
                    <td className="py-1 pr-3 font-mono">{p.code}</td>
                    <td className="py-1 pr-3">{p.construtora}</td>
                    <td className="py-1 pr-3">{p.obra}</td>
                    <td className="py-1 text-muted-foreground">{p.statusLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Projetos a criar */}
      {report.projectsToCreate.length > 0 && (
        <Section title={`Projetos a criar (${report.projectsToCreate.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="pb-1 pr-3">Código</th>
                  <th className="pb-1 pr-3">Construtora</th>
                  <th className="pb-1 pr-3">Obra</th>
                  <th className="pb-1 pr-3">Status</th>
                  <th className="pb-1 pr-3">Prazo</th>
                  <th className="pb-1">Urgente</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.projectsToCreate.map((p, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-3 font-mono">{p.code}{p.tempCode && <span className="ml-1 text-amber-600">(tmp)</span>}</td>
                    <td className="py-1 pr-3">{p.construtora}</td>
                    <td className="py-1 pr-3">{p.obra}</td>
                    <td className="py-1 pr-3 text-muted-foreground">{p.statusLabel}</td>
                    <td className="py-1 pr-3">{p.deadline ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-1">{p.urgente ? <span className="text-red-600 font-medium">SIM</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Referências não encontradas */}
      {report.sellersNotFound.length > 0 && (
        <RefSection title="Vendedores não encontrados" items={report.sellersNotFound} />
      )}
      {report.equipmentNotFound.length > 0 && (
        <RefSection title="Equipamentos não encontrados" items={report.equipmentNotFound} />
      )}
      {report.cabinTypesNotFound.length > 0 && (
        <RefSection title="Tipos de cabine não encontrados" items={report.cabinTypesNotFound} />
      )}

      {/* Obras e construtoras novas */}
      {report.constructorsToCreate.length > 0 && (
        <Section title={`Construtoras a criar (${report.constructorsToCreate.length})`}>
          <ul className="text-xs space-y-0.5">
            {report.constructorsToCreate.map((c, i) => <li key={i}>{c.name}</li>)}
          </ul>
        </Section>
      )}
      {report.worksToCreate.length > 0 && (
        <Section title={`Obras a criar (${report.worksToCreate.length})`}>
          <ul className="text-xs space-y-0.5">
            {report.worksToCreate.map((w, i) => <li key={i}><span className="text-muted-foreground">{w.construtora}</span> → {w.obra}</li>)}
          </ul>
        </Section>
      )}

      {/* Linhas inválidas/ignoradas */}
      {report.projectsSkipped.length > 0 && (
        <Section title={`Linhas ignoradas (${report.projectsSkipped.length})`} variant="warn">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="pb-1 pr-3">Código</th>
                  <th className="pb-1 pr-3">Construtora</th>
                  <th className="pb-1 pr-3">Obra</th>
                  <th className="pb-1">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.projectsSkipped.map((s, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-3 font-mono">{s.code || "—"}</td>
                    <td className="py-1 pr-3">{s.construtora}</td>
                    <td className="py-1 pr-3">{s.obra || "—"}</td>
                    <td className="py-1 text-amber-700">{s.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Erros de data */}
      {report.dateErrors.length > 0 && (
        <Section title={`Erros de data (${report.dateErrors.length})`} variant="warn">
          <ul className="text-xs space-y-1">
            {report.dateErrors.map((e, i) => (
              <li key={i}>
                <span className="font-mono text-amber-700">{e.raw || "(vazio)"}</span>
                {" "} em <span className="font-medium">{e.field}</span>
                {" — "}{e.construtora} / {e.obra}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

type Variant = "ok" | "warn" | "danger" | undefined;

function Stat({ label, value, variant }: { label: string; value: number; variant?: Variant }) {
  const color =
    variant === "ok" ? "text-green-700" :
    variant === "warn" ? "text-amber-700" :
    variant === "danger" ? "text-red-700" :
    "";
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Section({
  title,
  children,
  variant,
}: {
  title: string;
  children: React.ReactNode;
  variant?: Variant;
}) {
  const border =
    variant === "danger" ? "border-red-200" :
    variant === "warn" ? "border-amber-200" :
    "border";
  return (
    <div className={`rounded-lg border ${border} bg-card p-4 space-y-2`}>
      <p className="text-sm font-medium">{title}</p>
      {children}
    </div>
  );
}

function RefSection({
  title,
  items,
}: {
  title: string;
  items: { construtora: string; obra: string; valor: string }[];
}) {
  return (
    <Section title={`${title} (${items.length})`} variant="warn">
      <ul className="text-xs space-y-0.5">
        {items.map((r, i) => (
          <li key={i}>
            <span className="font-medium text-amber-700">{r.valor}</span>
            {" — "}{r.construtora} / {r.obra}
          </li>
        ))}
      </ul>
    </Section>
  );
}
