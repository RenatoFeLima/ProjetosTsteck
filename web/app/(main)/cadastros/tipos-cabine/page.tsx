"use client";

import { useMemo, useState } from "react";
import { Box } from "lucide-react";
import { MasterDataTable } from "@/features/master-data/components/master-data-table";
import { MasterDataStates } from "@/features/master-data/components/master-data-states";
import { TipoCabineFormDialog } from "@/features/master-data/components/tipo-cabine-form-dialog";
import { useMasterDataEntity } from "@/features/master-data/hooks/use-master-data-entity";
import type { TipoCabine } from "@/features/master-data/domain/master-data-types";

export default function TiposCabinePage() {
  const { items, loading, error, create, update, setActive } = useMasterDataEntity<TipoCabine>("tiposCabine", { includeInactive: true });

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TipoCabine | undefined>();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((t) => !q || t.name.toLowerCase().includes(q));
  }, [items, search]);

  async function handleSave(data: Partial<TipoCabine>) {
    if (editing) await update(editing.id, data);
    else await create(data);
    setModalOpen(false);
    setEditing(undefined);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <Box size={24} className="text-brand" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-foreground">Tipos de Cabine</h1>
          <p className="text-sm text-zinc-500 dark:text-muted">Gerencie os tipos de cabine disponíveis.</p>
        </div>
      </div>

      <MasterDataStates loading={loading} error={error} empty={items.length === 0} entityLabel="tipo de cabine">
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
          onToggle={(item) => setActive(item.id, !item.active)}
          onDelete={(item) => { if (confirm(`Inativar "${item.name}"?`)) setActive(item.id, false); }}
          entityLabel="Tipo de Cabine"
          searchValue={search}
          onSearch={setSearch}
        />
      </MasterDataStates>

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
