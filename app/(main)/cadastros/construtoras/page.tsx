"use client";

import { useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { ConstrutoraFormDialog } from "@/features/master-data/components/construtora-form-dialog";
import { MasterDataTable } from "@/features/master-data/components/master-data-table";
import { MasterDataStates } from "@/features/master-data/components/master-data-states";
import { useMasterDataEntity } from "@/features/master-data/hooks/use-master-data-entity";
import type { Construtora } from "@/features/master-data/domain/master-data-types";

export default function ConstrutorasPage() {
  const { items, loading, error, create, update, setActive } = useMasterDataEntity<Construtora>("construtoras", { includeInactive: true });

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Construtora | undefined>();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.cnpj ?? "").includes(q));
  }, [items, search]);

  async function handleSave(data: Partial<Construtora>) {
    if (editing) await update(editing.id, data);
    else await create(data);
    setModalOpen(false);
    setEditing(undefined);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <Building2 size={24} className="text-brand" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-foreground">Construtoras</h1>
          <p className="text-sm text-zinc-500 dark:text-muted">Gerencie as construtoras cadastradas no sistema.</p>
        </div>
      </div>

      <MasterDataStates loading={loading} error={error} empty={items.length === 0} entityLabel="construtora">
        <MasterDataTable
          items={filtered}
          columns={[
            { key: "name", label: "Nome" },
            { key: "cnpj", label: "CNPJ" },
            { key: "phone", label: "Telefone" },
            { key: "email", label: "E-mail" },
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
          entityLabel="Construtora"
          searchValue={search}
          onSearch={setSearch}
        />
      </MasterDataStates>

      <ConstrutoraFormDialog
        open={modalOpen}
        mode={editing ? "edit" : "create"}
        item={editing}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        onSave={handleSave}
      />
    </div>
  );
}
