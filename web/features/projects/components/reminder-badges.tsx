"use client";

// Badges e controles compartilhados de Lembretes Operacionais (card do Kanban,
// drawer, tela de Alertas e modal de alerta). O lembrete NUNCA pinta o card
// inteiro — apenas um pill discreto com o estado mais crítico + contador.

import { useEffect, useRef, useState } from "react";
import { addDays, formatISO } from "date-fns";
import { BellRing, CalendarClock, ChevronDown } from "lucide-react";
import {
  getReminderDueState,
  reminderBadgeLabel,
  reminderDaysOverdue,
  type ProjectReminder,
  type ReminderDueState,
} from "@/features/projects/domain/project-reminders";
import { todayIsoDate } from "@/features/projects/domain/project-rules";
import { formatUrgentDeadline } from "./pill-badges";

// ─── Estilos por estado/prioridade ────────────────────────────────────────────

const STATE_STYLES: Record<ReminderDueState, string> = {
  vencido:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-700/50 dark:bg-red-900/25 dark:text-red-300",
  hoje: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300",
  futuro:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700/40 dark:bg-sky-900/20 dark:text-sky-300",
};

export const STATE_LABELS: Record<ReminderDueState, string> = {
  vencido: "Vencido",
  hoje: "Hoje",
  futuro: "Futuro",
};

/** Chip pequeno de prioridade (Alta tem destaque maior que Normal). */
export function ReminderPriorityChip({ prioridade }: { prioridade: ProjectReminder["prioridade"] }) {
  if (prioridade !== "ALTA") return null;
  return (
    <span className="inline-flex items-center rounded-full border border-red-300 bg-red-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-red-700 dark:border-red-700/60 dark:bg-red-900/40 dark:text-red-200">
      Alta
    </span>
  );
}

/**
 * Pill do card do Kanban: estado do lembrete MAIS CRÍTICO + prioridade + "+N"
 * quando há outros lembretes ativos no projeto.
 */
export function ReminderPill({
  reminder,
  extraCount = 0,
  todayISO = todayIsoDate(),
}: {
  reminder: ProjectReminder;
  extraCount?: number;
  todayISO?: string;
}) {
  const state = getReminderDueState(reminder, todayISO);
  const overdueDays = reminderDaysOverdue(reminder, todayISO);
  const title =
    `${reminder.descricao}` +
    (state === "vencido" ? ` — vencido há ${overdueDays}d` : ` — ${formatUrgentDeadline(reminder.proxima_data)}`);

  return (
    <span
      title={title}
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        STATE_STYLES[state],
        reminder.prioridade === "ALTA" ? "ring-1 ring-red-300/70 dark:ring-red-700/50" : "",
      ].join(" ")}
    >
      <BellRing size={11} />
      {reminderBadgeLabel(reminder, todayISO)}
      <ReminderPriorityChip prioridade={reminder.prioridade} />
      {extraCount > 0 && (
        <span className="rounded-full bg-white/70 px-1 text-[9px] font-bold text-zinc-600 dark:bg-black/30 dark:text-zinc-300">
          +{extraCount}
        </span>
      )}
    </span>
  );
}

/** Badge de estado (Vencido/Hoje/Futuro) usado no drawer e na tela de Alertas. */
export function ReminderStateBadge({
  reminder,
  todayISO = todayIsoDate(),
}: {
  reminder: ProjectReminder;
  todayISO?: string;
}) {
  const state = getReminderDueState(reminder, todayISO);
  const overdueDays = reminderDaysOverdue(reminder, todayISO);
  return (
    <span
      className={["inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", STATE_STYLES[state]].join(" ")}
    >
      <CalendarClock size={11} />
      {state === "vencido" ? `Vencido há ${overdueDays}d` : state === "hoje" ? "Hoje" : formatUrgentDeadline(reminder.proxima_data)}
    </span>
  );
}

// ─── Menu de adiamento (Amanhã / +7d / +15d / Escolher data) ─────────────────

export function postponeQuickDates(todayISO: string = todayIsoDate()) {
  const base = new Date(`${todayISO.slice(0, 10)}T12:00:00`);
  const toIso = (d: Date) => formatISO(d, { representation: "date" });
  return {
    amanha: toIso(addDays(base, 1)),
    seteDias: toIso(addDays(base, 7)),
    quinzeDias: toIso(addDays(base, 15)),
  };
}

export function ReminderPostponeMenu({
  onPostpone,
  disabled,
  todayISO = todayIsoDate(),
}: {
  onPostpone: (date: string) => void;
  disabled?: boolean;
  todayISO?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const quick = postponeQuickDates(todayISO);

  // Fecha ao clicar fora / Escape.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pick(date: string) {
    setOpen(false);
    setPickingDate(false);
    setCustomDate("");
    onPostpone(date);
  }

  const itemCls =
    "block w-full rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-100 dark:hover:bg-white/8";

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Adiar
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[110] mt-1 w-48 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-panel p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.35)]"
        >
          <button type="button" role="menuitem" className={itemCls} onClick={() => pick(quick.amanha)}>
            Amanhã
          </button>
          <button type="button" role="menuitem" className={itemCls} onClick={() => pick(quick.seteDias)}>
            Em 7 dias
          </button>
          <button type="button" role="menuitem" className={itemCls} onClick={() => pick(quick.quinzeDias)}>
            Em 15 dias
          </button>
          {!pickingDate ? (
            <button type="button" role="menuitem" className={itemCls} onClick={() => setPickingDate(true)}>
              Escolher data...
            </button>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1.5">
              <input
                type="date"
                aria-label="Nova data do lembrete"
                value={customDate}
                min={todayISO.slice(0, 10)}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-panel-soft px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200"
              />
              <button
                type="button"
                disabled={!customDate}
                onClick={() => customDate && pick(customDate)}
                className="rounded-lg bg-[#9e0b0f] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                OK
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
