"use client";

import { useMemo, useState } from "react";
import { HardHat } from "lucide-react";
import { MasterDataTable } from "@/features/master-data/components/master-data-table";
import { MasterDataStates } from "@/features/master-data/components/master-data-states";
import { ObraFormDialog } from "@/features/master-data/components/obra-form-dialog";
import { useMasterDataEntity } from "@/features/master-data/hooks/use-master-data-entity";
import type { Construtora, Obra } from "@/features/master-data/domain/master-data-types";

// A obra é serializada pela API com `construtoraName` (nome) além de `constructorId`.
type ObraRow = Obra & { constructorId?: string };

export default function ObrasPage() {
  const obrasApi = useMasterDataEntity<ObraRow>("obras", { includeInactive: true });
  const { items: construtoras } = useMasterDataEntity<Construtora & { id: string }>("construtoras");

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ObraRow | undefined>();

  const construtoraNames = useMemo(() => construtoras.map((c) => c.name), [construtoras]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return obrasApi.items.filter(
      (o) => !q || o.name.toLowerCase().includes(q) || (o.construtoraName ?? "").toLowerCase().includes(q),
    );
  }, [obrasApi.items, search]);

  async function handleSave(data: Partial<Obra>) {
    const constructorId = construtoras.find((c) => c.name === data.construtoraName)?.id;
    if (!constructorId) {
      alert("Selecione uma construtora válida.");
      return;
    }
    const payload = {
      name: data.name,
      constructorId,
      address: data.address,
      city: data.city,
      state: data.state,
      notes: data.notes,
    };
    if (editing) await obrasApi.update(editing.id, payload);
    else await obrasApi.create(payload);
    setModalOpen(false);
    setEditing(undefined);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <HardHat size={24} className="text-brand" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-foreground">Obras</h1>
          <p className="text-sm text-zinc-500 dark:text-muted">Gerencie as obras cadastradas no sistema.</p>
        </div>
      </div>

      <MasterDataStates loading={obrasApi.loading} error={obrasApi.error} empty={obrasApi.items.length === 0} entityLabel="obra">
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
          onToggle={(item) => obrasApi.setActive(item.id, !item.active)}
          onDelete={(item) => { if (confirm(`Inativar "${item.name}"?`)) obrasApi.setActive(item.id, false); }}
          entityLabel="Obra"
          searchValue={search}
          onSearch={setSearch}
        />
      </MasterDataStates>

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
