"use client";

import { ScrollText } from "lucide-react";
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";

const ENTITY_LABELS: Record<string, string> = {
  construtora: "Construtora",
  obra: "Obra",
  equipamento: "Equipamento",
  tipoCabine: "Tipo de Cabine",
  vendedor: "Vendedor",
  engenheiro: "Engenheiro",
};

const ACTION_LABELS: Record<string, string> = {
  created: "Criado",
  updated: "Atualizado",
  activated: "Ativado",
  deactivated: "Desativado",
  deleted: "Excluído",
};

const ACTION_COLORS: Record<string, string> = {
  created: "bg-ok/10 text-ok",
  updated: "bg-blue-50 text-blue-700",
  activated: "bg-ok/10 text-ok",
  deactivated: "bg-zinc-200 text-zinc-600",
  deleted: "bg-red-50 text-red-600",
};

export default function AuditoriaPage() {
  const { auditLog } = useMasterDataStore();

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <ScrollText size={24} className="text-brand" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Auditoria</h1>
          <p className="text-sm text-zinc-500">Histórico de alterações nos dados mestres.</p>
        </div>
      </div>

      {auditLog.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white px-6 py-12 text-center text-sm text-zinc-400">
          Nenhuma alteração registrada ainda.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-zinc-50">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-zinc-500">Data/Hora</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-zinc-500">Usuário</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-zinc-500">Entidade</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-zinc-500">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-zinc-500">Ação</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map((event) => (
                <tr key={event.id} className="border-b border-line last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(event.performedAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-700">{event.performedBy}</td>
                  <td className="px-4 py-3 text-zinc-600">{ENTITY_LABELS[event.entity] ?? event.entity}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900">{event.entityName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACTION_COLORS[event.action] ?? "bg-zinc-100 text-zinc-600"}`}>
                      {ACTION_LABELS[event.action] ?? event.action}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
