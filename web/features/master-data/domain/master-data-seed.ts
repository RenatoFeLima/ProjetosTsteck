// ─── Master-data seed ─────────────────────────────────────────────────────────
// Usa os arrays derivados do project-seed para gerar os registros iniciais do
// cadastro de dados mestres. Cada entidade já recebe um ID estável (prefixo
// "md-") para que os snapshots sejam reproduzíveis entre runs.

import {
  PRESET_CONSTRUTORAS,
  PRESET_EQUIPAMENTOS,
  PRESET_OBRAS,
  PRESET_OBRAS_BY_CONSTRUTORA,
  PRESET_VENDEDORES,
} from "@/features/projects/domain/project-directory";
import { buildSeedProjects } from "@/features/projects/domain/project-seed";
import type {
  Construtora,
  Engenheiro,
  Equipamento,
  Obra,
  TipoCabine,
  Vendedor,
} from "./master-data-types";

const TODAY = "2026-01-01";
const SYSTEM_USER = "sistema";

function mkId(prefix: string, index: number) {
  return `${prefix}-${String(index + 1).padStart(3, "0")}`;
}

// ─── Construtoras ─────────────────────────────────────────────────────────────
export function buildSeedConstrutoras(): Construtora[] {
  return PRESET_CONSTRUTORAS.map((name, i) => ({
    id: mkId("con", i),
    name,
    active: true,
    createdAt: TODAY,
    updatedAt: TODAY,
    createdBy: SYSTEM_USER,
  }));
}

// ─── Obras ────────────────────────────────────────────────────────────────────
export function buildSeedObras(): Obra[] {
  const result: Obra[] = [];
  let index = 0;
  for (const construtoraName of PRESET_CONSTRUTORAS) {
    const obras = PRESET_OBRAS_BY_CONSTRUTORA[construtoraName] ?? [];
    for (const name of obras) {
      result.push({
        id: mkId("obr", index++),
        construtoraName,
        name,
        active: true,
        createdAt: TODAY,
        updatedAt: TODAY,
        createdBy: SYSTEM_USER,
      });
    }
  }
  // Obras sem construtora correspondente (segurança extra)
  for (const name of PRESET_OBRAS) {
    if (!result.find((o) => o.name === name)) {
      result.push({
        id: mkId("obr", index++),
        construtoraName: "",
        name,
        active: true,
        createdAt: TODAY,
        updatedAt: TODAY,
        createdBy: SYSTEM_USER,
      });
    }
  }
  return result;
}

// ─── Equipamentos ─────────────────────────────────────────────────────────────
export function buildSeedEquipamentos(): Equipamento[] {
  return PRESET_EQUIPAMENTOS.map((code, i) => ({
    id: mkId("eqp", i),
    code,
    active: true,
    createdAt: TODAY,
    updatedAt: TODAY,
    createdBy: SYSTEM_USER,
  }));
}

// ─── Tipos de cabine ──────────────────────────────────────────────────────────
const UNIQUE_TIPOS_CABINE = Array.from(
  new Set(
    buildSeedProjects()
      .map((p) => p.tipo_cabine?.trim())
      .filter(Boolean) as string[],
  ),
).sort((a, b) => a.localeCompare(b, "pt-BR"));

export function buildSeedTiposCabine(): TipoCabine[] {
  return UNIQUE_TIPOS_CABINE.map((name, i) => ({
    id: mkId("tip", i),
    name,
    active: true,
    createdAt: TODAY,
    updatedAt: TODAY,
    createdBy: SYSTEM_USER,
  }));
}

// ─── Vendedores ───────────────────────────────────────────────────────────────
export function buildSeedVendedores(): Vendedor[] {
  return PRESET_VENDEDORES.map((name, i) => ({
    id: mkId("ven", i),
    name,
    active: true,
    createdAt: TODAY,
    updatedAt: TODAY,
    createdBy: SYSTEM_USER,
  }));
}

// ─── Engenheiros ──────────────────────────────────────────────────────────────
const ENGENHEIRO_PLACEHOLDERS = new Set(["ENG. XXX", "ENG XXX", ""]);

const UNIQUE_ENGENHEIROS = Array.from(
  new Set(
    buildSeedProjects()
      .map((p) => p.engenheiro_nome?.trim())
      .filter((n): n is string => !!n && !ENGENHEIRO_PLACEHOLDERS.has(n)),
  ),
).sort((a, b) => a.localeCompare(b, "pt-BR"));

export function buildSeedEngenheiros(): Engenheiro[] {
  return UNIQUE_ENGENHEIROS.map((name, i) => ({
    id: mkId("eng", i),
    name,
    active: true,
    createdAt: TODAY,
    updatedAt: TODAY,
    createdBy: SYSTEM_USER,
  }));
}
