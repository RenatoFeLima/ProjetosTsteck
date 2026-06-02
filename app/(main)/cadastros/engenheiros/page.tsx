"use client";

import { useMemo, useState } from "react";
import { GraduationCap } from "lucide-react";
import { EngenheiroFormDialog } from "@/features/master-data/components/engenheiro-form-dialog";
import { MasterDataTable } from "@/features/master-data/components/master-data-table";
import type { Engenheiro } from "@/features/master-data/domain/master-data-types";
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";
import { useCurrentUser } from "@/features/user/hooks/use-current-user";

export default function EngenheirosPage() {
  const store = useMasterDataStore();
  const { user } = useCurrentUser();
  const by = user?.name ?? "anônimo";

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Engenheiro | undefined>();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return store.engenheiros.filter(
      (e) => !q || e.name.toLowerCase().includes(q) || (e.email ?? "").toLowerCase().includes(q),
    );
  }, [store.engenheiros, search]);

  function handleSave(data: Partial<Engenheiro>) {
    if (editing) {
      store.updateEngenheiro(editing.id, data, by);
    } else {
      store.addEngenheiro({ name: data.name!, email: data.email, phone: data.phone, createdBy: by }, by);
    }
    setModalOpen(false);
    setEditing(undefined);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <GraduationCap size={24} className="text-brand" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Engenheiros</h1>
          <p className="text-sm text-zinc-500">Gerencie os engenheiros cadastrados no sistema.</p>
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
        onToggle={(item) => store.toggleEngenheiro(item.id, by)}
        onDelete={(item) => { if (confirm(`Excluir "${item.name}"?`)) store.deleteEngenheiro(item.id, by); }}
        entityLabel="Engenheiro"
        searchValue={search}
        onSearch={setSearch}
      />

      <EngenheiroFormDialog
        open={modalOpen}
        mode={editing ? "edit" : "create"}
        item={editing}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        onSave={handleSave}
      />
    </div>
  );
}
