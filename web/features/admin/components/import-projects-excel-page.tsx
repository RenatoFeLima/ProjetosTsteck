"use client";

import { useRef, useState } from "react";
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Download, FileUp, Loader2, UploadCloud } from "lucide-react";
import type {
  ProjectsExcelImportReport,
  ExcelMatchedProject,
  ExcelSkipped,
  ProjectsExcelBackup,
  ProjectsExcelBatchResult,
  ExcelBatchError,
} from "@/features/import/domain/projects-excel-import-types";
import { apiFetch } from "@/lib/api-client";

type Phase = "idle" | "dry-running" | "dry-done" | "committing" | "committed";

const MAX_BYTES = 8 * 1024 * 1024;
const CHUNK_SIZE = 50;

type Progress = {
  total: number;
  processed: number;
  projectsUpdated: number;
  codesUpdated: number;
  observationsAdded: number;
  errors: ExcelBatchError[];
};

export function ImportProjectsExcelPage() {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ProjectsExcelImportReport | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [backup, setBackup] = useState<ProjectsExcelBackup | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const committingRef = useRef(false);

  const busy = phase === "dry-running" || phase === "committing";

  async function readCsv(): Promise<string> {
    if (!file) throw new Error("Nenhum arquivo selecionado.");
    if (file.size > MAX_BYTES) {
      throw new Error(`Arquivo "${file.name}" é grande demais (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: 8 MB.`);
    }
    return file.text();
  }

  async function runDry() {
    setError("");
    setProgress(null);
    setBackup(null);
    setPhase("dry-running");
    try {
      const csv = await readCsv();
      const res = await apiFetch("/api/projects/import/dry-run", {
        method: "POST",
        body: JSON.stringify({ csv }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Falha no dry-run.");
      setReport(data as ProjectsExcelImportReport);
      setPhase("dry-done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      setPhase("idle");
    }
  }

  function updatableCount(r: ProjectsExcelImportReport): number {
    return r.matched.filter((m) => m.changes.length > 0 || m.observationToAdd).length;
  }

  async function postBatch(csv: string, offset: number): Promise<ProjectsExcelBatchResult> {
    const res = await apiFetch("/api/projects/import/commit", {
      method: "POST",
      body: JSON.stringify({ csv, offset, chunkSize: CHUNK_SIZE }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? data.error ?? "Falha no commit.");
    return data as ProjectsExcelBatchResult;
  }

  async function runCommit() {
    if (!report || committingRef.current) return;
    const updatable = updatableCount(report);
    if (updatable === 0) {
      setError("Nenhum projeto seria atualizado. Verifique o CSV e o dry-run.");
      return;
    }
    const confirmed = window.confirm(
      `Esta operação vai ATUALIZAR ${updatable} projeto(s) existente(s).\n\n` +
      `Um backup do estado anterior será gerado antes de alterar.\n` +
      `Processamento em lotes de ${CHUNK_SIZE}. Não feche a página.\n` +
      `Não cria, não deleta projeto e não altera status.\n\n` +
      `Confirmar a importação?`,
    );
    if (!confirmed) return;

    committingRef.current = true;
    setError("");
    setBackup(null);
    setPhase("committing");

    const acc: Progress = { total: 0, processed: 0, projectsUpdated: 0, codesUpdated: 0, observationsAdded: 0, errors: [] };
    try {
      const csv = await readCsv();
      let offset = 0;
      let done = false;
      while (!done) {
        const batch = await postBatch(csv, offset);
        if (batch.backup) setBackup(batch.backup);
        acc.total = batch.total;
        acc.processed += batch.processed;
        acc.projectsUpdated += batch.projectsUpdated;
        acc.codesUpdated += batch.codesUpdated;
        acc.observationsAdded += batch.observationsAdded;
        if (batch.errors.length) acc.errors = [...acc.errors, ...batch.errors];
        setProgress({ ...acc });
        if (batch.nextOffset === null) done = true;
        else offset = batch.nextOffset;
      }
      setPhase("committed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      setPhase("dry-done");
    } finally {
      committingRef.current = false;
    }
  }

  function downloadBackup() {
    if (!backup) return;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backup.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setFile(null);
    setReport(null);
    setPhase("idle");
    setError("");
    setProgress(null);
    setBackup(null);
    committingRef.current = false;
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Importar Atualizações de Projetos (CSV)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reimporta o CSV exportado pelo sistema para <strong>atualizar projetos existentes</strong>. Casa por{" "}
          <strong>ID do Projeto</strong> (com fallback para código único ou construtora + obra). Não cria, não deleta e
          não altera status. Faça dry-run antes de confirmar.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="text-sm space-y-1">
          <p className="font-semibold">Atualiza projetos existentes</p>
          <p>
            Campo vazio no CSV <strong>não apaga</strong> o valor existente. Status é informativo (não é alterado).
            Cadastros mestres não encontrados são pulados (campo a campo). Um <strong>backup</strong> é gerado antes de
            qualquer alteração. Sem envio de e-mail.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-3">
        <label className="block text-sm font-medium">Arquivo CSV (exportado pelo sistema)</label>
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
              setProgress(null);
              setBackup(null);
            }}
          />
          {file && <span className="text-xs text-muted-foreground whitespace-nowrap">{(file.size / 1024).toFixed(1)} KB</span>}
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
          {phase === "dry-done" && report && !progress && (
            <button
              onClick={runCommit}
              disabled={busy || updatableCount(report) === 0}
              className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-sm hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UploadCloud className="h-4 w-4" />
              Confirmar importação
            </button>
          )}
          {phase === "committing" && (
            <button disabled className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground opacity-50">
              <Loader2 className="h-4 w-4 animate-spin" />
              {progress ? `Processando ${progress.processed}/${progress.total}…` : "Gerando backup…"}
            </button>
          )}
          {backup && progress && (
            <button onClick={downloadBackup} className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
              <Download className="h-4 w-4" />
              Baixar backup
            </button>
          )}
          {(phase === "dry-done" || phase === "committed") && (
            <button onClick={reset} disabled={busy} className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
              Recomeçar
            </button>
          )}
        </div>

        {progress && (phase === "committing" || phase === "committed") && (
          <ProgressBar progress={progress} done={phase === "committed"} backupName={backup?.fileName} />
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {report && phase === "dry-done" && !progress && <ReportView report={report} />}
    </div>
  );
}

function ProgressBar({ progress, done, backupName }: { progress: Progress; done: boolean; backupName?: string }) {
  const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  return (
    <div className={`rounded-lg border px-4 py-3 space-y-2 ${done ? "border-green-300 bg-green-50" : "border-blue-300 bg-blue-50"}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium flex items-center gap-2">
          {done ? <CheckCircle2 className="h-4 w-4 text-green-700" /> : <Loader2 className="h-4 w-4 animate-spin text-blue-700" />}
          {done ? "Importação concluída" : "Processando em lotes…"}
        </span>
        <span className="font-mono">{progress.processed}/{progress.total} ({pct}%)</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${done ? "bg-green-600" : "bg-blue-600"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <span><span className="text-muted-foreground">Atualizados:</span> <strong>{progress.projectsUpdated}</strong></span>
        <span><span className="text-muted-foreground">Códigos:</span> <strong>{progress.codesUpdated}</strong></span>
        <span><span className="text-muted-foreground">Observações:</span> <strong>{progress.observationsAdded}</strong></span>
        <span><span className="text-muted-foreground">Erros:</span> <strong className={progress.errors.length ? "text-red-700" : ""}>{progress.errors.length}</strong></span>
      </div>
      {backupName && <p className="text-xs text-muted-foreground">Backup: <span className="font-mono">{backupName}</span></p>}
      {progress.errors.length > 0 && (
        <ul className="text-xs text-red-700 space-y-0.5 max-h-32 overflow-y-auto">
          {progress.errors.map((e, i) => <li key={i}><span className="font-mono">{e.projectId.slice(0, 8)}</span>: {e.detail}</li>)}
        </ul>
      )}
    </div>
  );
}

function ReportView({ report }: { report: ProjectsExcelImportReport }) {
  const updatable = report.matched.filter((m) => m.changes.length > 0 || m.observationToAdd);
  const unchanged = report.matched.length - updatable.length;
  const statusWarnings = report.matched.filter((m) => m.statusWarning);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-lg border px-4 py-3 border-blue-300 bg-blue-50 text-blue-800">
        <FileUp className="h-5 w-5 shrink-0" />
        <p className="font-semibold text-sm">Resultado do dry-run (simulação — nada gravado)</p>
      </div>

      {!report.diagnostic.hasIdColumn && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          A coluna <strong>ID do Projeto</strong> não foi encontrada. Usando fallback por código único ou construtora + obra —
          recomenda-se reexportar o CSV pelo sistema para o match seguro por ID.
        </div>
      )}

      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-xs space-y-1.5">
        <p className="font-medium text-sm">Diagnóstico do CSV</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
          <p><span className="text-muted-foreground">Separador:</span> <span className="font-mono font-medium">{report.diagnostic.delimiterLabel}</span></p>
          <p><span className="text-muted-foreground">Tem coluna ID:</span> <strong>{report.diagnostic.hasIdColumn ? "Sim" : "Não"}</strong></p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Linhas lidas" value={report.rowsRead} />
        <Stat label="A atualizar" value={updatable.length} variant="ok" />
        <Stat label="Sem mudanças" value={unchanged} />
        <Stat label="Avisos de status" value={statusWarnings.length} variant={statusWarnings.length ? "warn" : undefined} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Não encontrados" value={report.notFound.length} variant={report.notFound.length ? "warn" : undefined} />
        <Stat label="Conflitos" value={report.conflicts.length} variant={report.conflicts.length ? "danger" : undefined} />
        <Stat label="Código duplicado" value={report.duplicateCodes.length} variant={report.duplicateCodes.length ? "danger" : undefined} />
        <Stat label="Linhas inválidas" value={report.invalidRows.length} variant={report.invalidRows.length ? "warn" : undefined} />
      </div>

      {updatable.length > 0 && (
        <Section title={`Projetos a atualizar (${updatable.length})`}>
          <div className="space-y-3">{updatable.map((m) => <MatchCard key={`${m.projectId}-${m.csvRow}`} match={m} />)}</div>
        </Section>
      )}

      {statusWarnings.length > 0 && (
        <Section title={`Divergência de status (não alterado) — ${statusWarnings.length}`} variant="warn">
          <ul className="text-xs space-y-0.5">
            {statusWarnings.map((m, i) => (
              <li key={i}>
                <span className="font-mono">{m.codigo}</span>: CSV diz <strong>{m.statusWarning!.csv}</strong>, sistema está em <strong>{m.statusWarning!.atual}</strong>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report.conflicts.length > 0 && <SkipSection title="Conflitos (não atualizados)" items={report.conflicts} variant="danger" />}
      {report.duplicateCodes.length > 0 && <SkipSection title="Código duplicado (não atualizados)" items={report.duplicateCodes} variant="danger" />}
      {report.notFound.length > 0 && <SkipSection title="Não encontrados" items={report.notFound} variant="warn" />}
      {report.invalidRows.length > 0 && <SkipSection title="Linhas inválidas" items={report.invalidRows} variant="warn" />}

      {(report.sellersNotFound.length > 0 || report.equipmentNotFound.length > 0 || report.cabinTypesNotFound.length > 0) && (
        <Section title="Cadastros mestres não encontrados (campo pulado, demais aplicados)" variant="warn">
          {report.sellersNotFound.length > 0 && <RefList label="Vendedores" items={report.sellersNotFound} />}
          {report.equipmentNotFound.length > 0 && <RefList label="Equipamentos" items={report.equipmentNotFound} />}
          {report.cabinTypesNotFound.length > 0 && <RefList label="Tipos de cabine" items={report.cabinTypesNotFound} />}
        </Section>
      )}
    </div>
  );
}

function MatchCard({ match }: { match: ExcelMatchedProject }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs">
        <span className="font-mono">{match.codigo}</span> · <span className="text-muted-foreground">{match.construtora}</span> · {match.obra}
        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px]">via {match.matchedBy === "id" ? "ID" : match.matchedBy === "codigo" ? "código" : "constr+obra"}</span>
      </p>
      <ul className="mt-2 space-y-1 text-xs">
        {match.changes.map((c, i) => (
          <li key={i} className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground w-28 shrink-0">{c.label}:</span>
            <span className="text-muted-foreground line-through">{c.from || "vazio"}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium text-green-700">{c.to || "vazio"}</span>
          </li>
        ))}
        {match.observationToAdd && (
          <li className="flex items-start gap-2">
            <span className="text-muted-foreground w-28 shrink-0">Nova observação:</span>
            <span className="text-green-700">+ {match.observationToAdd}</span>
          </li>
        )}
      </ul>
      {match.pendingRefs.length > 0 && (
        <p className="mt-1.5 text-[11px] text-amber-700">
          Pendências (campo não atualizado): {match.pendingRefs.map((p) => `${p.field}="${p.valor}"`).join(", ")}
        </p>
      )}
    </div>
  );
}

type Variant = "ok" | "warn" | "danger" | undefined;

function Stat({ label, value, variant }: { label: string; value: number; variant?: Variant }) {
  const color = variant === "ok" ? "text-green-700" : variant === "warn" ? "text-amber-700" : variant === "danger" ? "text-red-700" : "";
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Section({ title, children, variant }: { title: string; children: React.ReactNode; variant?: Variant }) {
  const border = variant === "danger" ? "border-red-200" : variant === "warn" ? "border-amber-200" : "border";
  return (
    <div className={`rounded-lg border ${border} bg-card p-4 space-y-2`}>
      <p className="text-sm font-medium">{title}</p>
      {children}
    </div>
  );
}

function SkipSection({ title, items, variant }: { title: string; items: ExcelSkipped[]; variant: Variant }) {
  return (
    <Section title={`${title} (${items.length})`} variant={variant}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b">
            <tr className="text-left text-muted-foreground">
              <th className="pb-1 pr-3">Linha</th>
              <th className="pb-1 pr-3">Código</th>
              <th className="pb-1 pr-3">Construtora/Obra</th>
              <th className="pb-1">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((s, i) => (
              <tr key={i}>
                <td className="py-1 pr-3 font-mono">{s.csvRow}</td>
                <td className="py-1 pr-3 font-mono">{s.codigo || "—"}</td>
                <td className="py-1 pr-3">{[s.construtora, s.obra].filter(Boolean).join(" / ") || "—"}</td>
                <td className="py-1 text-amber-700">{s.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function RefList({ label, items }: { label: string; items: string[] }) {
  return (
    <p className="text-xs">
      <span className="text-muted-foreground">{label}:</span>{" "}
      {items.map((v) => <span key={v} className="inline-block mr-1.5 rounded bg-muted px-1.5 py-0.5 font-mono">{v}</span>)}
    </p>
  );
}
