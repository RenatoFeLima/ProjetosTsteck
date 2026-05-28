"use client";

import { useMemo, useState } from "react";
import { Wrench } from "lucide-react";
import { EquipamentoFormDialog } from "@/features/master-data/components/equipamento-form-dialog";
import { MasterDataTable } from "@/features/master-data/components/master-data-table";
import type { Equipamento } from "@/features/master-data/domain/master-data-types";
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";
import { useCurrentUser } from "@/features/user/hooks/use-current-user";

export default function EquipamentosPage() {
  const store = useMasterDataStore();
  const { user } = useCurrentUser();
  const by = user?.name ?? "anônimo";

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Equipamento | undefined>();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return store.equipamentos.filter(
      (e) => !q || e.code.toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q),
    );
  }, [store.equipamentos, search]);

  function handleSave(data: Partial<Equipamento>) {
    if (editing) {
      store.updateEquipamento(editing.id, data, by);
    } else {
      store.addEquipamento({ code: data.code!, description: data.description, family: data.family, capacity: data.capacity, dimension: data.dimension, notes: data.notes, createdBy: by }, by);
    }
    setModalOpen(false);
    setEditing(undefined);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <Wrench size={24} className="text-brand" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Equipamentos</h1>
          <p className="text-sm text-zinc-500">Gerencie os equipamentos cadastrados no sistema.</p>
        </div>
      </div>

      <MasterDataTable
        items={filtered}
        columns={[
          { key: "code", label: "Código" },
          { key: "description", label: "Descrição" },
          { key: "family", label: "Família" },
          { key: "capacity", label: "Capacidade" },
          {
            key: "active",
            label: "Status",
            render: (item) => (
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${item.active ? "bg-ok/10 text-ok" : "bg-zinc-200 text-zinc-500"}`}>
                {item.active ? "Ativo" : "Inativo"}
              </span>
            ),
          },
        ]}
        onAdd={() => { setEditing(undefined); setModalOpen(true); }}
        onEdit={(item) => { setEditing(item); setModalOpen(true); }}
        onToggle={(item) => store.toggleEquipamento(item.id, by)}
        onDelete={(item) => { if (confirm(`Excluir "${item.code}"?`)) store.deleteEquipamento(item.id, by); }}
        entityLabel="Equipamento"
        searchValue={search}
        onSearch={setSearch}
      />

      <EquipamentoFormDialog
        open={modalOpen}
        mode={editing ? "edit" : "create"}
        item={editing}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        onSave={handleSave}
      />
    </div>
  );
}
