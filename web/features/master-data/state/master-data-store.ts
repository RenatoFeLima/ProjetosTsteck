"use client";

import { nanoid } from "nanoid";
import { create, type StoreApi } from "zustand";
import { persist } from "zustand/middleware";
import {
  buildSeedConstrutoras,
  buildSeedEngenheiros,
  buildSeedEquipamentos,
  buildSeedObras,
  buildSeedTiposCabine,
  buildSeedVendedores,
} from "@/features/master-data/domain/master-data-seed";
import type {
  AuditEvent,
  Construtora,
  Engenheiro,
  Equipamento,
  Obra,
  TipoCabine,
  Vendedor,
} from "@/features/master-data/domain/master-data-types";

const NOW = () => new Date().toISOString();
const TODAY = () => new Date().toISOString().slice(0, 10);
const ID = () => nanoid(10);

// ─── State type ───────────────────────────────────────────────────────────────

export type MasterDataState = {
  // entities
  construtoras: Construtora[];
  obras: Obra[];
  equipamentos: Equipamento[];
  tiposCabine: TipoCabine[];
  vendedores: Vendedor[];
  engenheiros: Engenheiro[];
  auditLog: AuditEvent[];

  // ─── Construtoras ───────────────────────────────────────────────────
  getConstrutoras: () => Construtora[];
  getActiveContrutoraNames: () => string[];
  addConstrutora: (data: Omit<Construtora, "id" | "active" | "createdAt" | "updatedAt">, by: string) => Construtora;
  updateConstrutora: (id: string, data: Partial<Omit<Construtora, "id" | "createdAt" | "createdBy">>, by: string) => void;
  toggleConstrutora: (id: string, by: string) => void;
  deleteConstrutora: (id: string, by: string) => void;

  // ─── Obras ──────────────────────────────────────────────────────────
  getObras: () => Obra[];
  getActiveObraNames: (construtoraName?: string) => string[];
  addObra: (data: Omit<Obra, "id" | "active" | "createdAt" | "updatedAt">, by: string) => Obra;
  updateObra: (id: string, data: Partial<Omit<Obra, "id" | "createdAt" | "createdBy">>, by: string) => void;
  toggleObra: (id: string, by: string) => void;
  deleteObra: (id: string, by: string) => void;

  // ─── Equipamentos ───────────────────────────────────────────────────
  getEquipamentos: () => Equipamento[];
  getActiveEquipamentoCodes: () => string[];
  addEquipamento: (data: Omit<Equipamento, "id" | "active" | "createdAt" | "updatedAt">, by: string) => Equipamento;
  updateEquipamento: (id: string, data: Partial<Omit<Equipamento, "id" | "createdAt" | "createdBy">>, by: string) => void;
  toggleEquipamento: (id: string, by: string) => void;
  deleteEquipamento: (id: string, by: string) => void;

  // ─── TiposCabine ────────────────────────────────────────────────────
  getTiposCabine: () => TipoCabine[];
  getActiveTipoCabineNames: () => string[];
  addTipoCabine: (data: Omit<TipoCabine, "id" | "active" | "createdAt" | "updatedAt">, by: string) => TipoCabine;
  updateTipoCabine: (id: string, data: Partial<Omit<TipoCabine, "id" | "createdAt" | "createdBy">>, by: string) => void;
  toggleTipoCabine: (id: string, by: string) => void;
  deleteTipoCabine: (id: string, by: string) => void;

  // ─── Vendedores ─────────────────────────────────────────────────────
  getVendedores: () => Vendedor[];
  getActiveVendedorNames: () => string[];
  addVendedor: (data: Omit<Vendedor, "id" | "active" | "createdAt" | "updatedAt">, by: string) => Vendedor;
  updateVendedor: (id: string, data: Partial<Omit<Vendedor, "id" | "createdAt" | "createdBy">>, by: string) => void;
  toggleVendedor: (id: string, by: string) => void;
  deleteVendedor: (id: string, by: string) => void;

  // ─── Engenheiros ────────────────────────────────────────────────────
  getEngenheiros: () => Engenheiro[];
  getActiveEngenheiroNames: () => string[];
  addEngenheiro: (data: Omit<Engenheiro, "id" | "active" | "createdAt" | "updatedAt">, by: string) => Engenheiro;
  updateEngenheiro: (id: string, data: Partial<Omit<Engenheiro, "id" | "createdAt" | "createdBy">>, by: string) => void;
  toggleEngenheiro: (id: string, by: string) => void;
  deleteEngenheiro: (id: string, by: string) => void;

  // ─── Auditoria ──────────────────────────────────────────────────────
  getAuditLog: () => AuditEvent[];
};

// ─── Factory (for tests) ─────────────────────────────────────────────────────

export function createMasterDataStore(): StoreApi<MasterDataState> {
  return create<MasterDataState>()((set, get) => buildStore(set, get));
}

// ─── Shared builder ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildStore(set: any, get: () => MasterDataState): MasterDataState {
  function audit(
    entity: AuditEvent["entity"],
    entityId: string,
    entityName: string,
    action: AuditEvent["action"],
    performedBy: string,
    previousValue?: string,
    newValue?: string,
  ) {
    const event: AuditEvent = {
      id: ID(),
      entity,
      entityId,
      entityName,
      action,
      performedBy,
      performedAt: NOW(),
      previousValue,
      newValue,
    };
    set((s: MasterDataState) => ({ auditLog: [event, ...s.auditLog] }));
  }

  // Generic CRUD helpers
  type EntityKey = keyof Pick<
    MasterDataState,
    "construtoras" | "obras" | "equipamentos" | "tiposCabine" | "vendedores" | "engenheiros"
  >;

  function toggleEntity<T extends { id: string; active: boolean; updatedAt: string }>(
    key: EntityKey,
    entityType: AuditEvent["entity"],
    id: string,
    by: string,
  ) {
    const list = (get()[key] as unknown as T[]);
    const found = list.find((e) => e.id === id);
    if (!found) return;
    const nextActive = !found.active;
    set((s: MasterDataState) => ({
      [key]: (s[key] as unknown as T[]).map((e) =>
        e.id === id ? { ...e, active: nextActive, updatedAt: TODAY() } : e,
      ),
    }));
    const name = (found as unknown as Record<string, string>).name ?? (found as unknown as Record<string, string>).code ?? id;
    audit(entityType, id, name, nextActive ? "activated" : "deactivated", by);
  }

  function deleteEntity<T extends { id: string }>(
    key: EntityKey,
    entityType: AuditEvent["entity"],
    id: string,
    by: string,
  ) {
    const list = (get()[key] as unknown as T[]);
    const found = list.find((e) => e.id === id);
    if (!found) return;
    set((s: MasterDataState) => ({
      [key]: (s[key] as unknown as T[]).filter((e) => e.id !== id),
    }));
    const name = (found as unknown as Record<string, string>).name ?? (found as unknown as Record<string, string>).code ?? id;
    audit(entityType, id, name, "deleted", by);
  }

  return {
    construtoras: buildSeedConstrutoras(),
    obras: buildSeedObras(),
    equipamentos: buildSeedEquipamentos(),
    tiposCabine: buildSeedTiposCabine(),
    vendedores: buildSeedVendedores(),
    engenheiros: buildSeedEngenheiros(),
    auditLog: [],

    // ─── Construtoras ─────────────────────────────────────────────────
    getConstrutoras: () => get().construtoras,
    getActiveContrutoraNames: () =>
      get().construtoras.filter((c) => c.active).map((c) => c.name),

    addConstrutora: (data, by) => {
      const entity: Construtora = {
        ...data,
        id: ID(),
        active: true,
        createdAt: TODAY(),
        updatedAt: TODAY(),
      };
      set((s: MasterDataState) => ({ construtoras: [...s.construtoras, entity] }));
      audit("construtora", entity.id, entity.name, "created", by);
      return entity;
    },
    updateConstrutora: (id, data, by) => {
      const prev = get().construtoras.find((c) => c.id === id);
      if (!prev) return;
      set((s: MasterDataState) => ({
        construtoras: s.construtoras.map((c) =>
          c.id === id ? { ...c, ...data, updatedAt: TODAY() } : c,
        ),
      }));
      audit("construtora", id, data.name ?? prev.name, "updated", by, prev.name, data.name);
    },
    toggleConstrutora: (id, by) => toggleEntity("construtoras", "construtora", id, by),
    deleteConstrutora: (id, by) => deleteEntity("construtoras", "construtora", id, by),

    // ─── Obras ────────────────────────────────────────────────────────
    getObras: () => get().obras,
    getActiveObraNames: (construtoraName) => {
      const list = get().obras.filter((o) => o.active);
      if (construtoraName) return list.filter((o) => o.construtoraName === construtoraName).map((o) => o.name);
      return list.map((o) => o.name);
    },

    addObra: (data, by) => {
      const entity: Obra = {
        ...data,
        id: ID(),
        active: true,
        createdAt: TODAY(),
        updatedAt: TODAY(),
      };
      set((s: MasterDataState) => ({ obras: [...s.obras, entity] }));
      audit("obra", entity.id, entity.name, "created", by);
      return entity;
    },
    updateObra: (id, data, by) => {
      const prev = get().obras.find((o) => o.id === id);
      if (!prev) return;
      set((s: MasterDataState) => ({
        obras: s.obras.map((o) => (o.id === id ? { ...o, ...data, updatedAt: TODAY() } : o)),
      }));
      audit("obra", id, data.name ?? prev.name, "updated", by, prev.name, data.name);
    },
    toggleObra: (id, by) => toggleEntity("obras", "obra", id, by),
    deleteObra: (id, by) => deleteEntity("obras", "obra", id, by),

    // ─── Equipamentos ─────────────────────────────────────────────────
    getEquipamentos: () => get().equipamentos,
    getActiveEquipamentoCodes: () =>
      get().equipamentos.filter((e) => e.active).map((e) => e.code),

    addEquipamento: (data, by) => {
      const entity: Equipamento = {
        ...data,
        id: ID(),
        active: true,
        createdAt: TODAY(),
        updatedAt: TODAY(),
      };
      set((s: MasterDataState) => ({ equipamentos: [...s.equipamentos, entity] }));
      audit("equipamento", entity.id, entity.code, "created", by);
      return entity;
    },
    updateEquipamento: (id, data, by) => {
      const prev = get().equipamentos.find((e) => e.id === id);
      if (!prev) return;
      set((s: MasterDataState) => ({
        equipamentos: s.equipamentos.map((e) =>
          e.id === id ? { ...e, ...data, updatedAt: TODAY() } : e,
        ),
      }));
      audit("equipamento", id, data.code ?? prev.code, "updated", by, prev.code, data.code);
    },
    toggleEquipamento: (id, by) => toggleEntity("equipamentos", "equipamento", id, by),
    deleteEquipamento: (id, by) => deleteEntity("equipamentos", "equipamento", id, by),

    // ─── TiposCabine ──────────────────────────────────────────────────
    getTiposCabine: () => get().tiposCabine,
    getActiveTipoCabineNames: () =>
      get().tiposCabine.filter((t) => t.active).map((t) => t.name),

    addTipoCabine: (data, by) => {
      const entity: TipoCabine = {
        ...data,
        id: ID(),
        active: true,
        createdAt: TODAY(),
        updatedAt: TODAY(),
      };
      set((s: MasterDataState) => ({ tiposCabine: [...s.tiposCabine, entity] }));
      audit("tipoCabine", entity.id, entity.name, "created", by);
      return entity;
    },
    updateTipoCabine: (id, data, by) => {
      const prev = get().tiposCabine.find((t) => t.id === id);
      if (!prev) return;
      set((s: MasterDataState) => ({
        tiposCabine: s.tiposCabine.map((t) =>
          t.id === id ? { ...t, ...data, updatedAt: TODAY() } : t,
        ),
      }));
      audit("tipoCabine", id, data.name ?? prev.name, "updated", by, prev.name, data.name);
    },
    toggleTipoCabine: (id, by) => toggleEntity("tiposCabine", "tipoCabine", id, by),
    deleteTipoCabine: (id, by) => deleteEntity("tiposCabine", "tipoCabine", id, by),

    // ─── Vendedores ───────────────────────────────────────────────────
    getVendedores: () => get().vendedores,
    getActiveVendedorNames: () =>
      get().vendedores.filter((v) => v.active).map((v) => v.name),

    addVendedor: (data, by) => {
      const entity: Vendedor = {
        ...data,
        id: ID(),
        active: true,
        createdAt: TODAY(),
        updatedAt: TODAY(),
      };
      set((s: MasterDataState) => ({ vendedores: [...s.vendedores, entity] }));
      audit("vendedor", entity.id, entity.name, "created", by);
      return entity;
    },
    updateVendedor: (id, data, by) => {
      const prev = get().vendedores.find((v) => v.id === id);
      if (!prev) return;
      set((s: MasterDataState) => ({
        vendedores: s.vendedores.map((v) =>
          v.id === id ? { ...v, ...data, updatedAt: TODAY() } : v,
        ),
      }));
      audit("vendedor", id, data.name ?? prev.name, "updated", by, prev.name, data.name);
    },
    toggleVendedor: (id, by) => toggleEntity("vendedores", "vendedor", id, by),
    deleteVendedor: (id, by) => deleteEntity("vendedores", "vendedor", id, by),

    // ─── Engenheiros ──────────────────────────────────────────────────
    getEngenheiros: () => get().engenheiros,
    getActiveEngenheiroNames: () =>
      get().engenheiros.filter((e) => e.active).map((e) => e.name),

    addEngenheiro: (data, by) => {
      const entity: Engenheiro = {
        ...data,
        id: ID(),
        active: true,
        createdAt: TODAY(),
        updatedAt: TODAY(),
      };
      set((s: MasterDataState) => ({ engenheiros: [...s.engenheiros, entity] }));
      audit("engenheiro", entity.id, entity.name, "created", by);
      return entity;
    },
    updateEngenheiro: (id, data, by) => {
      const prev = get().engenheiros.find((e) => e.id === id);
      if (!prev) return;
      set((s: MasterDataState) => ({
        engenheiros: s.engenheiros.map((e) =>
          e.id === id ? { ...e, ...data, updatedAt: TODAY() } : e,
        ),
      }));
      audit("engenheiro", id, data.name ?? prev.name, "updated", by, prev.name, data.name);
    },
    toggleEngenheiro: (id, by) => toggleEntity("engenheiros", "engenheiro", id, by),
    deleteEngenheiro: (id, by) => deleteEntity("engenheiros", "engenheiro", id, by),

    // ─── Auditoria ────────────────────────────────────────────────────
    getAuditLog: () => get().auditLog,
  };
}

// ─── Singleton with persist ───────────────────────────────────────────────────

export const useMasterDataStore = create<MasterDataState>()(
  persist(
    (set, get) => buildStore(set, get),
    {
      name: "tsteck:master-data",
      partialize: (state) => ({
        construtoras: state.construtoras,
        obras: state.obras,
        equipamentos: state.equipamentos,
        tiposCabine: state.tiposCabine,
        vendedores: state.vendedores,
        engenheiros: state.engenheiros,
        auditLog: state.auditLog,
      }),
    },
  ),
);
