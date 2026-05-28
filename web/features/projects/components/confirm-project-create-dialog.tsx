"use client";

import { useEffect, useRef } from "react";
import { ClipboardCheck } from "lucide-react";
import type { Project } from "@/features/projects/domain/project-types";

type ConfirmProjectCreateDialogProps = {
  open: boolean;
  projectData: Partial<Project>;
  onReview: () => void;
  onConfirmSave: () => void;
  isSaving?: boolean;
};

function boolLabel(value: boolean | undefined): string {
  return value ? "Sim" : "Nao";
}

function textOrDash(value: string | null | undefined): string {
  return value && value.trim() ? value : "-";
}

export function ConfirmProjectCreateDialog({
  open,
  projectData,
  onReview,
  onConfirmSave,
  isSaving = false,
}: ConfirmProjectCreateDialogProps) {
  const reviewRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    reviewRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onReview();
        return;
      }

      if (event.key !== "Tab") return;

      const first = reviewRef.current;
      const last = confirmRef.current;
      if (!first || !last) return;

      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onReview]);

  if (!open) return null;

  const dateLabel = projectData.data_previsao ? "Data prevista" : "Data do cadastro";
  const dateValue = projectData.data_previsao ?? projectData.data_lancamento;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onReview();
      }}
    >
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-create-title"
        aria-describedby="confirm-create-description"
        className="w-full max-w-[760px] animate-[fadeScaleIn_150ms_ease-out] rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_32px_64px_-20px_rgba(0,0,0,0.35)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="mb-4 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            <ClipboardCheck size={18} />
          </span>
          <div>
            <h2 id="confirm-create-title" className="text-lg font-bold text-zinc-900">
              Confirmar cadastro do projeto?
            </h2>
            <p id="confirm-create-description" className="mt-1 text-sm leading-relaxed text-zinc-600">
              Revise as informacoes abaixo antes de salvar. Se estiver tudo correto, confirme o cadastro. Caso precise alterar algo, volte para edicao.
            </p>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-2">
          <section className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
            <h3 className="text-sm font-semibold text-zinc-900">Identificacao</h3>
            <dl className="mt-2 grid gap-1 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Construtora</dt><dd className="text-zinc-800">{textOrDash(projectData.construtora)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Obra</dt><dd className="text-zinc-800">{textOrDash(projectData.obra)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Codigo</dt><dd className="text-zinc-800">{textOrDash(projectData.codigo_projeto)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Vendedor</dt><dd className="text-zinc-800">{textOrDash(projectData.vendedor)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Equipamento</dt><dd className="text-zinc-800">{textOrDash(projectData.equipamento)}</dd></div>
            </dl>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
            <h3 className="text-sm font-semibold text-zinc-900">Contato tecnico</h3>
            <dl className="mt-2 grid gap-1 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Engenheiro</dt><dd className="text-zinc-800">{textOrDash(projectData.engenheiro_nome)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Telefone do engenheiro</dt><dd className="text-zinc-800">{textOrDash(projectData.engenheiro_celular)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Tipo de cabine</dt><dd className="text-zinc-800">{textOrDash(projectData.tipo_cabine)}</dd></div>
            </dl>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
            <h3 className="text-sm font-semibold text-zinc-900">Alinhamento</h3>
            <dl className="mt-2 grid gap-1 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Projeto de obra recebido</dt><dd className="text-zinc-800">{boolLabel(projectData.proj_obra_recebido)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Local da cabine definido</dt><dd className="text-zinc-800">{boolLabel(projectData.local_cabine_definido)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">{dateLabel}</dt><dd className="text-zinc-800">{textOrDash(dateValue)}</dd></div>
            </dl>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
            <h3 className="text-sm font-semibold text-zinc-900">Prioridade</h3>
            <dl className="mt-2 grid gap-1 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Urgente</dt><dd className="text-zinc-800">{boolLabel(projectData.urgente)}</dd></div>
            </dl>
          </section>
        </div>

        <footer className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={reviewRef}
            type="button"
            onClick={onReview}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Revisar informacoes
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirmSave}
            disabled={isSaving}
            className="rounded-xl bg-[#9e0b0f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7f090c] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            {isSaving ? "Salvando..." : "Confirmar e salvar"}
          </button>
        </footer>
      </article>
    </div>
  );
}
