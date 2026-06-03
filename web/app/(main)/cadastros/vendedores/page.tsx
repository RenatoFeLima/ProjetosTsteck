"use client";

import { useMemo, useState } from "react";
import { UserRound } from "lucide-react";
import { MasterDataTable } from "@/features/master-data/components/master-data-table";
import { MasterDataStates } from "@/features/master-data/components/master-data-states";
import { VendedorFormDialog } from "@/features/master-data/components/vendedor-form-dialog";
import { useMasterDataEntity } from "@/features/master-data/hooks/use-master-data-entity";
import type { Vendedor } from "@/features/master-data/domain/master-data-types";

export default function VendedoresPage() {
  const { items, loading, error, create, update, setActive } = useMasterDataEntity<Vendedor>("vendedores", { includeInactive: true });

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vendedor | undefined>();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((v) => !q || v.name.toLowerCase().includes(q) || (v.email ?? "").toLowerCase().includes(q));
  }, [items, search]);

  async function handleSave(data: Partial<Vendedor>) {
    if (editing) await update(editing.id, data);
    else await create(data);
    setModalOpen(false);
    setEditing(undefined);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <UserRound size={24} className="text-brand" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-foreground">Vendedores</h1>
          <p className="text-sm text-zinc-500 dark:text-muted">Gerencie os vendedores cadastrados no sistema.</p>
        </div>
      </div>

      <MasterDataStates loading={loading} error={error} empty={items.length === 0} entityLabel="vendedor">
        <MasterDataTable
          items={filtered}
          columns={[
            { key: "name", label: "Nome" },
            { key: "email", label: "E-mail" },
            { key: "phone", label: "Telefone" },
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
          entityLabel="Vendedor"
          searchValue={search}
          onSearch={setSearch}
        />
      </MasterDataStates>

      <VendedorFormDialog
        open={modalOpen}
        mode={editing ? "edit" : "create"}
        item={editing}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        onSave={handleSave}
      />
    </div>
  );
}
