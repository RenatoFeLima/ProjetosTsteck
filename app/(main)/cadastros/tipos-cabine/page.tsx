"use client";

import { useMemo, useState } from "react";
import { Box } from "lucide-react";
import { MasterDataTable } from "@/features/master-data/components/master-data-table";
import { TipoCabineFormDialog } from "@/features/master-data/components/tipo-cabine-form-dialog";
import type { TipoCabine } from "@/features/master-data/domain/master-data-types";
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";
import { useCurrentUser } from "@/features/user/hooks/use-current-user";

export default function TiposCabinePage() {
  const store = useMasterDataStore();
  const { user } = useCurrentUser();
  const by = user?.name ?? "anônimo";

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TipoCabine | undefined>();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return store.tiposCabine.filter((t) => !q || t.name.toLowerCase().includes(q));
  }, [store.tiposCabine, search]);

  function handleSave(data: Partial<TipoCabine>) {
    if (editing) {
      store.updateTipoCabine(editing.id, data, by);
    } else {
      store.addTipoCabine({ name: data.name!, description: data.description, createdBy: by }, by);
    }
    setModalOpen(false);
    setEditing(undefined);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <Box size={24} className="text-brand" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Tipos de Cabine</h1>
          <p className="text-sm text-zinc-500">Gerencie os tipos de cabine disponíveis.</p>
        </div>
      </div>

      <MasterDataTable
        items={filtered}
        columns={[
          { key: "name", label: "Nome" },
          { key: "description", label: "Descrição" },
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
        onToggle={(item) => store.toggleTipoCabine(item.id, by)}
        onDelete={(item) => { if (confirm(`Excluir "${item.name}"?`)) store.deleteTipoCabine(item.id, by); }}
        entityLabel="Tipo de Cabine"
        searchValue={search}
        onSearch={setSearch}
      />

      <TipoCabineFormDialog
        open={modalOpen}
        mode={editing ? "edit" : "create"}
        item={editing}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        onSave={handleSave}
      />
    </div>
  );
}
