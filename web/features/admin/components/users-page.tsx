"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
  UserMinus,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_COLORS, ROLE_LABELS } from "@/features/auth/lib/permissions";
import { useAuth } from "@/features/auth/hooks/use-auth";
import * as usersApi from "@/features/admin/lib/users-api";
import { UserFormDialog } from "./user-form-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";
import type { User, UserRole } from "@/features/auth/lib/auth-types";

// ─── Componente principal ─────────────────────────────────────────────────────

export function UsersPage() {
  const { session, refreshSession } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "active" | "inactive">("ALL");
  const [toast, setToast] = useState<{ type: "ok" | "err"; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      setUsers(await usersApi.fetchUsers());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Erro ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);

  const canCreate = session?.user.permissions.users.create ?? false;
  const canEdit = session?.user.permissions.users.edit ?? false;
  const canResetPwd = session?.user.permissions.users.resetPassword ?? false;
  const canPromote = session?.user.permissions.users.promoteAdmin ?? false;
  const canManage = session?.user.permissions.users.managePermissions ?? false;
  const isSelf = (u: User) => u.id === session?.user.id;

  // ── Filtros ────────────────────────────────────────────────────────────────
  const filtered = users.filter((u) => {
    if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
    if (statusFilter === "active" && !u.active) return false;
    if (statusFilter === "inactive" && u.active) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  function showToast(type: "ok" | "err", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }

  /** Executa uma mutação na API, recarrega a lista e revalida a própria sessão. */
  async function run(fn: () => Promise<unknown>, okMsg: string) {
    try {
      await fn();
      await load();
      refreshSession();
      showToast("ok", okMsg);
    } catch (e) {
      showToast("err", e instanceof Error ? e.message : "Erro ao executar ação.");
    }
  }

  const handlePromote = (u: User) => run(() => usersApi.setRole(u.id, "promote"), `${u.name} agora é Administrador.`);
  const handleRevoke = (u: User) => run(() => usersApi.setRole(u.id, "revoke"), `Perfil de administrador removido de ${u.name}.`);
  const handleInactivate = (u: User) => run(() => usersApi.setActive(u.id, false), `${u.name} foi inativado.`);
  const handleActivate = (u: User) => run(() => usersApi.setActive(u.id, true), `${u.name} foi ativado.`);
  const handleRequirePwdChange = (u: User) =>
    run(() => usersApi.updateUser(u.id, { mustChangePassword: true }), `${u.name} deverá trocar a senha no próximo login.`);

  return (
    <div className="flex h-full flex-col">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-5 right-5 z-[60] flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg text-[13px] transition-all",
            toast.type === "ok"
              ? "border-emerald-200 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
              : "border-red-200 dark:border-red-700/40 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300",
          )}
        >
          {toast.type === "ok" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.message}
        </div>
      )}

      {/* Dialogs */}
      <UserFormDialog open={createOpen} onClose={() => setCreateOpen(false)} mode="create" onSaved={load} />
      <UserFormDialog open={!!editUser} onClose={() => setEditUser(null)} mode="edit" user={editUser} onSaved={load} />
      <ResetPasswordDialog open={!!resetUser} onClose={() => setResetUser(null)} user={resetUser} onSaved={load} />

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 dark:border-white/8 px-6 py-5">
        <div>
          <h1 className="text-[18px] font-semibold text-zinc-900 dark:text-foreground">Usuários</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Gerencie acessos, permissões e credenciais do sistema.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-brand/90 active:scale-[0.99] transition-all shrink-0"
          >
            <Plus size={14} />
            Novo usuário
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 dark:border-white/6 px-6 py-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, usuário ou e-mail…"
            className="h-9 w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-panel-soft pl-8 pr-3 text-[13px] text-zinc-900 dark:text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 placeholder:text-zinc-400"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | "ALL")}
          className={selectCls}
        >
          <option value="ALL">Todos os perfis</option>
          {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | "active" | "inactive")}
          className={selectCls}
        >
          <option value="ALL">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>

        <span className="ml-auto text-[12px] text-zinc-400">{filtered.length} usuário{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-400">
            <Loader2 size={26} className="animate-spin opacity-60" />
            <p className="text-[14px]">Carregando usuários…</p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-red-500">
            <AlertCircle size={30} className="opacity-60" />
            <p className="text-[14px]">{loadError}</p>
            <button
              onClick={() => { setLoading(true); void load(); }}
              className="rounded-lg border border-zinc-200 dark:border-white/10 px-3 py-1.5 text-[13px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5"
            >
              Tentar novamente
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-zinc-400">
            <UserX size={32} className="opacity-40" />
            <p className="text-[14px]">Nenhum usuário encontrado.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-white/8">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft">
                  {["Nome", "Usuário", "E-mail", "Perfil", "Status", "Último acesso", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    className={cn(
                      "border-b border-zinc-100 dark:border-white/5 last:border-0 transition-colors",
                      !u.active && "opacity-60",
                      "hover:bg-zinc-50 dark:hover:bg-white/[0.02]",
                    )}
                  >
                    {/* Nome */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">
                          {u.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <p className="text-[13px] font-medium text-zinc-900 dark:text-foreground leading-tight">
                            {u.name}
                            {isSelf(u) && (
                              <span className="ml-1.5 rounded bg-brand/10 px-1 py-0.5 text-[10px] font-semibold text-brand">
                                você
                              </span>
                            )}
                          </p>
                          {u.mustChangePassword && (
                            <span className="flex items-center gap-1 text-[11px] text-amber-500">
                              <Clock3 size={10} />
                              Troca pendente
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Usuário */}
                    <td className="px-4 py-3.5 text-[13px] text-zinc-600 dark:text-zinc-400">
                      @{u.username}
                    </td>

                    {/* E-mail */}
                    <td className="px-4 py-3.5 text-[13px] text-zinc-500">
                      {u.email ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                    </td>

                    {/* Perfil */}
                    <td className="px-4 py-3.5">
                      <span className={cn("rounded-md border px-2.5 py-1 text-[11px] font-semibold", ROLE_COLORS[u.role])}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
                        u.active
                          ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500",
                      )}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", u.active ? "bg-emerald-500" : "bg-zinc-400")} />
                        {u.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    {/* Último acesso */}
                    <td className="px-4 py-3.5 text-[13px] text-zinc-500">
                      {u.lastLoginAt
                        ? format(parseISO(u.lastLoginAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : <span className="text-zinc-300 dark:text-zinc-600">Nunca</span>}
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3.5">
                      <UserActionsMenu
                        user={u}
                        isSelf={isSelf(u)}
                        canEdit={canEdit || canManage}
                        canResetPwd={canResetPwd}
                        canPromote={canPromote}
                        onEdit={() => setEditUser(u)}
                        onReset={() => setResetUser(u)}
                        onRequirePwdChange={() => handleRequirePwdChange(u)}
                        onPromote={() => handlePromote(u)}
                        onRevoke={() => handleRevoke(u)}
                        onInactivate={() => handleInactivate(u)}
                        onActivate={() => handleActivate(u)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

type UserActionsMenuProps = {
  user: User;
  isSelf: boolean;
  canEdit: boolean;
  canResetPwd: boolean;
  canPromote: boolean;
  onEdit: () => void;
  onReset: () => void;
  onRequirePwdChange: () => void;
  onPromote: () => void;
  onRevoke: () => void;
  onInactivate: () => void;
  onActivate: () => void;
};

/**
 * Menu de ações por usuário.
 * Usa Radix DropdownMenu com Portal: o conteúdo é renderizado no <body>, fora
 * do container da tabela (overflow-hidden/overflow-auto), portanto nunca é
 * cortado. avoidCollisions + collisionPadding reposicionam o menu (cima/baixo)
 * conforme o espaço disponível — funciona na última linha e em telas menores.
 */
function UserActionsMenu({
  user, isSelf, canEdit, canResetPwd, canPromote,
  onEdit, onReset, onRequirePwdChange, onPromote, onRevoke, onInactivate, onActivate,
}: UserActionsMenuProps) {
  // Itens visíveis dependem das permissões do usuário logado.
  const showEdit = canEdit;
  const showReset = canResetPwd;
  const showRequirePwd = canEdit;
  const showPromote = canPromote && user.role !== "ADMIN";
  const showRevoke = canPromote && user.role === "ADMIN" && !isSelf;
  const showInactivate = (canEdit || canPromote) && !isSelf && user.active;
  const showActivate = (canEdit || canPromote) && !user.active;

  const hasAnyAction =
    showEdit || showReset || showRequirePwd || showPromote || showRevoke || showInactivate || showActivate;

  if (!hasAnyAction) {
    return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/8 hover:text-zinc-600 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/30 data-[state=open]:bg-zinc-100 dark:data-[state=open]:bg-white/8"
          aria-label="Ações do usuário"
        >
          <MoreHorizontal size={15} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={12}
          avoidCollisions
          className={cn(
            "z-[80] min-w-[13rem] overflow-hidden rounded-xl border p-1 shadow-lg",
            "border-zinc-200 bg-white dark:border-white/10 dark:bg-panel",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[side=top]:slide-in-from-bottom-1 data-[side=bottom]:slide-in-from-top-1",
          )}
        >
          {showEdit && (
            <ActionItem icon={<Pencil size={13} />} label="Editar" onSelect={onEdit} />
          )}
          {showReset && (
            <ActionItem icon={<KeyRound size={13} />} label="Redefinir senha" onSelect={onReset} />
          )}
          {showRequirePwd && (
            <ActionItem icon={<Clock3 size={13} />} label="Exigir troca de senha" onSelect={onRequirePwdChange} />
          )}
          {showPromote && (
            <ActionItem icon={<ShieldCheck size={13} />} label="Tornar administrador" onSelect={onPromote} />
          )}
          {showRevoke && (
            <ActionItem icon={<ShieldOff size={13} />} label="Remover administrador" danger onSelect={onRevoke} />
          )}
          {showInactivate && (
            <ActionItem icon={<UserMinus size={13} />} label="Inativar" danger onSelect={onInactivate} />
          )}
          {showActivate && (
            <ActionItem icon={<CheckCircle2 size={13} />} label="Ativar" onSelect={onActivate} />
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ActionItem({
  icon, label, danger, onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] outline-none transition-colors",
        "data-[highlighted]:bg-zinc-50 dark:data-[highlighted]:bg-white/5",
        danger
          ? "text-red-600 dark:text-red-400 data-[highlighted]:bg-red-50 dark:data-[highlighted]:bg-red-900/20"
          : "text-zinc-700 dark:text-zinc-300",
      )}
    >
      {icon}
      {label}
    </DropdownMenu.Item>
  );
}

const selectCls = cn(
  "h-9 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-panel-soft px-3 pr-7 text-[13px]",
  "text-zinc-900 dark:text-foreground outline-none cursor-pointer transition-all",
  "focus:border-brand focus:ring-2 focus:ring-brand/10",
  "appearance-none",
);
