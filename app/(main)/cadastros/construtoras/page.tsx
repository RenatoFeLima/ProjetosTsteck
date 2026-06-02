"use client";

import { useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { ConstrutoraFormDialog } from "@/features/master-data/components/construtora-form-dialog";
import { MasterDataTable } from "@/features/master-data/components/master-data-table";
import type { Construtora } from "@/features/master-data/domain/master-data-types";
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";
import { useCurrentUser } from "@/features/user/hooks/use-current-user";

export default function ConstrutorasPage() {
  const store = useMasterDataStore();
  const { user } = useCurrentUser();
  const by = user?.name ?? "anônimo";

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Construtora | undefined>();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return store.construtoras.filter((c) =>
      !q || c.name.toLowerCase().includes(q) || (c.cnpj ?? "").includes(q),
    );
  }, [store.construtoras, search]);

  function handleSave(data: Partial<Construtora>) {
    if (editing) {
      store.updateConstrutora(editing.id, data, by);
    } else {
      store.addConstrutora({ name: data.name!, cnpj: data.cnpj, phone: data.phone, email: data.email, notes: data.notes, createdBy: by }, by);
    }
    setModalOpen(false);
    setEditing(undefined);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <Building2 size={24} className="text-brand" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Construtoras</h1>
          <p className="text-sm text-zinc-500">Gerencie as construtoras cadastradas no sistema.</p>
        </div>
      </div>

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
        onToggle={(item) => store.toggleConstrutora(item.id, by)}
        onDelete={(item) => { if (confirm(`Excluir "${item.name}"?`)) store.deleteConstrutora(item.id, by); }}
        entityLabel="Construtora"
        searchValue={search}
        onSearch={setSearch}
      />

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
