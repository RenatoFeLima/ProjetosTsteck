# Fase 2 — Master Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Pré-requisito:** Fase 1 completa e todos os testes passando.

**Goal:** Criar a camada de dados mestres completa — tipos, seed com IDs determinísticos, Zustand store com persist, e 6 telas CRUD totalmente funcionais — sem tocar nos tipos de Project.

**Architecture:** `features/master-data/` contém domain, state e components. Store usa Zustand `persist` com key `"tsteck:master-data"`. Seed inicializa no primeiro load (se vazio). CRUD genérico via `MasterDataPage` + `MasterDataTable` + `MasterDataFormDialog`, com formulários específicos por entidade como `children`.

**Tech Stack:** Zustand 5 (persist middleware), nanoid, date-fns, Vitest + Testing Library, Tailwind CSS v4.

---

## File Structure

| Operação | Arquivo |
|---|---|
| CREATE | `features/master-data/domain/master-data-types.ts` |
| CREATE | `features/master-data/domain/master-data-seed.ts` |
| CREATE | `features/master-data/state/master-data-store.ts` |
| CREATE | `features/master-data/components/master-data-table.tsx` |
| CREATE | `features/master-data/components/master-data-form-dialog.tsx` |
| CREATE | `features/master-data/components/master-data-page.tsx` |
| CREATE | `features/master-data/components/construtora-form.tsx` |
| CREATE | `features/master-data/components/obra-form.tsx` |
| CREATE | `features/master-data/components/equipamento-form.tsx` |
| CREATE | `features/master-data/components/tipo-cabine-form.tsx` |
| CREATE | `features/master-data/components/vendedor-form.tsx` |
| CREATE | `features/master-data/components/engenheiro-form.tsx` |
| REPLACE | `app/(main)/master/construtoras/page.tsx` |
| REPLACE | `app/(main)/master/obras/page.tsx` |
| REPLACE | `app/(main)/master/equipamentos/page.tsx` |
| REPLACE | `app/(main)/master/tipos-cabine/page.tsx` |
| REPLACE | `app/(main)/master/vendedores/page.tsx` |
| REPLACE | `app/(main)/master/engenheiros/page.tsx` |
| REPLACE | `app/(main)/master/auditoria/page.tsx` |
| CREATE | `tests/master-data/master-data-store.test.ts` |
| CREATE | `tests/master-data/construtoras-page.test.tsx` |

---

### Task 1: Instalar nanoid + definir tipos

**Files:**
- Install: `nanoid`
- Create: `features/master-data/domain/master-data-types.ts`

- [ ] **Step 1: Instalar nanoid**

```bash
cd web
npm install nanoid
```

Expected: `added 1 package`, sem erros.

- [ ] **Step 2: Criar master-data-types.ts**

Criar `web/features/master-data/domain/master-data-types.ts`:

```typescript
// ─── Base ────────────────────────────────────────────────────────────────────

export type MasterEntity = {
  id: string;          // nanoid(8) para novos; formato "x-NNN" para seed
  active: boolean;
  createdAt: string;   // ISO date "yyyy-MM-dd"
  updatedAt: string;
  createdBy: string;
};

// ─── Entidades ───────────────────────────────────────────────────────────────

export type Construtora = MasterEntity & {
  name: string;        // obrigatório, único (normalizado para dedup)
  cnpj?: string;
  phone?: string;
  email?: string;
  notes?: string;
};

export type Obra = MasterEntity & {
  construtoraId: string;   // obrigatório
  name: string;            // obrigatório, único por construtoraId
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  notes?: string;
};

export type Equipamento = MasterEntity & {
  code: string;         // obrigatório, único, sempre uppercase
  description: string;  // obrigatório
  family?: string;
  capacity?: string;
  dimension?: string;
  notes?: string;
};

export type TipoCabine = MasterEntity & {
  name: string;         // obrigatório, único
  description?: string;
};

export type Vendedor = MasterEntity & {
  name: string;         // obrigatório, único
  email?: string;
  phone?: string;
};

export type Engenheiro = MasterEntity & {
  name: string;   // obrigatório — sempre prefixado "Engº"
  phone?: string;
  email?: string;
};

// ─── Auditoria ───────────────────────────────────────────────────────────────

export type AuditEntityType =
  | "construtora"
  | "obra"
  | "equipamento"
  | "tipoCabine"
  | "vendedor"
  | "engenheiro";

export type AuditAction = "created" | "updated" | "activated" | "deactivated" | "deleted";

export type AuditEvent = {
  id: string;
  entity: AuditEntityType;
  entityId: string;
  entityName: string;
  action: AuditAction;
  performedBy: string;
  performedAt: string;        // ISO datetime
  previousValue?: string;
  newValue?: string;
};

// ─── Input helpers ───────────────────────────────────────────────────────────

export type EntityInput<T extends MasterEntity> = Omit<T, keyof MasterEntity>;
```

- [ ] **Step 3: Commit**

```bash
git add features/master-data/domain/master-data-types.ts
git commit -m "feat: add master-data-types.ts"
```

---

### Task 2: Seed com IDs determinísticos

**Files:**
- Create: `features/master-data/domain/master-data-seed.ts`
- Create: `scripts/extract-seed-ids.mjs` (helper de uma vez)

O objetivo é gerar um mapa `SEED_IDS` onde cada nome de entidade do `project-seed.ts` tem um ID fixo. A estratégia: usar o índice na lista ordenada para gerar IDs determinísticos.

- [ ] **Step 1: Criar script de extração**

Criar `web/scripts/extract-seed-ids.mjs`:

```javascript
// Script auxiliar para extrair nomes únicos do project-seed.ts
// Executar: node scripts/extract-seed-ids.mjs
// Saída: lista de nomes para usar no master-data-seed.ts

import { buildSeedProjects } from "../features/projects/domain/project-seed.js";

// Nota: requer que o tsconfig permita importar .ts como .js
// Alternativa: copiar manualmente os valores do output de console.log abaixo

const projects = buildSeedProjects();

function unique(values) {
  return [...new Set(values.map((v) => v?.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" })
  );
}

const construtoras = unique(projects.map((p) => p.construtora));
const obrasPorConstrutora = {};
for (const c of construtoras) {
  obrasPorConstrutora[c] = unique(
    projects.filter((p) => p.construtora === c).map((p) => p.obra)
  );
}
const vendedores = unique(projects.map((p) => p.vendedor));
const equipamentos = unique(projects.map((p) => p.equipamento));
const tiposCabine = unique(projects.map((p) => p.tipo_cabine).filter((t) => t && t.trim()));
const engenheiros = unique(projects.map((p) => p.engenheiro_nome).filter((e) => e && e.trim() && e !== "ENG. XXX"));

console.log("=== CONSTRUTORAS ===");
construtoras.forEach((name, i) => {
  const id = `c-${String(i + 1).padStart(3, "0")}`;
  console.log(`  "${name}": "${id}",`);
});

console.log("\n=== OBRAS ===");
let obraIdx = 1;
for (const [c, obras] of Object.entries(obrasPorConstrutora)) {
  console.log(`  // ${c}`);
  for (const obra of obras) {
    const id = `o-${String(obraIdx++).padStart(3, "0")}`;
    console.log(`  "${obra}": "${id}",`);
  }
}

console.log("\n=== VENDEDORES ===");
vendedores.forEach((name, i) => {
  const id = `v-${String(i + 1).padStart(3, "0")}`;
  console.log(`  "${name}": "${id}",`);
});

console.log("\n=== EQUIPAMENTOS ===");
equipamentos.forEach((name, i) => {
  const id = `e-${String(i + 1).padStart(3, "0")}`;
  console.log(`  "${name}": "${id}",`);
});

console.log("\n=== TIPOS CABINE ===");
tiposCabine.forEach((name, i) => {
  const id = `tc-${String(i + 1).padStart(3, "0")}`;
  console.log(`  "${name}": "${id}",`);
});

console.log("\n=== ENGENHEIROS ===");
engenheiros.forEach((name, i) => {
  const id = `eng-${String(i + 1).padStart(3, "0")}`;
  console.log(`  "${name}": "${id}",`);
});
```

**Nota:** Este script é um auxílio de desenvolvimento. Como o projeto usa TypeScript compilado, a forma mais simples de rodar é via `tsx`:

```bash
npm install -D tsx
npx tsx scripts/extract-seed-ids.mjs
```

Copiar a saída para usar no próximo passo.

- [ ] **Step 2: Criar master-data-seed.ts com os IDs extraídos**

Criar `web/features/master-data/domain/master-data-seed.ts`. Usar os IDs extraídos pelo script:

```typescript
import { formatISO } from "date-fns";
import type { Construtora, Obra, Equipamento, TipoCabine, Vendedor, Engenheiro } from "./master-data-types";

const SEED_DATE = "2025-01-01";
const SEED_BY = "Sistema";

// ─── IDs determinísticos para uso no project-seed.ts (Fase 3) ───────────────
// Gerados via scripts/extract-seed-ids.mjs

export const SEED_IDS = {
  construtoras: {} as Record<string, string>,
  obras: {} as Record<string, string>,
  vendedores: {} as Record<string, string>,
  equipamentos: {} as Record<string, string>,
  tiposCabine: {} as Record<string, string>,
  engenheiros: {} as Record<string, string>,
};

// ─── Construtoras ────────────────────────────────────────────────────────────
// Preencher com os valores extraídos pelo script. Exemplo:
// { id: "c-001", name: "18 DO FORTE", ... }
// Execute: npx tsx scripts/extract-seed-ids.mjs para obter a lista completa.

export const SEED_CONSTRUTORAS: Construtora[] = [
  // Substituir pelos dados reais extraídos do script
  // Exemplo de entrada:
  // { id: "c-001", name: "18 DO FORTE", active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE, createdBy: SEED_BY },
];

// ─── Obras ───────────────────────────────────────────────────────────────────

export const SEED_OBRAS: Obra[] = [
  // { id: "o-001", construtoraId: "c-001", name: "PANAMERA", active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE, createdBy: SEED_BY },
];

// ─── Equipamentos ────────────────────────────────────────────────────────────

export const SEED_EQUIPAMENTOS: Equipamento[] = [
  // { id: "e-001", code: "EK-15/26", description: "EK-15/26", active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE, createdBy: SEED_BY },
];

// ─── Tipos de Cabine ─────────────────────────────────────────────────────────

export const SEED_TIPOS_CABINE: TipoCabine[] = [
  // { id: "tc-001", name: "SIMPLES", active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE, createdBy: SEED_BY },
];

// ─── Vendedores ──────────────────────────────────────────────────────────────

export const SEED_VENDEDORES: Vendedor[] = [
  // { id: "v-001", name: "CARLOS R.", active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE, createdBy: SEED_BY },
];

// ─── Engenheiros ─────────────────────────────────────────────────────────────

export const SEED_ENGENHEIROS: Engenheiro[] = [
  // { id: "eng-001", name: "Engº Alex Araujo", active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE, createdBy: SEED_BY },
];
```

**IMPORTANTE:** Substituir os comentários com os dados reais extraídos pelo script. Cada `SEED_CONSTRUTORAS` entry deve ter o `id` correspondente ao mapa `SEED_IDS.construtoras`. Preencher `SEED_IDS` com todos os mapeamentos nome→id para que o `project-seed.ts` possa usá-los na Fase 3.

- [ ] **Step 3: Preencher os dados reais**

Executar o script:
```bash
npx tsx scripts/extract-seed-ids.mjs
```

Para cada seção do output, preencher os arrays no `master-data-seed.ts`. O padrão para cada entrada é:

Construtora:
```typescript
{ id: "c-001", name: "18 DO FORTE", active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE, createdBy: SEED_BY }
```

Obra (verificar o `construtoraId` correto pelo nome da construtora):
```typescript
{ id: "o-001", construtoraId: "c-001", name: "PANAMERA", active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE, createdBy: SEED_BY }
```

Equipamento:
```typescript
{ id: "e-001", code: "EK-15/26", description: "EK-15/26", active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE, createdBy: SEED_BY }
```

TipoCabine:
```typescript
{ id: "tc-001", name: "SIMPLES", active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE, createdBy: SEED_BY }
```

Vendedor:
```typescript
{ id: "v-001", name: "CARLOS R.", active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE, createdBy: SEED_BY }
```

Engenheiro (normalizar nome para "Engº Primeiro Último" removendo prefixos "ENG.", "ENG", "ENG."):
```typescript
{ id: "eng-001", name: "Engº Alex Araujo", phone: "", active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE, createdBy: SEED_BY }
```

- [ ] **Step 4: Commit**

```bash
git add features/master-data/domain/master-data-seed.ts scripts/extract-seed-ids.mjs
git commit -m "feat: add master-data-seed.ts with deterministic seed IDs"
```

---

### Task 3: `master-data-store.ts` + testes

**Files:**
- Create: `features/master-data/state/master-data-store.ts`
- Create: `tests/master-data/master-data-store.test.ts`

- [ ] **Step 1: Escrever os testes que devem falhar**

Criar `web/tests/master-data/master-data-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createMasterDataStore } from "@/features/master-data/state/master-data-store";

// Usar factory para isolar cada teste (não compartilhar estado global)
function makeStore() {
  return createMasterDataStore();
}

describe("master-data-store — construtoras", () => {
  it("loads seed construtoras on first init", () => {
    const store = makeStore();
    expect(store.getState().construtoras.length).toBeGreaterThan(0);
  });

  it("addConstrutora inserts entity with generated id and audit entry", () => {
    const store = makeStore();
    const before = store.getState().construtoras.length;

    store.getState().addConstrutora({ name: "NOVA CONSTRUTORA TEST" }, "Test User");

    const after = store.getState().construtoras;
    expect(after.length).toBe(before + 1);

    const added = after.find((c) => c.name === "NOVA CONSTRUTORA TEST");
    expect(added).toBeDefined();
    expect(added!.active).toBe(true);
    expect(added!.createdBy).toBe("Test User");
    expect(added!.id).toMatch(/^[A-Za-z0-9_-]{8}$/);

    const audit = store.getState().auditLog;
    const entry = audit[audit.length - 1];
    expect(entry.action).toBe("created");
    expect(entry.entity).toBe("construtora");
    expect(entry.entityName).toBe("NOVA CONSTRUTORA TEST");
    expect(entry.performedBy).toBe("Test User");
  });

  it("addConstrutora rejects duplicate name (case insensitive)", () => {
    const store = makeStore();
    store.getState().addConstrutora({ name: "DUPLICADA" }, "u");
    expect(() =>
      store.getState().addConstrutora({ name: "duplicada" }, "u")
    ).toThrow(/duplicada/i);
  });

  it("updateConstrutora updates fields and records audit entry", () => {
    const store = makeStore();
    store.getState().addConstrutora({ name: "PARA EDITAR" }, "u");
    const id = store.getState().construtoras.find((c) => c.name === "PARA EDITAR")!.id;

    store.getState().updateConstrutora(id, { name: "EDITADA" }, "editor");

    const updated = store.getState().construtoras.find((c) => c.id === id);
    expect(updated!.name).toBe("EDITADA");

    const entry = store.getState().auditLog.find(
      (a) => a.entityId === id && a.action === "updated"
    );
    expect(entry).toBeDefined();
    expect(entry!.performedBy).toBe("editor");
  });

  it("toggleConstrutora deactivates an active entity", () => {
    const store = makeStore();
    store.getState().addConstrutora({ name: "TOGGLE TEST" }, "u");
    const id = store.getState().construtoras.find((c) => c.name === "TOGGLE TEST")!.id;

    store.getState().toggleConstrutora(id, "admin");

    expect(store.getState().construtoras.find((c) => c.id === id)!.active).toBe(false);
    const entry = store.getState().auditLog.find(
      (a) => a.entityId === id && a.action === "deactivated"
    );
    expect(entry).toBeDefined();
  });

  it("deleteConstrutora succeeds when no obras or projects reference it", () => {
    const store = makeStore();
    store.getState().addConstrutora({ name: "PARA DELETAR" }, "u");
    const id = store.getState().construtoras.find((c) => c.name === "PARA DELETAR")!.id;

    store.getState().deleteConstrutora(id, "admin");

    expect(store.getState().construtoras.find((c) => c.id === id)).toBeUndefined();
  });

  it("deleteConstrutora throws when obra references it", () => {
    const store = makeStore();
    store.getState().addConstrutora({ name: "COM OBRA" }, "u");
    const cId = store.getState().construtoras.find((c) => c.name === "COM OBRA")!.id;
    store.getState().addObra({ construtoraId: cId, name: "OBRA VINCULADA" }, "u");

    expect(() => store.getState().deleteConstrutora(cId, "admin")).toThrow(/obra/i);
  });
});

describe("master-data-store — activeSelectors", () => {
  it("activeConstrutoras returns only active entities", () => {
    const store = makeStore();
    store.getState().addConstrutora({ name: "ATIVA" }, "u");
    store.getState().addConstrutora({ name: "INATIVA" }, "u");
    const id = store.getState().construtoras.find((c) => c.name === "INATIVA")!.id;
    store.getState().toggleConstrutora(id, "u");

    const active = store.getState().activeConstrutoras();
    expect(active.some((c) => c.name === "ATIVA")).toBe(true);
    expect(active.some((c) => c.name === "INATIVA")).toBe(false);
  });

  it("activeObras filters by construtoraId when provided", () => {
    const store = makeStore();
    store.getState().addConstrutora({ name: "C-A" }, "u");
    store.getState().addConstrutora({ name: "C-B" }, "u");
    const cAId = store.getState().construtoras.find((c) => c.name === "C-A")!.id;
    const cBId = store.getState().construtoras.find((c) => c.name === "C-B")!.id;

    store.getState().addObra({ construtoraId: cAId, name: "OBRA DE A" }, "u");
    store.getState().addObra({ construtoraId: cBId, name: "OBRA DE B" }, "u");

    const obrasA = store.getState().activeObras(cAId);
    expect(obrasA.every((o) => o.construtoraId === cAId)).toBe(true);
    expect(obrasA.length).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

```bash
npm test -- tests/master-data/master-data-store.test.ts
```

Expected: `FAIL` com "Cannot find module".

- [ ] **Step 3: Criar master-data-store.ts**

Criar `web/features/master-data/state/master-data-store.ts`:

```typescript
"use client";

import { createStore } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import { formatISO } from "date-fns";
import type {
  Construtora,
  Obra,
  Equipamento,
  TipoCabine,
  Vendedor,
  Engenheiro,
  AuditEvent,
  AuditEntityType,
  AuditAction,
  EntityInput,
  MasterEntity,
} from "../domain/master-data-types";
import {
  SEED_CONSTRUTORAS,
  SEED_OBRAS,
  SEED_EQUIPAMENTOS,
  SEED_TIPOS_CABINE,
  SEED_VENDEDORES,
  SEED_ENGENHEIROS,
} from "../domain/master-data-seed";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now(): string {
  return formatISO(new Date());
}

function today(): string {
  return formatISO(new Date(), { representation: "date" });
}

function normalize(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildBase(createdBy: string): MasterEntity {
  const d = today();
  return { id: nanoid(8), active: true, createdAt: d, updatedAt: d, createdBy };
}

function addAudit(
  log: AuditEvent[],
  entity: AuditEntityType,
  entityId: string,
  entityName: string,
  action: AuditAction,
  performedBy: string,
  previousValue?: string,
  newValue?: string
): AuditEvent[] {
  return [
    ...log,
    {
      id: nanoid(8),
      entity,
      entityId,
      entityName,
      action,
      performedBy,
      performedAt: now(),
      previousValue,
      newValue,
    },
  ];
}

// ─── Store type ───────────────────────────────────────────────────────────────

type MasterDataState = {
  construtoras: Construtora[];
  obras: Obra[];
  equipamentos: Equipamento[];
  tiposCabine: TipoCabine[];
  vendedores: Vendedor[];
  engenheiros: Engenheiro[];
  auditLog: AuditEvent[];

  // Selectors ativos
  activeConstrutoras: () => Construtora[];
  activeObras: (construtoraId?: string) => Obra[];
  activeEquipamentos: () => Equipamento[];
  activeTiposCabine: () => TipoCabine[];
  activeVendedores: () => Vendedor[];
  activeEngenheiros: () => Engenheiro[];

  // CRUD Construtoras
  addConstrutora: (input: EntityInput<Construtora>, performedBy: string) => void;
  updateConstrutora: (id: string, patch: Partial<Construtora>, performedBy: string) => void;
  toggleConstrutora: (id: string, performedBy: string) => void;
  deleteConstrutora: (id: string, performedBy: string) => void;

  // CRUD Obras
  addObra: (input: EntityInput<Obra>, performedBy: string) => void;
  updateObra: (id: string, patch: Partial<Obra>, performedBy: string) => void;
  toggleObra: (id: string, performedBy: string) => void;
  deleteObra: (id: string, performedBy: string) => void;

  // CRUD Equipamentos
  addEquipamento: (input: EntityInput<Equipamento>, performedBy: string) => void;
  updateEquipamento: (id: string, patch: Partial<Equipamento>, performedBy: string) => void;
  toggleEquipamento: (id: string, performedBy: string) => void;
  deleteEquipamento: (id: string, performedBy: string) => void;

  // CRUD TiposCabine
  addTipoCabine: (input: EntityInput<TipoCabine>, performedBy: string) => void;
  updateTipoCabine: (id: string, patch: Partial<TipoCabine>, performedBy: string) => void;
  toggleTipoCabine: (id: string, performedBy: string) => void;
  deleteTipoCabine: (id: string, performedBy: string) => void;

  // CRUD Vendedores
  addVendedor: (input: EntityInput<Vendedor>, performedBy: string) => void;
  updateVendedor: (id: string, patch: Partial<Vendedor>, performedBy: string) => void;
  toggleVendedor: (id: string, performedBy: string) => void;
  deleteVendedor: (id: string, performedBy: string) => void;

  // CRUD Engenheiros
  addEngenheiro: (input: EntityInput<Engenheiro>, performedBy: string) => void;
  updateEngenheiro: (id: string, patch: Partial<Engenheiro>, performedBy: string) => void;
  toggleEngenheiro: (id: string, performedBy: string) => void;
  deleteEngenheiro: (id: string, performedBy: string) => void;
};

// ─── Factory (para testes) ────────────────────────────────────────────────────

export function createMasterDataStore() {
  return createStore<MasterDataState>()((set, get) => ({
    construtoras: SEED_CONSTRUTORAS,
    obras: SEED_OBRAS,
    equipamentos: SEED_EQUIPAMENTOS,
    tiposCabine: SEED_TIPOS_CABINE,
    vendedores: SEED_VENDEDORES,
    engenheiros: SEED_ENGENHEIROS,
    auditLog: [],

    // ── Selectors ──
    activeConstrutoras: () => get().construtoras.filter((c) => c.active),
    activeObras: (construtoraId) => {
      const obs = get().obras.filter((o) => o.active);
      return construtoraId ? obs.filter((o) => o.construtoraId === construtoraId) : obs;
    },
    activeEquipamentos: () => get().equipamentos.filter((e) => e.active),
    activeTiposCabine: () => get().tiposCabine.filter((t) => t.active),
    activeVendedores: () => get().vendedores.filter((v) => v.active),
    activeEngenheiros: () => get().engenheiros.filter((e) => e.active),

    // ── Construtoras ──
    addConstrutora: (input, performedBy) => {
      const existing = get().construtoras;
      const dup = existing.find((c) => normalize(c.name) === normalize(input.name));
      if (dup) throw new Error(`Construtora "${input.name}" já existe (duplicada).`);
      const entity: Construtora = { ...buildBase(performedBy), ...input };
      set((s) => ({
        construtoras: [...s.construtoras, entity],
        auditLog: addAudit(s.auditLog, "construtora", entity.id, entity.name, "created", performedBy),
      }));
    },
    updateConstrutora: (id, patch, performedBy) => {
      set((s) => {
        const prev = s.construtoras.find((c) => c.id === id);
        if (!prev) return s;
        const updated = { ...prev, ...patch, updatedAt: today() };
        return {
          construtoras: s.construtoras.map((c) => (c.id === id ? updated : c)),
          auditLog: addAudit(s.auditLog, "construtora", id, updated.name, "updated", performedBy,
            JSON.stringify(prev), JSON.stringify(patch)),
        };
      });
    },
    toggleConstrutora: (id, performedBy) => {
      set((s) => {
        const prev = s.construtoras.find((c) => c.id === id);
        if (!prev) return s;
        const action: AuditAction = prev.active ? "deactivated" : "activated";
        const updated = { ...prev, active: !prev.active, updatedAt: today() };
        return {
          construtoras: s.construtoras.map((c) => (c.id === id ? updated : c)),
          auditLog: addAudit(s.auditLog, "construtora", id, prev.name, action, performedBy),
        };
      });
    },
    deleteConstrutora: (id, performedBy) => {
      const { construtoras, obras } = get();
      const entity = construtoras.find((c) => c.id === id);
      if (!entity) return;
      const hasObra = obras.some((o) => o.construtoraId === id);
      if (hasObra) throw new Error(`Não é possível excluir: existem obras vinculadas a esta construtora.`);
      set((s) => ({
        construtoras: s.construtoras.filter((c) => c.id !== id),
        auditLog: addAudit(s.auditLog, "construtora", id, entity.name, "deleted", performedBy),
      }));
    },

    // ── Obras ──
    addObra: (input, performedBy) => {
      const existing = get().obras.filter((o) => o.construtoraId === input.construtoraId);
      const dup = existing.find((o) => normalize(o.name) === normalize(input.name));
      if (dup) throw new Error(`Obra "${input.name}" já existe para esta construtora.`);
      const entity: Obra = { ...buildBase(performedBy), ...input };
      set((s) => ({
        obras: [...s.obras, entity],
        auditLog: addAudit(s.auditLog, "obra", entity.id, entity.name, "created", performedBy),
      }));
    },
    updateObra: (id, patch, performedBy) => {
      set((s) => {
        const prev = s.obras.find((o) => o.id === id);
        if (!prev) return s;
        const updated = { ...prev, ...patch, updatedAt: today() };
        return {
          obras: s.obras.map((o) => (o.id === id ? updated : o)),
          auditLog: addAudit(s.auditLog, "obra", id, updated.name, "updated", performedBy,
            JSON.stringify(prev), JSON.stringify(patch)),
        };
      });
    },
    toggleObra: (id, performedBy) => {
      set((s) => {
        const prev = s.obras.find((o) => o.id === id);
        if (!prev) return s;
        const action: AuditAction = prev.active ? "deactivated" : "activated";
        const updated = { ...prev, active: !prev.active, updatedAt: today() };
        return {
          obras: s.obras.map((o) => (o.id === id ? updated : o)),
          auditLog: addAudit(s.auditLog, "obra", id, prev.name, action, performedBy),
        };
      });
    },
    deleteObra: (id, performedBy) => {
      const entity = get().obras.find((o) => o.id === id);
      if (!entity) return;
      set((s) => ({
        obras: s.obras.filter((o) => o.id !== id),
        auditLog: addAudit(s.auditLog, "obra", id, entity.name, "deleted", performedBy),
      }));
    },

    // ── Equipamentos ──
    addEquipamento: (input, performedBy) => {
      const dup = get().equipamentos.find((e) => normalize(e.code) === normalize(input.code));
      if (dup) throw new Error(`Equipamento "${input.code}" já existe.`);
      const entity: Equipamento = { ...buildBase(performedBy), ...input, code: input.code.toUpperCase() };
      set((s) => ({
        equipamentos: [...s.equipamentos, entity],
        auditLog: addAudit(s.auditLog, "equipamento", entity.id, entity.code, "created", performedBy),
      }));
    },
    updateEquipamento: (id, patch, performedBy) => {
      set((s) => {
        const prev = s.equipamentos.find((e) => e.id === id);
        if (!prev) return s;
        const updated = { ...prev, ...patch, code: patch.code ? patch.code.toUpperCase() : prev.code, updatedAt: today() };
        return {
          equipamentos: s.equipamentos.map((e) => (e.id === id ? updated : e)),
          auditLog: addAudit(s.auditLog, "equipamento", id, updated.code, "updated", performedBy,
            JSON.stringify(prev), JSON.stringify(patch)),
        };
      });
    },
    toggleEquipamento: (id, performedBy) => {
      set((s) => {
        const prev = s.equipamentos.find((e) => e.id === id);
        if (!prev) return s;
        const action: AuditAction = prev.active ? "deactivated" : "activated";
        const updated = { ...prev, active: !prev.active, updatedAt: today() };
        return {
          equipamentos: s.equipamentos.map((e) => (e.id === id ? updated : e)),
          auditLog: addAudit(s.auditLog, "equipamento", id, prev.code, action, performedBy),
        };
      });
    },
    deleteEquipamento: (id, performedBy) => {
      const entity = get().equipamentos.find((e) => e.id === id);
      if (!entity) return;
      set((s) => ({
        equipamentos: s.equipamentos.filter((e) => e.id !== id),
        auditLog: addAudit(s.auditLog, "equipamento", id, entity.code, "deleted", performedBy),
      }));
    },

    // ── TiposCabine ──
    addTipoCabine: (input, performedBy) => {
      const dup = get().tiposCabine.find((t) => normalize(t.name) === normalize(input.name));
      if (dup) throw new Error(`Tipo de cabine "${input.name}" já existe.`);
      const entity: TipoCabine = { ...buildBase(performedBy), ...input };
      set((s) => ({
        tiposCabine: [...s.tiposCabine, entity],
        auditLog: addAudit(s.auditLog, "tipoCabine", entity.id, entity.name, "created", performedBy),
      }));
    },
    updateTipoCabine: (id, patch, performedBy) => {
      set((s) => {
        const prev = s.tiposCabine.find((t) => t.id === id);
        if (!prev) return s;
        const updated = { ...prev, ...patch, updatedAt: today() };
        return {
          tiposCabine: s.tiposCabine.map((t) => (t.id === id ? updated : t)),
          auditLog: addAudit(s.auditLog, "tipoCabine", id, updated.name, "updated", performedBy,
            JSON.stringify(prev), JSON.stringify(patch)),
        };
      });
    },
    toggleTipoCabine: (id, performedBy) => {
      set((s) => {
        const prev = s.tiposCabine.find((t) => t.id === id);
        if (!prev) return s;
        const action: AuditAction = prev.active ? "deactivated" : "activated";
        const updated = { ...prev, active: !prev.active, updatedAt: today() };
        return {
          tiposCabine: s.tiposCabine.map((t) => (t.id === id ? updated : t)),
          auditLog: addAudit(s.auditLog, "tipoCabine", id, prev.name, action, performedBy),
        };
      });
    },
    deleteTipoCabine: (id, performedBy) => {
      const entity = get().tiposCabine.find((t) => t.id === id);
      if (!entity) return;
      set((s) => ({
        tiposCabine: s.tiposCabine.filter((t) => t.id !== id),
        auditLog: addAudit(s.auditLog, "tipoCabine", id, entity.name, "deleted", performedBy),
      }));
    },

    // ── Vendedores ──
    addVendedor: (input, performedBy) => {
      const dup = get().vendedores.find((v) => normalize(v.name) === normalize(input.name));
      if (dup) throw new Error(`Vendedor "${input.name}" já existe.`);
      const entity: Vendedor = { ...buildBase(performedBy), ...input };
      set((s) => ({
        vendedores: [...s.vendedores, entity],
        auditLog: addAudit(s.auditLog, "vendedor", entity.id, entity.name, "created", performedBy),
      }));
    },
    updateVendedor: (id, patch, performedBy) => {
      set((s) => {
        const prev = s.vendedores.find((v) => v.id === id);
        if (!prev) return s;
        const updated = { ...prev, ...patch, updatedAt: today() };
        return {
          vendedores: s.vendedores.map((v) => (v.id === id ? updated : v)),
          auditLog: addAudit(s.auditLog, "vendedor", id, updated.name, "updated", performedBy,
            JSON.stringify(prev), JSON.stringify(patch)),
        };
      });
    },
    toggleVendedor: (id, performedBy) => {
      set((s) => {
        const prev = s.vendedores.find((v) => v.id === id);
        if (!prev) return s;
        const action: AuditAction = prev.active ? "deactivated" : "activated";
        const updated = { ...prev, active: !prev.active, updatedAt: today() };
        return {
          vendedores: s.vendedores.map((v) => (v.id === id ? updated : v)),
          auditLog: addAudit(s.auditLog, "vendedor", id, prev.name, action, performedBy),
        };
      });
    },
    deleteVendedor: (id, performedBy) => {
      const entity = get().vendedores.find((v) => v.id === id);
      if (!entity) return;
      set((s) => ({
        vendedores: s.vendedores.filter((v) => v.id !== id),
        auditLog: addAudit(s.auditLog, "vendedor", id, entity.name, "deleted", performedBy),
      }));
    },

    // ── Engenheiros ──
    addEngenheiro: (input, performedBy) => {
      const dup = get().engenheiros.find((e) => normalize(e.name) === normalize(input.name));
      if (dup) throw new Error(`Engenheiro "${input.name}" já existe.`);
      const entity: Engenheiro = { ...buildBase(performedBy), ...input };
      set((s) => ({
        engenheiros: [...s.engenheiros, entity],
        auditLog: addAudit(s.auditLog, "engenheiro", entity.id, entity.name, "created", performedBy),
      }));
    },
    updateEngenheiro: (id, patch, performedBy) => {
      set((s) => {
        const prev = s.engenheiros.find((e) => e.id === id);
        if (!prev) return s;
        const updated = { ...prev, ...patch, updatedAt: today() };
        return {
          engenheiros: s.engenheiros.map((e) => (e.id === id ? updated : e)),
          auditLog: addAudit(s.auditLog, "engenheiro", id, updated.name, "updated", performedBy,
            JSON.stringify(prev), JSON.stringify(patch)),
        };
      });
    },
    toggleEngenheiro: (id, performedBy) => {
      set((s) => {
        const prev = s.engenheiros.find((e) => e.id === id);
        if (!prev) return s;
        const action: AuditAction = prev.active ? "deactivated" : "activated";
        const updated = { ...prev, active: !prev.active, updatedAt: today() };
        return {
          engenheiros: s.engenheiros.map((e) => (e.id === id ? updated : e)),
          auditLog: addAudit(s.auditLog, "engenheiro", id, prev.name, action, performedBy),
        };
      });
    },
    deleteEngenheiro: (id, performedBy) => {
      const entity = get().engenheiros.find((e) => e.id === id);
      if (!entity) return;
      set((s) => ({
        engenheiros: s.engenheiros.filter((e) => e.id !== id),
        auditLog: addAudit(s.auditLog, "engenheiro", id, entity.name, "deleted", performedBy),
      }));
    },
  }));
}

// ─── Singleton com persist ────────────────────────────────────────────────────

import { create } from "zustand";

export const useMasterDataStore = create<MasterDataState>()(
  persist(
    (set, get) => createMasterDataStore()((set as Parameters<typeof createMasterDataStore>[0]), get),
    { name: "tsteck:master-data" }
  )
);
```

**Nota técnica:** A função `createMasterDataStore()` exporta um store sem persist para facilitar os testes (cada teste cria uma instância isolada). `useMasterDataStore` é o singleton com persist para uso na aplicação.

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
npm test -- tests/master-data/master-data-store.test.ts
```

Expected: `PASS` — todos os testes passando.

- [ ] **Step 5: Commit**

```bash
git add features/master-data/state/master-data-store.ts tests/master-data/master-data-store.test.ts
git commit -m "feat: add master-data-store with full CRUD and audit log"
```

---

### Task 4: `MasterDataTable` component

**Files:**
- Create: `features/master-data/components/master-data-table.tsx`

- [ ] **Step 1: Criar MasterDataTable**

Criar `web/features/master-data/components/master-data-table.tsx`:

```tsx
"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ColumnDef<T> = {
  key: string;
  header: string;
  width?: string;
  render: (row: T) => React.ReactNode;
};

type MasterDataTableProps<T extends { id: string; active: boolean }> = {
  rows: T[];
  columns: ColumnDef<T>[];
  onEdit: (id: string) => void;
  onToggleActive: (id: string) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
};

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols + 1 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-zinc-100" />
        </td>
      ))}
    </tr>
  );
}

export function MasterDataTable<T extends { id: string; active: boolean }>({
  rows,
  columns,
  onEdit,
  onToggleActive,
  onDelete,
  isLoading,
  emptyState,
}: MasterDataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="table-fixed w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500" style={{ width: col.width }}>
                  {col.header}
                </th>
              ))}
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 bg-white p-12 text-center text-zinc-400">
        {emptyState ?? <p className="text-sm">Nenhum registro encontrado.</p>}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="table-fixed w-full text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500"
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
            <th className="w-12 px-4 py-3" aria-label="Ações" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn("transition-colors hover:bg-zinc-50", !row.active && "opacity-50")}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3">
                  {col.render(row)}
                </td>
              ))}
              <td className="px-4 py-3">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      aria-label="Abrir ações"
                      className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      sideOffset={4}
                      className="z-50 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-md"
                    >
                      <DropdownMenu.Item
                        onSelect={() => onEdit(row.id)}
                        className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-700 outline-none hover:bg-zinc-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => onToggleActive(row.id)}
                        className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-700 outline-none hover:bg-zinc-50"
                      >
                        <Power className="h-3.5 w-3.5" />
                        {row.active ? "Desativar" : "Ativar"}
                      </DropdownMenu.Item>
                      {onDelete && (
                        <>
                          <DropdownMenu.Separator className="my-1 border-t border-zinc-100" />
                          <DropdownMenu.Item
                            onSelect={() => onDelete(row.id)}
                            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-red-600 outline-none hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir
                          </DropdownMenu.Item>
                        </>
                      )}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add features/master-data/components/master-data-table.tsx
git commit -m "feat: add MasterDataTable component"
```

---

### Task 5: `MasterDataFormDialog` + `MasterDataPage`

**Files:**
- Create: `features/master-data/components/master-data-form-dialog.tsx`
- Create: `features/master-data/components/master-data-page.tsx`

- [ ] **Step 1: Criar MasterDataFormDialog**

Criar `web/features/master-data/components/master-data-form-dialog.tsx`:

```tsx
"use client";

import { useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { UnsavedChangesDialog } from "@/features/projects/components/unsaved-changes-dialog";

type MasterDataFormDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  entityLabel: string;
  onClose: () => void;
  onSave: () => Promise<void> | void;
  isDirty: boolean;
  children: ReactNode;
  isSubmitting?: boolean;
  error?: string | null;
};

export function MasterDataFormDialog({
  open,
  mode,
  entityLabel,
  onClose,
  onSave,
  isDirty,
  children,
  isSubmitting,
  error,
}: MasterDataFormDialogProps) {
  const [showUnsaved, setShowUnsaved] = useState(false);

  function handleClose() {
    if (isDirty) {
      setShowUnsaved(true);
    } else {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mdf-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
            <h2 id="mdf-title" className="text-base font-semibold text-zinc-900">
              {mode === "create" ? `Nova ${entityLabel}` : `Editar ${entityLabel}`}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Fechar"
              className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body — scroll */}
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

          {/* Error */}
          {error && (
            <div className="mx-6 mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSubmitting}
              className="rounded-md bg-[#9e0b0f] px-4 py-2 text-sm font-medium text-white hover:bg-[#7a0810] disabled:opacity-50"
            >
              {isSubmitting ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>

      <UnsavedChangesDialog
        open={showUnsaved}
        onConfirm={() => { setShowUnsaved(false); onClose(); }}
        onCancel={() => setShowUnsaved(false)}
      />
    </>
  );
}
```

- [ ] **Step 2: Verificar a API de UnsavedChangesDialog**

Executar:
```bash
grep -n "type\|Props\|export" features/projects/components/unsaved-changes-dialog.tsx | head -20
```

Ajustar as props do `<UnsavedChangesDialog>` se necessário para bater com a API existente.

- [ ] **Step 3: Criar MasterDataPage**

Criar `web/features/master-data/components/master-data-page.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import type { MasterEntity } from "../domain/master-data-types";
import type { ColumnDef } from "./master-data-table";
import { MasterDataTable } from "./master-data-table";

const PAGE_SIZE = 15;

type StatusFilter = "all" | "active" | "inactive";

type MasterDataPageProps<T extends MasterEntity> = {
  title: string;
  description: string;
  addLabel: string;
  rows: T[];
  columns: ColumnDef<T>[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onToggleActive: (id: string) => void;
  onDelete?: (id: string) => void;
  searchField?: keyof T;
  isLoading?: boolean;
};

export function MasterDataPage<T extends MasterEntity>({
  title,
  description,
  addLabel,
  rows,
  columns,
  onAdd,
  onEdit,
  onToggleActive,
  onDelete,
  searchField = "name" as keyof T,
  isLoading,
}: MasterDataPageProps<T>) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? row.active : !row.active);
      const matchSearch =
        !q || String(row[searchField] ?? "").toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [rows, search, statusFilter, searchField]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusFilter(value: StatusFilter) {
    setStatusFilter(value);
    setPage(1);
  }

  const emptyState =
    search.trim() ? (
      <div className="flex flex-col items-center gap-2 text-sm text-zinc-400">
        <p>Nenhum resultado para "{search}"</p>
        <button
          type="button"
          onClick={() => setSearch("")}
          className="text-xs underline hover:text-zinc-700"
        >
          Limpar busca
        </button>
      </div>
    ) : (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-zinc-400">Nenhum registro encontrado.</p>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-md bg-[#9e0b0f] px-4 py-2 text-sm font-medium text-white hover:bg-[#7a0810]"
        >
          {addLabel}
        </button>
      </div>
    );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
          <p className="mt-0.5 text-sm text-zinc-500">{description}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 rounded-md bg-[#9e0b0f] px-4 py-2 text-sm font-medium text-white hover:bg-[#7a0810]"
        >
          <Plus className="h-4 w-4" />
          {addLabel}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full rounded-md border border-zinc-300 py-2 pl-8 pr-8 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]"
          />
          {search && (
            <button
              type="button"
              onClick={() => handleSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex rounded-md border border-zinc-300 text-sm">
          {(["all", "active", "inactive"] as StatusFilter[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleStatusFilter(opt)}
              className={`px-3 py-2 transition-colors first:rounded-l-md last:rounded-r-md ${
                statusFilter === opt
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {{ all: "Todos", active: "Ativos", inactive: "Inativos" }[opt]}
            </button>
          ))}
        </div>
      </div>

      {/* Contagem */}
      <p className="text-xs text-zinc-400">
        {filtered.length} {filtered.length === 1 ? "registro" : "registros"}
        {search && ` para "${search}"`}
      </p>

      {/* Tabela */}
      <MasterDataTable
        rows={pageRows}
        columns={columns}
        onEdit={onEdit}
        onToggleActive={onToggleActive}
        onDelete={onDelete}
        isLoading={isLoading}
        emptyState={emptyState}
      />

      {/* Paginação */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="px-3 text-sm text-zinc-600">
            {currentPage} / {pageCount}
          </span>
          <button
            type="button"
            disabled={currentPage === pageCount}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add features/master-data/components/master-data-form-dialog.tsx \
        features/master-data/components/master-data-page.tsx
git commit -m "feat: add MasterDataFormDialog and MasterDataPage components"
```

---

### Task 6: Formulários específicos por entidade

**Files:**
- Create: `features/master-data/components/construtora-form.tsx`
- Create: `features/master-data/components/obra-form.tsx`
- Create: `features/master-data/components/equipamento-form.tsx`
- Create: `features/master-data/components/tipo-cabine-form.tsx`
- Create: `features/master-data/components/vendedor-form.tsx`
- Create: `features/master-data/components/engenheiro-form.tsx`

- [ ] **Step 1: Criar construtora-form.tsx**

Criar `web/features/master-data/components/construtora-form.tsx`:

```tsx
"use client";

import type { Construtora } from "../domain/master-data-types";

type ConstrutoraFormData = Pick<Construtora, "name" | "cnpj" | "phone" | "email" | "notes">;

type ConstrutoraFormProps = {
  data: Partial<ConstrutoraFormData>;
  onChange: (patch: Partial<ConstrutoraFormData>) => void;
};

export function ConstrutoraForm({ data, onChange }: ConstrutoraFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">
          Nome <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.name ?? ""}
          onChange={(e) => onChange({ name: e.target.value.toUpperCase() })}
          placeholder="Ex: ACRY ENGENHARIA"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">CNPJ</label>
        <input
          type="text"
          value={data.cnpj ?? ""}
          onChange={(e) => onChange({ cnpj: e.target.value })}
          placeholder="00.000.000/0000-00"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">Telefone</label>
          <input
            type="text"
            value={data.phone ?? ""}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="(11) 3333-4444"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">E-mail</label>
          <input
            type="email"
            value={data.email ?? ""}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="contato@empresa.com"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">Observações</label>
        <textarea
          value={data.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={3}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar obra-form.tsx**

Criar `web/features/master-data/components/obra-form.tsx`:

```tsx
"use client";

import type { Construtora, Obra } from "../domain/master-data-types";

type ObraFormData = Pick<Obra, "construtoraId" | "name" | "code" | "address" | "city" | "state" | "notes">;

type ObraFormProps = {
  data: Partial<ObraFormData>;
  onChange: (patch: Partial<ObraFormData>) => void;
  construtoras: Construtora[];
};

const UF_OPTIONS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export function ObraForm({ data, onChange, construtoras }: ObraFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">
          Construtora <span className="text-red-500">*</span>
        </label>
        <select
          value={data.construtoraId ?? ""}
          onChange={(e) => onChange({ construtoraId: e.target.value, name: "" })}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]"
        >
          <option value="">Selecionar...</option>
          {construtoras.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">
          Nome da Obra <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.name ?? ""}
          onChange={(e) => onChange({ name: e.target.value.toUpperCase() })}
          placeholder="Ex: TORRE ALPHA"
          disabled={!data.construtoraId}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f] disabled:bg-zinc-50 disabled:text-zinc-400"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">Código</label>
          <input type="text" value={data.code ?? ""} onChange={(e) => onChange({ code: e.target.value })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">UF</label>
          <select value={data.state ?? ""} onChange={(e) => onChange({ state: e.target.value })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]">
            <option value="">—</option>
            {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">Endereço</label>
        <input type="text" value={data.address ?? ""} onChange={(e) => onChange({ address: e.target.value })}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">Observações</label>
        <textarea value={data.notes ?? ""} onChange={(e) => onChange({ notes: e.target.value })} rows={2}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar equipamento-form.tsx**

Criar `web/features/master-data/components/equipamento-form.tsx`:

```tsx
"use client";

import type { Equipamento } from "../domain/master-data-types";

type EquipamentoFormData = Pick<Equipamento, "code" | "description" | "family" | "capacity" | "dimension" | "notes">;

type EquipamentoFormProps = {
  data: Partial<EquipamentoFormData>;
  onChange: (patch: Partial<EquipamentoFormData>) => void;
};

export function EquipamentoForm({ data, onChange }: EquipamentoFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">
            Código <span className="text-red-500">*</span>
          </label>
          <input type="text" value={data.code ?? ""}
            onChange={(e) => onChange({ code: e.target.value.toUpperCase() })}
            placeholder="EK-15/26"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">Família</label>
          <input type="text" value={data.family ?? ""} onChange={(e) => onChange({ family: e.target.value })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">
          Descrição <span className="text-red-500">*</span>
        </label>
        <input type="text" value={data.description ?? ""} onChange={(e) => onChange({ description: e.target.value })}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">Capacidade</label>
          <input type="text" value={data.capacity ?? ""} onChange={(e) => onChange({ capacity: e.target.value })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">Dimensão</label>
          <input type="text" value={data.dimension ?? ""} onChange={(e) => onChange({ dimension: e.target.value })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">Observações</label>
        <textarea value={data.notes ?? ""} onChange={(e) => onChange({ notes: e.target.value })} rows={2}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Criar tipo-cabine-form.tsx, vendedor-form.tsx, engenheiro-form.tsx**

Criar `web/features/master-data/components/tipo-cabine-form.tsx`:
```tsx
"use client";
import type { TipoCabine } from "../domain/master-data-types";
type TipoCabineFormData = Pick<TipoCabine, "name" | "description">;
type TipoCabineFormProps = { data: Partial<TipoCabineFormData>; onChange: (patch: Partial<TipoCabineFormData>) => void; };
export function TipoCabineForm({ data, onChange }: TipoCabineFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">Nome <span className="text-red-500">*</span></label>
        <input type="text" value={data.name ?? ""} onChange={(e) => onChange({ name: e.target.value.toUpperCase() })}
          placeholder="Ex: SIMPLES + C.O." className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">Descrição</label>
        <textarea value={data.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} rows={3}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]" />
      </div>
    </div>
  );
}
```

Criar `web/features/master-data/components/vendedor-form.tsx`:
```tsx
"use client";
import type { Vendedor } from "../domain/master-data-types";
type VendedorFormData = Pick<Vendedor, "name" | "email" | "phone">;
type VendedorFormProps = { data: Partial<VendedorFormData>; onChange: (patch: Partial<VendedorFormData>) => void; };
export function VendedorForm({ data, onChange }: VendedorFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">Nome <span className="text-red-500">*</span></label>
        <input type="text" value={data.name ?? ""} onChange={(e) => onChange({ name: e.target.value.toUpperCase() })}
          placeholder="Ex: RENATO" className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">Telefone</label>
          <input type="text" value={data.phone ?? ""} onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="(11) 93333-4444" className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">E-mail</label>
          <input type="email" value={data.email ?? ""} onChange={(e) => onChange({ email: e.target.value })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]" />
        </div>
      </div>
    </div>
  );
}
```

Criar `web/features/master-data/components/engenheiro-form.tsx`:
```tsx
"use client";
import type { Engenheiro } from "../domain/master-data-types";
type EngenheiroFormData = Pick<Engenheiro, "name" | "phone" | "email">;
type EngenheiroFormProps = { data: Partial<EngenheiroFormData>; onChange: (patch: Partial<EngenheiroFormData>) => void; };
export function EngenheiroForm({ data, onChange }: EngenheiroFormProps) {
  function handleNameChange(raw: string) {
    const withPrefix = raw.startsWith("Engº") ? raw : `Engº ${raw.replace(/^engº\s*/i, "")}`;
    onChange({ name: withPrefix });
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">Nome <span className="text-red-500">*</span></label>
        <input type="text" value={data.name ?? ""} onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Engº Rafael Costa" className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]" />
        <p className="text-xs text-zinc-400">Prefixo "Engº" adicionado automaticamente.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">Celular</label>
          <input type="text" value={data.phone ?? ""} onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="(11) 93333-4444" className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">E-mail</label>
          <input type="email" value={data.email ?? ""} onChange={(e) => onChange({ email: e.target.value })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add features/master-data/components/construtora-form.tsx \
        features/master-data/components/obra-form.tsx \
        features/master-data/components/equipamento-form.tsx \
        features/master-data/components/tipo-cabine-form.tsx \
        features/master-data/components/vendedor-form.tsx \
        features/master-data/components/engenheiro-form.tsx
git commit -m "feat: add entity-specific form components for all 6 master entities"
```

---

### Task 7: Pages CRUD reais (substituir stubs)

**Files:**
- Replace: `app/(main)/master/construtoras/page.tsx`
- Replace: `app/(main)/master/obras/page.tsx`
- Replace: `app/(main)/master/equipamentos/page.tsx`
- Replace: `app/(main)/master/tipos-cabine/page.tsx`
- Replace: `app/(main)/master/vendedores/page.tsx`
- Replace: `app/(main)/master/engenheiros/page.tsx`
- Replace: `app/(main)/master/auditoria/page.tsx`

- [ ] **Step 1: Criar construtoras/page.tsx**

Substituir `web/app/(main)/master/construtoras/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";
import { useCurrentUser } from "@/features/user/hooks/use-current-user";
import { MasterDataPage } from "@/features/master-data/components/master-data-page";
import { MasterDataFormDialog } from "@/features/master-data/components/master-data-form-dialog";
import { ConstrutoraForm } from "@/features/master-data/components/construtora-form";
import type { Construtora } from "@/features/master-data/domain/master-data-types";
import type { ColumnDef } from "@/features/master-data/components/master-data-table";

const COLUMNS: ColumnDef<Construtora>[] = [
  { key: "name", header: "Nome", width: "auto", render: (r) => <span className="font-medium text-zinc-900">{r.name}</span> },
  { key: "cnpj", header: "CNPJ", width: "160px", render: (r) => <span className="text-zinc-500">{r.cnpj ?? "—"}</span> },
  { key: "phone", header: "Telefone", width: "140px", render: (r) => <span className="text-zinc-500">{r.phone ?? "—"}</span> },
  {
    key: "status", header: "Status", width: "90px",
    render: (r) => (
      <span className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-medium ${r.active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
        {r.active ? "Ativo" : "Inativo"}
      </span>
    ),
  },
];

type FormData = Partial<Pick<Construtora, "name" | "cnpj" | "phone" | "email" | "notes">>;
const BLANK: FormData = { name: "", cnpj: "", phone: "", email: "", notes: "" };

export default function ConstrutorsPage() {
  const store = useMasterDataStore();
  const { user } = useCurrentUser();
  const performedBy = user?.name ?? "Sistema";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(BLANK);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditId(null);
    setFormData(BLANK);
    setIsDirty(false);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    const c = store.construtoras.find((c) => c.id === id);
    if (!c) return;
    setEditId(id);
    setFormData({ name: c.name, cnpj: c.cnpj, phone: c.phone, email: c.email, notes: c.notes });
    setIsDirty(false);
    setError(null);
    setDialogOpen(true);
  }

  function handleChange(patch: Partial<FormData>) {
    setFormData((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
  }

  function handleSave() {
    if (!formData.name?.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    try {
      if (editId) {
        store.updateConstrutora(editId, { ...formData, name: formData.name.trim() }, performedBy);
      } else {
        store.addConstrutora({ ...formData, name: formData.name.trim() } as Parameters<typeof store.addConstrutora>[0], performedBy);
      }
      setDialogOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  function handleDelete(id: string) {
    try {
      store.deleteConstrutora(id, performedBy);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Não é possível excluir.");
    }
  }

  return (
    <>
      <MasterDataPage
        title="Construtoras"
        description="Empresas construtoras vinculadas aos projetos."
        addLabel="Nova Construtora"
        rows={store.construtoras}
        columns={COLUMNS}
        onAdd={openCreate}
        onEdit={openEdit}
        onToggleActive={(id) => store.toggleConstrutora(id, performedBy)}
        onDelete={handleDelete}
      />
      <MasterDataFormDialog
        open={dialogOpen}
        mode={editId ? "edit" : "create"}
        entityLabel="Construtora"
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        isDirty={isDirty}
        error={error}
      >
        <ConstrutoraForm data={formData} onChange={handleChange} />
      </MasterDataFormDialog>
    </>
  );
}
```

- [ ] **Step 2: Criar obras/page.tsx**

Substituir `web/app/(main)/master/obras/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";
import { useCurrentUser } from "@/features/user/hooks/use-current-user";
import { MasterDataPage } from "@/features/master-data/components/master-data-page";
import { MasterDataFormDialog } from "@/features/master-data/components/master-data-form-dialog";
import { ObraForm } from "@/features/master-data/components/obra-form";
import type { Obra } from "@/features/master-data/domain/master-data-types";
import type { ColumnDef } from "@/features/master-data/components/master-data-table";

type FormData = Partial<Pick<Obra, "construtoraId" | "name" | "code" | "address" | "city" | "state" | "notes">>;
const BLANK: FormData = { construtoraId: "", name: "", code: "", address: "", city: "", state: "", notes: "" };

export default function ObrasPage() {
  const store = useMasterDataStore();
  const { user } = useCurrentUser();
  const performedBy = user?.name ?? "Sistema";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(BLANK);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const construtorasMap = new Map(store.construtoras.map((c) => [c.id, c.name]));

  const COLUMNS: ColumnDef<Obra>[] = [
    { key: "name", header: "Obra", width: "auto", render: (r) => <span className="font-medium text-zinc-900">{r.name}</span> },
    { key: "construtora", header: "Construtora", width: "200px", render: (r) => <span className="text-zinc-600">{construtorasMap.get(r.construtoraId) ?? r.construtoraId}</span> },
    { key: "state", header: "UF", width: "60px", render: (r) => <span className="text-zinc-500">{r.state ?? "—"}</span> },
    {
      key: "status", header: "Status", width: "90px",
      render: (r) => <span className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-medium ${r.active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>{r.active ? "Ativo" : "Inativo"}</span>,
    },
  ];

  function openCreate() { setEditId(null); setFormData(BLANK); setIsDirty(false); setError(null); setDialogOpen(true); }
  function openEdit(id: string) {
    const o = store.obras.find((o) => o.id === id);
    if (!o) return;
    setEditId(id);
    setFormData({ construtoraId: o.construtoraId, name: o.name, code: o.code, address: o.address, city: o.city, state: o.state, notes: o.notes });
    setIsDirty(false); setError(null); setDialogOpen(true);
  }

  function handleSave() {
    if (!formData.construtoraId) { setError("Construtora é obrigatória."); return; }
    if (!formData.name?.trim()) { setError("Nome é obrigatório."); return; }
    try {
      if (editId) { store.updateObra(editId, { ...formData, name: formData.name.trim() }, performedBy); }
      else { store.addObra({ ...formData, name: formData.name.trim() } as Parameters<typeof store.addObra>[0], performedBy); }
      setDialogOpen(false);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Erro ao salvar."); }
  }

  return (
    <>
      <MasterDataPage
        title="Obras"
        description="Obras vinculadas às construtoras."
        addLabel="Nova Obra"
        rows={store.obras}
        columns={COLUMNS}
        onAdd={openCreate}
        onEdit={openEdit}
        onToggleActive={(id) => store.toggleObra(id, performedBy)}
        onDelete={(id) => { try { store.deleteObra(id, performedBy); } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erro."); } }}
      />
      <MasterDataFormDialog open={dialogOpen} mode={editId ? "edit" : "create"} entityLabel="Obra" onClose={() => setDialogOpen(false)} onSave={handleSave} isDirty={isDirty} error={error}>
        <ObraForm data={formData} onChange={(p) => { setFormData((prev) => ({ ...prev, ...p })); setIsDirty(true); }} construtoras={store.activeConstrutoras()} />
      </MasterDataFormDialog>
    </>
  );
}
```

- [ ] **Step 3: Criar páginas restantes (equipamentos, tipos-cabine, vendedores, engenheiros)**

Para cada uma das 4 entidades restantes, criar o arquivo de página seguindo o mesmo padrão de `construtoras/page.tsx`:

- `app/(main)/master/equipamentos/page.tsx` — usa `EquipamentoForm`, campo de busca `searchField="code"`, colunas: Código, Descrição, Família, Status
- `app/(main)/master/tipos-cabine/page.tsx` — usa `TipoCabineForm`, colunas: Nome, Descrição, Status
- `app/(main)/master/vendedores/page.tsx` — usa `VendedorForm`, colunas: Nome, Telefone, E-mail, Status
- `app/(main)/master/engenheiros/page.tsx` — usa `EngenheiroForm`, colunas: Nome, Celular, Status

O padrão é idêntico ao `obras/page.tsx` sem a lógica de construtoraId.

- [ ] **Step 4: Criar auditoria/page.tsx**

Substituir `web/app/(main)/master/auditoria/page.tsx`:

```tsx
"use client";

import { useMasterDataStore } from "@/features/master-data/state/master-data-store";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const ACTION_LABELS: Record<string, string> = {
  created: "Criado",
  updated: "Editado",
  activated: "Ativado",
  deactivated: "Desativado",
  deleted: "Excluído",
};

const ENTITY_LABELS: Record<string, string> = {
  construtora: "Construtora",
  obra: "Obra",
  equipamento: "Equipamento",
  tipoCabine: "Tipo de Cabine",
  vendedor: "Vendedor",
  engenheiro: "Engenheiro",
};

export default function AuditoriaPage() {
  const { auditLog } = useMasterDataStore();
  const sorted = [...auditLog].reverse();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Auditoria</h1>
        <p className="mt-0.5 text-sm text-zinc-500">Histórico de alterações nos cadastros mestres.</p>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-zinc-200 p-12 text-center text-sm text-zinc-400">
          Nenhuma alteração registrada ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="table-fixed w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500" style={{ width: "180px" }}>Data/Hora</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500" style={{ width: "130px" }}>Entidade</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500" style={{ width: "110px" }}>Ação</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500" style={{ width: "160px" }}>Usuário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sorted.map((entry) => (
                <tr key={entry.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 text-xs text-zinc-500 font-mono">
                    {format(parseISO(entry.performedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{ENTITY_LABELS[entry.entity] ?? entry.entity}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900 truncate">{entry.entityName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-medium ${
                      entry.action === "created" ? "bg-emerald-50 text-emerald-700"
                      : entry.action === "deleted" ? "bg-red-50 text-red-700"
                      : "bg-zinc-100 text-zinc-600"
                    }`}>
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 truncate">{entry.performedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add app/(main)/master/
git commit -m "feat: replace stub pages with full CRUD pages for all 6 master entities"
```

---

### Task 8: Teste de UI — página de Construtoras

**Files:**
- Create: `tests/master-data/construtoras-page.test.tsx`

- [ ] **Step 1: Escrever o teste**

Criar `web/tests/master-data/construtoras-page.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do store para isolar o teste de UI do estado persistido
vi.mock("@/features/master-data/state/master-data-store", () => {
  const construtoras: Array<{ id: string; name: string; active: boolean; createdAt: string; updatedAt: string; createdBy: string }> = [];
  const store = {
    construtoras,
    obras: [],
    addConstrutora: vi.fn((input: { name: string }, _performedBy: string) => {
      construtoras.push({ id: "test-id", ...input, active: true, createdAt: "2026-01-01", updatedAt: "2026-01-01", createdBy: _performedBy });
    }),
    updateConstrutora: vi.fn(),
    toggleConstrutora: vi.fn(),
    deleteConstrutora: vi.fn(),
    activeConstrutoras: () => construtoras.filter((c) => c.active),
  };
  return { useMasterDataStore: () => store };
});

vi.mock("@/features/user/hooks/use-current-user", () => ({
  useCurrentUser: () => ({ user: { name: "Tester", role: "admin", initials: "T" } }),
}));

import ConstrutorsPage from "@/app/(main)/master/construtoras/page";

describe("ConstrutorsPage", () => {
  it("renders empty state with add button when no construtoras", () => {
    render(<ConstrutorsPage />);
    expect(screen.getByText("Nova Construtora")).toBeInTheDocument();
  });

  it("opens form dialog on add button click", async () => {
    render(<ConstrutorsPage />);
    await userEvent.click(screen.getAllByText("Nova Construtora")[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Nova Construtora", { selector: "h2" })).toBeInTheDocument();
  });

  it("shows error when saving without name", async () => {
    render(<ConstrutorsPage />);
    await userEvent.click(screen.getAllByText("Nova Construtora")[0]);
    await userEvent.click(screen.getByText("Salvar"));
    expect(screen.getByText("Nome é obrigatório.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar os testes**

```bash
npm test -- tests/master-data/
```

Expected: `PASS` — testes de store e de UI passando.

- [ ] **Step 3: Rodar toda a suite**

```bash
npm test
```

Expected: todos os testes passando (12+ arquivos de teste).

- [ ] **Step 4: Verificar lint e build**

```bash
npm run lint
npm run build
```

Expected: sem erros.

- [ ] **Step 5: Commit final da fase**

```bash
git add tests/master-data/construtoras-page.test.tsx
git commit -m "feat: complete Phase 2 — full master data layer with CRUD and persistence"
```

---

## Próxima fase

Após a Fase 2 estar verde, prosseguir com:

📄 `docs/superpowers/plans/2026-05-28-phase3-project-migration-plan.md`
