"use client";

import { useMemo, useState } from "react";
import { HardHat, Layers } from "lucide-react";
import { MasterDataTable } from "@/features/master-data/components/master-data-table";
import { MasterDataStates } from "@/features/master-data/components/master-data-states";
import { ObraFormDialog } from "@/features/master-data/components/obra-form-dialog";
import { WorkUnitsManagerDialog } from "@/features/master-data/components/work-units-manager-dialog";
import { useMasterDataEntity } from "@/features/master-data/hooks/use-master-data-entity";
import type { Construtora, Obra, UnidadeObra } from "@/features/master-data/domain/master-data-types";

// A obra é serializada pela API com `construtoraName` (nome) além de `constructorId`.
type ObraRow = Obra & { constructorId?: string };
type UnitRow = UnidadeObra & { workId: string };

export default function ObrasPage() {
  const obrasApi = useMasterDataEntity<ObraRow>("obras", { includeInactive: true });
  const { items: construtoras } = useMasterDataEntity<Construtora & { id: string }>("construtoras");
  // Unidades de todas as obras — usadas para a contagem na linha principal e
  // para a lista exibida ao expandir a obra.
  const unitsApi = useMasterDataEntity<UnitRow>("unidadesObra", { includeInactive: true });

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ObraRow | undefined>();
  const [unitsFor, setUnitsFor] = useState<ObraRow | undefined>();

  const construtoraNames = useMemo(() => construtoras.map((c) => c.name), [construtoras]);

  // workId -> unidades (apenas ATIVAS na visualização inline, para não poluir).
  const unitsByWork = useMemo(() => {
    const map = new Map<string, UnitRow[]>();
    for (const unit of unitsApi.items) {
      if (!unit.active) continue;
      const list = map.get(unit.workId) ?? [];
      list.push(unit);
      map.set(unit.workId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
    }
    return map;
  }, [unitsApi.items]);

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
            {
              key: "unidades",
              label: "Unidades",
              render: (item) => {
                const total = unitsByWork.get(item.id)?.length ?? 0;
                return (
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {total} unidade{total !== 1 ? "s" : ""}
                  </span>
                );
              },
            },
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
          expandLabel={(item) => `unidades de ${item.name}`}
          renderExpanded={(item) => {
            const units = unitsByWork.get(item.id) ?? [];
            if (units.length === 0) {
              return (
                <p className="py-1 text-xs text-zinc-400">
                  Nenhuma unidade ativa cadastrada para esta obra.
                </p>
              );
            }
            return (
              <ul className="flex flex-col divide-y divide-line/60">
                {units.map((unit) => {
                  const count = unit.projectsCount ?? 0;
                  return (
                    <li key={unit.id} className="flex items-center justify-between gap-4 py-1.5">
                      <span className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                        {unit.name}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-500 dark:text-muted">
                        {count} projeto{count !== 1 ? "s" : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            );
          }}
          extraActions={(item) => (
            <button
              type="button"
              title="Gerenciar unidades da obra"
              aria-label={`Gerenciar unidades da obra ${item.name}`}
              onClick={() => setUnitsFor(item)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-foreground"
            >
              <Layers size={14} />
            </button>
          )}
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

      <WorkUnitsManagerDialog
        open={Boolean(unitsFor)}
        workId={unitsFor?.id ?? ""}
        obraName={unitsFor?.name ?? ""}
        onClose={() => {
          setUnitsFor(undefined);
          // Ressincroniza contagens/lista expansível após criar/editar/inativar.
          void unitsApi.reload();
        }}
      />
    </div>
  );
}
