"use client";

import { useMemo, useState } from "react";
import { HardHat } from "lucide-react";
import { MasterDataTable } from "@/features/master-data/components/master-data-table";
import { ObraFormDialog } from "@/features/master-data/components/obra-form-dialog";
import type { Obra } from "@/features/master-data/domain/master-data-types";
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";
import { useCurrentUser } from "@/features/user/hooks/use-current-user";

export default function ObrasPage() {
  const store = useMasterDataStore();
  const { user } = useCurrentUser();
  const by = user?.name ?? "anônimo";

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Obra | undefined>();

  const construtoraNames = useMemo(
    () => store.construtoras.filter((c) => c.active).map((c) => c.name),
    [store.construtoras],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return store.obras.filter(
      (o) => !q || o.name.toLowerCase().includes(q) || o.construtoraName.toLowerCase().includes(q),
    );
  }, [store.obras, search]);

  function handleSave(data: Partial<Obra>) {
    if (editing) {
      store.updateObra(editing.id, data, by);
    } else {
      store.addObra({ name: data.name!, construtoraName: data.construtoraName ?? "", address: data.address, city: data.city, notes: data.notes, createdBy: by }, by);
    }
    setModalOpen(false);
    setEditing(undefined);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <HardHat size={24} className="text-brand" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Obras</h1>
          <p className="text-sm text-zinc-500">Gerencie as obras cadastradas no sistema.</p>
        </div>
      </div>

      <MasterDataTable
        items={filtered}
        columns={[
          { key: "construtoraName", label: "Construtora" },
          { key: "name", label: "Obra" },
          { key: "city", label: "Cidade" },
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
        onToggle={(item) => store.toggleObra(item.id, by)}
        onDelete={(item) => { if (confirm(`Excluir "${item.name}"?`)) store.deleteObra(item.id, by); }}
        entityLabel="Obra"
        searchValue={search}
        onSearch={setSearch}
      />

      <ObraFormDialog
        open={modalOpen}
        mode={editing ? "edit" : "create"}
        item={editing}
        construtoraNames={construtoraNames}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        onSave={handleSave}
      />
    </div>
  );
}
