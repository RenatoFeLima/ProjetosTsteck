"use client";

import { useMemo, useState } from "react";
import { UserRound } from "lucide-react";
import { MasterDataTable } from "@/features/master-data/components/master-data-table";
import { VendedorFormDialog } from "@/features/master-data/components/vendedor-form-dialog";
import type { Vendedor } from "@/features/master-data/domain/master-data-types";
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";
import { useCurrentUser } from "@/features/user/hooks/use-current-user";

export default function VendedoresPage() {
  const store = useMasterDataStore();
  const { user } = useCurrentUser();
  const by = user?.name ?? "anônimo";

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vendedor | undefined>();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return store.vendedores.filter(
      (v) => !q || v.name.toLowerCase().includes(q) || (v.email ?? "").toLowerCase().includes(q),
    );
  }, [store.vendedores, search]);

  function handleSave(data: Partial<Vendedor>) {
    if (editing) {
      store.updateVendedor(editing.id, data, by);
    } else {
      store.addVendedor({ name: data.name!, email: data.email, phone: data.phone, createdBy: by }, by);
    }
    setModalOpen(false);
    setEditing(undefined);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <UserRound size={24} className="text-brand" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Vendedores</h1>
          <p className="text-sm text-zinc-500">Gerencie os vendedores cadastrados no sistema.</p>
        </div>
      </div>

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
        onToggle={(item) => store.toggleVendedor(item.id, by)}
        onDelete={(item) => { if (confirm(`Excluir "${item.name}"?`)) store.deleteVendedor(item.id, by); }}
        entityLabel="Vendedor"
        searchValue={search}
        onSearch={setSearch}
      />

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
