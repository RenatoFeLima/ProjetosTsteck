"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileUp, Loader2, UploadCloud } from "lucide-react";
import type { ImportReport } from "@/features/import/domain/import-types";

type Phase = "idle" | "dry-running" | "dry-done" | "committing" | "committed";

export function ImportProjectsPage() {
  const [cadastro, setCadastro] = useState<File | null>(null);
  const [ante, setAnte] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const cadastroRef = useRef<HTMLInputElement>(null);
  const anteRef = useRef<HTMLInputElement>(null);

  const busy = phase === "dry-running" || phase === "committing";
  const canSubmit = Boolean(cadastro || ante) && !busy;

  function buildForm() {
    const fd = new FormData();
    if (cadastro) fd.append("cadastroInicial", cadastro);
    if (ante) fd.append("anteProjeto", ante);
    return fd;
  }

  async function run(url: string, next: Phase, running: Phase) {
    setError("");
    setPhase(running);
    try {
      const res = await fetch(url, { method: "POST", body: buildForm() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Falha na importação.");
      setReport(data as ImportReport);
      setPhase(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      setPhase(report ? "dry-done" : "idle");
    }
  }

  const dryRun = () => run("/api/admin/import-projects/dry-run", "dry-done", "dry-running");
  const commit = () => {
    if (!window.confirm("Confirmar a importação? As obras e projetos serão gravados no banco.")) return;
    run("/api/admin/import-projects/commit", "committed", "committing");
  };

  return (
    <div className="mx-auto max-w-[1000px] p-6">
      <h1 className="text-xl font-bold text-zinc-900 dark:text-foreground">Importar projetos do legado (CSV)</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Envie os arquivos <strong>Cadastro Inicial</strong> e/ou <strong>Ante-Projeto</strong>. Rode o{" "}
        <strong>dry-run</strong> para conferir o relatório e só então confirme a gravação. Construtoras, vendedores,
        equipamentos e tipos de cabine precisam já existir no banco (não são criados). Nenhum e-mail é enviado.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <FilePicker
          label="Cadastro Inicial"
          file={cadastro}
          inputRef={cadastroRef}
          onPick={(f) => { setCadastro(f); setReport(null); setPhase("idle"); }}
        />
        <FilePicker
          label="Ante-Projeto"
          file={ante}
          inputRef={anteRef}
          onPick={(f) => { setAnte(f); setReport(null); setPhase("idle"); }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={dryRun}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-4 py-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 transition hover:bg-zinc-50 dark:hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {phase === "dry-running" ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
          Dry-run (pré-visualizar)
        </button>
        <button
          type="button"
          disabled={busy || phase === "idle" || !report || report.dryRun === false}
          onClick={commit}
          className="inline-flex items-center gap-2 rounded-xl bg-[#9e0b0f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7f090c] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {phase === "committing" ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
          Confirmar importação
        </button>
      </div>

      {error && (
        <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#9e0b0f]">
          <AlertCircle size={14} /> {error}
        </p>
      )}

      {report && <ReportView report={report} />}
    </div>
  );
}

function FilePicker({
  label,
  file,
  inputRef,
  onPick,
}: {
  label: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (f: File | null) => void;
}) {
  return (
    <label className="flex cursor-pointer flex-col gap-1 rounded-xl border border-dashed border-zinc-300 dark:border-white/15 bg-zinc-50 dark:bg-panel-soft p-3 text-sm transition hover:border-zinc-400">
      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{label}</span>
      <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{file ? file.name : "Clique para escolher o .csv"}</span>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function ReportView({ report }: { report: ImportReport }) {
  const committed = report.committed;
  return (
    <div className="mt-6 space-y-4">
      {committed ? (
        <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 size={16} /> Importado: {committed.projects} projeto(s), {committed.works} obra(s) e {committed.constructors} construtora(s).
        </div>
      ) : (
        <div className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          Pré-visualização (nada gravado ainda).
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Linhas lidas (Cad. Inicial)" value={report.rowsRead.cadastroInicial} />
        <Stat label="Linhas lidas (Ante-Projeto)" value={report.rowsRead.anteProjeto} />
        <Stat label="Construtoras a criar" value={report.constructorsToCreate.length} />
        <Stat label="Obras a criar" value={report.worksToCreate.length} />
        <Stat label="Obras já existentes" value={report.worksExistingMatched} />
        <Stat label="Projetos a criar" value={report.projectsToCreate.length} />
        <Stat label="Códigos provisórios" value={report.tempCodesAssigned} />
        <Stat label="Projetos ignorados (duplicados)" value={report.projectsSkippedDuplicate.length} danger={report.projectsSkippedDuplicate.length > 0} />
        <Stat label="Erros de data" value={report.dateErrors.length} danger={report.dateErrors.length > 0} />
        <Stat label="Vendedores não encontrados" value={report.sellersNotFound.length} />
        <Stat label="Equipamentos não encontrados" value={report.equipmentNotFound.length} />
        <Stat label="Cabines não encontradas" value={report.cabinTypesNotFound.length} />
        <Stat label="Engenheiros inline (sem cadastro)" value={report.engineersInline.length} />
        <Stat label="Status URGENTE! assumido" value={report.statusUrgentAssumed.length} />
      </div>

      <Detail title={`Construtoras a criar (${report.constructorsToCreate.length})`} rows={report.constructorsToCreate.map((c) => c.name).sort((a, b) => a.localeCompare(b, "pt-BR"))} />
      <Detail title={`Projetos ignorados por duplicidade (${report.projectsSkippedDuplicate.length})`} rows={report.projectsSkippedDuplicate.map((p) => `${p.code}  —  ${p.construtora} / ${p.obra}  (${p.reason})`)} />
      <Detail title={`Erros de data (${report.dateErrors.length})`} rows={report.dateErrors.map((d) => `${d.field}="${d.raw}"  —  ${d.construtora} / ${d.obra} [${d.source}]`)} />
      <Detail title={`Obras a criar (${report.worksToCreate.length})`} rows={report.worksToCreate.map((w) => `${w.construtora}  —  ${w.obra}`)} />
      <Detail title={`Projetos a criar (${report.projectsToCreate.length})`} rows={report.projectsToCreate.map((p) => `${p.code}  [${p.statusLabel}]${p.temp ? " (provisório)" : ""}${p.urgente ? " ⚠ urgente" : ""}  —  ${p.construtora} / ${p.obra}`)} />
      <Detail title={`Vendedores não encontrados (${report.sellersNotFound.length})`} rows={report.sellersNotFound.map((s) => `${s.valor}  —  ${s.construtora} / ${s.obra}`)} />
      <Detail title={`Equipamentos não encontrados (${report.equipmentNotFound.length})`} rows={report.equipmentNotFound.map((e) => `${e.valor}  —  ${e.construtora} / ${e.obra}`)} />
      <Detail title={`Tipos de cabine não encontrados (${report.cabinTypesNotFound.length})`} rows={report.cabinTypesNotFound.map((c) => `${c.valor}  —  ${c.construtora} / ${c.obra}`)} />
      <Detail title={`Engenheiros gravados inline (${report.engineersInline.length})`} rows={report.engineersInline} />
    </div>
  );
}


function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel-soft p-3">
      <div className={`text-2xl font-bold ${danger && value > 0 ? "text-[#9e0b0f]" : "text-zinc-900 dark:text-foreground"}`}>{value}</div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}

function Detail({ title, rows }: { title: string; rows: string[] }) {
  if (rows.length === 0) return null;
  return (
    <details className="rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel-soft p-3">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</summary>
      <ul className="mt-2 max-h-72 space-y-0.5 overflow-auto font-mono text-xs text-zinc-600 dark:text-zinc-300">
        {rows.map((r, i) => (
          <li key={i} className="truncate">{r}</li>
        ))}
      </ul>
    </details>
  );
}
