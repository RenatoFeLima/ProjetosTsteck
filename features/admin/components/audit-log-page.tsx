"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ActivityIcon,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  LogIn,
  LogOut,
  Search,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUsersStore } from "@/features/auth/state/users-store";
import type { AuditLog } from "@/features/auth/lib/auth-types";

// ─── Mapa de ações ────────────────────────────────────────────────────────────

type ActionMeta = {
  label: string;
  icon: React.ReactNode;
  color: string;
};

const ACTION_MAP: Record<string, ActionMeta> = {
  LOGIN:                { label: "Login",             icon: <LogIn size={12} />,       color: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/40" },
  LOGOUT:               { label: "Logout",            icon: <LogOut size={12} />,      color: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700" },
  LOGIN_FAILED:         { label: "Falha login",       icon: <AlertCircle size={12} />, color: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border-red-200 dark:border-red-700/40" },
  USER_CREATED:         { label: "Usuário criado",    icon: <UserPlus size={12} />,    color: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40" },
  USER_UPDATED:         { label: "Usuário editado",   icon: <UserCheck size={12} />,   color: "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/40" },
  USER_SEEDED:          { label: "Seed inicial",      icon: <ActivityIcon size={12} />,color: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40" },
  PASSWORD_RESET:       { label: "Senha redefinida",  icon: <KeyRound size={12} />,    color: "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/40" },
  PASSWORD_SELF_CHANGED:{ label: "Senha alterada",    icon: <KeyRound size={12} />,    color: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40" },
  USER_PROMOTED_ADMIN:  { label: "Promovido admin",   icon: <ShieldCheck size={12} />, color: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/40" },
  USER_REVOKED_ADMIN:   { label: "Admin revogado",    icon: <ShieldOff size={12} />,   color: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700" },
  USER_INACTIVATED:     { label: "Inativado",         icon: <UserMinus size={12} />,   color: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border-red-200 dark:border-red-700/40" },
  USER_ACTIVATED:       { label: "Ativado",           icon: <CheckCircle2 size={12} />,color: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/40" },
};

const ALL_ACTIONS = Object.keys(ACTION_MAP);

// ─── Componente ───────────────────────────────────────────────────────────────

export function AuditLogPage() {
  const auditLogs = useUsersStore((s) => s.auditLogs);

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");

  const filtered = auditLogs.filter((log) => {
    if (actionFilter !== "ALL" && log.action !== actionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        (log.actorName ?? "").toLowerCase().includes(q) ||
        (log.targetName ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-white/8 px-6 py-5">
        <h1 className="text-[18px] font-semibold text-zinc-900 dark:text-foreground">Auditoria</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Registro de eventos de acesso e gerenciamento de usuários.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 dark:border-white/6 px-6 py-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por usuário ou mensagem…"
            className="h-9 w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-panel-soft pl-8 pr-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 placeholder:text-zinc-400 text-zinc-900 dark:text-foreground"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="h-9 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-panel-soft px-3 pr-7 text-[13px] text-zinc-900 dark:text-foreground outline-none cursor-pointer focus:border-brand focus:ring-2 focus:ring-brand/10 appearance-none"
        >
          <option value="ALL">Todas as ações</option>
          {ALL_ACTIONS.map((a) => (
            <option key={a} value={a}>{ACTION_MAP[a]?.label ?? a}</option>
          ))}
        </select>

        <span className="ml-auto text-[12px] text-zinc-400">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-zinc-400">
            <ActivityIcon size={32} className="opacity-40" />
            <p className="text-[14px]">Nenhum registro encontrado.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-white/8">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft">
                  {["Data / Hora", "Ação", "Ator", "Mensagem", "Usuário alvo"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => {
                  const meta = ACTION_MAP[log.action];
                  return (
                    <tr key={log.id} className="border-b border-zinc-100 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-[12px] text-zinc-500 whitespace-nowrap">
                        {format(parseISO(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold", meta?.color ?? "bg-zinc-100 text-zinc-600 border-zinc-200")}>
                          {meta?.icon}
                          {meta?.label ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-zinc-700 dark:text-zinc-300">
                        {log.actorName ?? <span className="text-zinc-400">sistema</span>}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-zinc-600 dark:text-zinc-400 max-w-xs">
                        {log.message}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-zinc-500">
                        {log.targetName ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
