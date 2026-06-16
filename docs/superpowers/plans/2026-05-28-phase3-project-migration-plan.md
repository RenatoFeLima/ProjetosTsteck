# Fase 3 — Migração de Projetos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Pré-requisito:** Fase 2 completa, `master-data-seed.ts` preenchido com todos os IDs, todos os testes passando.

**Goal:** Migrar o tipo `Project` de strings para IDs, atualizar o seed usando `SEED_IDS`, remover `project-directory.ts`, criar `useMasterDataLookup`, e atualizar todos os componentes de exibição para resolução ID→nome.

**Architecture:** `useMasterDataLookup` usa `useMemo` para construir Maps O(1) a partir do master store. Componentes de exibição (tabela, drawer, kanban, KPIs) consomem esse hook. Componentes de formulário e filtros são atualizados na Fase 4. Esta fase NÃO toca em `project-form-modal.tsx` nem em `projects-toolbar.tsx`.

**Tech Stack:** TypeScript strict, Zustand, date-fns, Vitest.

**Atenção — Alto impacto:** Esta fase toca em todos os componentes que exibem dados de projeto. Executar testes após cada task individual.

---

## File Structure

| Operação | Arquivo |
|---|---|
| MODIFY | `features/projects/domain/project-types.ts` |
| MODIFY | `features/projects/domain/project-seed.ts` |
| MODIFY | `features/projects/state/projects-store.ts` |
| DELETE | `features/projects/domain/project-directory.ts` |
| CREATE | `features/master-data/hooks/use-master-data-lookup.ts` |
| CREATE | `tests/master-data/use-master-data-lookup.test.ts` |
| MODIFY | `features/projects/components/projects-table.tsx` |
| MODIFY | `features/projects/components/project-details-drawer.tsx` |
| MODIFY | `features/projects/components/projects-kanban.tsx` |
| MODIFY | `features/projects/components/projects-kpi-dashboard.tsx` |
| MODIFY | `tests/domain/project-seed.test.ts` |
| MODIFY | `tests/state/projects-store.test.ts` |
| MODIFY | `tests/ui/projects-table-urgency.test.tsx` |
| MODIFY | `tests/ui/projects-page.test.tsx` |

---

### Task 1: Migrar `project-types.ts`

**Files:**
- Modify: `features/projects/domain/project-types.ts`

- [ ] **Step 1: Atualizar o tipo Project — renomear campos de string para IDs**

No arquivo `web/features/projects/domain/project-types.ts`, substituir:

```typescript
export type Project = {
  id: string;
  construtora: string;
  obra: string;
  engenheiro_nome?: string;
  engenheiro_celular?: string;
  equipamento: string;
  tipo_cabine?: string;
  codigo_projeto: string;
  vendedor: string;
```

por:

```typescript
export type Project = {
  id: string;
  construtoraId: string;
  obraId: string;
  engenheiroId?: string;
  equipamentoId: string;
  tipoCabineId?: string;
  codigo_projeto: string;
  vendedorId: string;
```

Manter todos os outros campos (`proj_obra_recebido`, `local_cabine_definido`, etc.) sem alteração.

- [ ] **Step 2: Atualizar ProjectInput no projects-store.ts**

No arquivo `web/features/projects/state/projects-store.ts`, substituir:

```typescript
type ProjectInput = Pick<
  Project,
  "construtora" | "obra" | "codigo_projeto" | "vendedor" | "equipamento" | "data_lancamento"
> &
  Partial<Project>;
```

por:

```typescript
type ProjectInput = Pick<
  Project,
  "construtoraId" | "obraId" | "codigo_projeto" | "vendedorId" | "equipamentoId" | "data_lancamento"
> &
  Partial<Project>;
```

- [ ] **Step 3: Verificar erros de tipo**

```bash
cd web
npx tsc --noEmit 2>&1 | head -50
```

Expected: muitos erros (seed, store, componentes ainda usam campos antigos). Isso é esperado neste passo — serão corrigidos nas tarefas seguintes.

- [ ] **Step 4: Commit parcial**

```bash
git add features/projects/domain/project-types.ts features/projects/state/projects-store.ts
git commit -m "refactor: rename Project string fields to ID references"
```

---

### Task 2: Migrar `project-seed.ts`

**Files:**
- Modify: `features/projects/domain/project-seed.ts`

- [ ] **Step 1: Importar SEED_IDS e substituir strings por IDs**

No topo de `web/features/projects/domain/project-seed.ts`, adicionar a importação:

```typescript
import { SEED_IDS } from "@/features/master-data/domain/master-data-seed";
```

- [ ] **Step 2: Substituir todos os campos de string por IDs em cada projeto seed**

Para cada projeto no array `SEED_PROJECTS`, substituir:

```typescript
// ANTES (exemplo):
{
  id: "seed-1",
  construtora: "18 DO FORTE",
  obra: "PANAMERA",
  engenheiro_nome: "ENG. XXX",
  engenheiro_celular: "(99) 99999-9999",
  equipamento: "EK-15/26",
  tipo_cabine: "SIMPLES",
  vendedor: "LUCIANO",
  ...
}

// DEPOIS:
{
  id: "seed-1",
  construtoraId: SEED_IDS.construtoras["18 DO FORTE"],
  obraId: SEED_IDS.obras["PANAMERA"],
  engenheiroId: undefined,   // "ENG. XXX" era placeholder — sem cadastro real
  equipamentoId: SEED_IDS.equipamentos["EK-15/26"],
  tipoCabineId: SEED_IDS.tiposCabine["SIMPLES"],
  vendedorId: SEED_IDS.vendedores["LUCIANO"],
  ...
}
```

**Regra para `engenheiroId`:** Se `engenheiro_nome` era `"ENG. XXX"` ou `"(99) 99999-9999"` (placeholders), usar `undefined`. Caso contrário, buscar o ID correspondente em `SEED_IDS.engenheiros`.

**Regra para `tipoCabineId`:** Se `tipo_cabine` era `""` (vazio), usar `undefined`.

Repetir para todos os projetos no seed.

- [ ] **Step 3: Verificar que buildSeedProjects() retorna o tipo correto**

```bash
npx tsc --noEmit 2>&1 | grep "project-seed" | head -20
```

Expected: zero erros relacionados a `project-seed.ts`.

- [ ] **Step 4: Commit**

```bash
git add features/projects/domain/project-seed.ts
git commit -m "refactor: migrate project-seed.ts to use master-data SEED_IDs"
```

---

### Task 3: Atualizar `projects-store.ts` + remover project-directory.ts

**Files:**
- Modify: `features/projects/state/projects-store.ts`
- Delete: `features/projects/domain/project-directory.ts`

- [ ] **Step 1: Remover imports de project-directory.ts no store**

No `web/features/projects/state/projects-store.ts`, remover qualquer import de `project-directory`.

- [ ] **Step 2: Atualizar o tipo Filters no store**

Substituir:

```typescript
type Filters = {
  search: string;
  status: "all" | ProjectStatus;
  construtora: string;
  obra: string;
  vendedor: string;
  equipamento: string;
  atrasadoOnly: boolean;
  urgenteOnly: boolean;
};
```

por:

```typescript
type Filters = {
  search: string;
  status: "all" | ProjectStatus;
  construtoraId: string;
  obraId: string;
  vendedorId: string;
  equipamentoId: string;
  atrasadoOnly: boolean;
  urgenteOnly: boolean;
};
```

- [ ] **Step 3: Atualizar o valor inicial dos filtros**

Localizar onde os filtros são inicializados (geralmente dentro do `create(...)`) e atualizar:

```typescript
filters: {
  search: "",
  status: "all",
  construtoraId: "",
  obraId: "",
  vendedorId: "",
  equipamentoId: "",
  atrasadoOnly: false,
  urgenteOnly: false,
},
```

- [ ] **Step 4: Atualizar `filteredProjects` para usar os novos nomes de campo**

Localizar a implementação de `filteredProjects()` e substituir os filtros:

```typescript
// ANTES:
if (f.construtora) p = p.filter((proj) => proj.construtora === f.construtora);
if (f.obra) p = p.filter((proj) => proj.obra === f.obra);
if (f.vendedor) p = p.filter((proj) => proj.vendedor === f.vendedor);
if (f.equipamento) p = p.filter((proj) => proj.equipamento === f.equipamento);

// DEPOIS:
if (f.construtoraId) p = p.filter((proj) => proj.construtoraId === f.construtoraId);
if (f.obraId) p = p.filter((proj) => proj.obraId === f.obraId);
if (f.vendedorId) p = p.filter((proj) => proj.vendedorId === f.vendedorId);
if (f.equipamentoId) p = p.filter((proj) => proj.equipamentoId === f.equipamentoId);
```

- [ ] **Step 5: Deletar project-directory.ts**

```bash
git rm features/projects/domain/project-directory.ts
```

- [ ] **Step 6: Verificar erros de tipo**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Expected: erros apenas em componentes de UI (projects-table, drawer, kanban, etc.) que ainda referenciam campos antigos. Nenhum erro em domain/ ou state/.

- [ ] **Step 7: Commit**

```bash
git add features/projects/state/projects-store.ts
git rm features/projects/domain/project-directory.ts
git commit -m "refactor: update projects-store filters to use ID fields; remove project-directory.ts"
```

---

### Task 4: `useMasterDataLookup` hook + testes

**Files:**
- Create: `features/master-data/hooks/use-master-data-lookup.ts`
- Create: `tests/master-data/use-master-data-lookup.test.ts`

- [ ] **Step 1: Escrever o teste que deve falhar**

Criar `web/tests/master-data/use-master-data-lookup.test.ts`:

```typescript
import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useMasterDataLookup } from "@/features/master-data/hooks/use-master-data-lookup";

vi.mock("@/features/master-data/state/master-data-store", () => ({
  useMasterDataStore: () => ({
    construtoras: [{ id: "c-001", name: "ACRY" }],
    obras: [{ id: "o-001", name: "ARTHUR DE AZEVEDO" }],
    vendedores: [{ id: "v-001", name: "RENATO" }],
    equipamentos: [{ id: "e-001", code: "EK-15/26", description: "EK-15/26" }],
    tiposCabine: [{ id: "tc-001", name: "SIMPLES" }],
    engenheiros: [{ id: "eng-001", name: "Engº Rafael" }],
  }),
}));

describe("useMasterDataLookup", () => {
  it("resolves construtora id to name", () => {
    const { result } = renderHook(() => useMasterDataLookup());
    expect(result.current.construtoraName("c-001")).toBe("ACRY");
  });

  it("resolves obra id to name", () => {
    const { result } = renderHook(() => useMasterDataLookup());
    expect(result.current.obraName("o-001")).toBe("ARTHUR DE AZEVEDO");
  });

  it("resolves equipamento id to code", () => {
    const { result } = renderHook(() => useMasterDataLookup());
    expect(result.current.equipamentoName("e-001")).toBe("EK-15/26");
  });

  it("returns the id itself when not found (fallback)", () => {
    const { result } = renderHook(() => useMasterDataLookup());
    expect(result.current.construtoraName("unknown-id")).toBe("unknown-id");
  });

  it("returns empty string for undefined optional fields", () => {
    const { result } = renderHook(() => useMasterDataLookup());
    expect(result.current.tipoCabineName(undefined)).toBe("");
    expect(result.current.engenheiroName(undefined)).toBe("");
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

```bash
npm test -- tests/master-data/use-master-data-lookup.test.ts
```

Expected: `FAIL` com "Cannot find module".

- [ ] **Step 3: Implementar o hook**

Criar `web/features/master-data/hooks/use-master-data-lookup.ts`:

```typescript
"use client";

import { useMemo } from "react";
import { useMasterDataStore } from "../state/master-data-store";

export function useMasterDataLookup() {
  const { construtoras, obras, vendedores, equipamentos, tiposCabine, engenheiros } =
    useMasterDataStore();

  const construtoraMap = useMemo(
    () => new Map(construtoras.map((c) => [c.id, c.name])),
    [construtoras]
  );
  const obraMap = useMemo(
    () => new Map(obras.map((o) => [o.id, o.name])),
    [obras]
  );
  const vendedorMap = useMemo(
    () => new Map(vendedores.map((v) => [v.id, v.name])),
    [vendedores]
  );
  const equipamentoMap = useMemo(
    () => new Map(equipamentos.map((e) => [e.id, e.code])),
    [equipamentos]
  );
  const tipoCabineMap = useMemo(
    () => new Map(tiposCabine.map((t) => [t.id, t.name])),
    [tiposCabine]
  );
  const engenheiroMap = useMemo(
    () => new Map(engenheiros.map((e) => [e.id, e.name])),
    [engenheiros]
  );

  return {
    construtoraName: (id: string) => construtoraMap.get(id) ?? id,
    obraName: (id: string) => obraMap.get(id) ?? id,
    vendedorName: (id: string) => vendedorMap.get(id) ?? id,
    equipamentoName: (id: string) => equipamentoMap.get(id) ?? id,
    tipoCabineName: (id: string | undefined) => (id ? (tipoCabineMap.get(id) ?? id) : ""),
    engenheiroName: (id: string | undefined) => (id ? (engenheiroMap.get(id) ?? id) : ""),
  };
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

```bash
npm test -- tests/master-data/use-master-data-lookup.test.ts
```

Expected: `PASS` — 5 testes passando.

- [ ] **Step 5: Commit**

```bash
git add features/master-data/hooks/use-master-data-lookup.ts \
        tests/master-data/use-master-data-lookup.test.ts
git commit -m "feat: add useMasterDataLookup hook with O(1) Maps via useMemo"
```

---

### Task 5: Atualizar componentes de exibição

**Files:**
- Modify: `features/projects/components/projects-table.tsx`
- Modify: `features/projects/components/project-details-drawer.tsx`
- Modify: `features/projects/components/projects-kanban.tsx`
- Modify: `features/projects/components/projects-kpi-dashboard.tsx`

- [ ] **Step 1: Atualizar projects-table.tsx**

No início do componente principal em `web/features/projects/components/projects-table.tsx`:

1. Importar o hook:
```typescript
import { useMasterDataLookup } from "@/features/master-data/hooks/use-master-data-lookup";
```

2. Dentro do componente (antes do return), adicionar:
```typescript
const lookup = useMasterDataLookup();
```

3. Substituir todas as referências a campos renomeados nas células da tabela:

```tsx
// ANTES:
<td>{project.construtora}</td>
<td>{project.obra}</td>
<td>{project.vendedor}</td>
<td>{project.equipamento}</td>

// DEPOIS:
<td>{lookup.construtoraName(project.construtoraId)}</td>
<td>{lookup.obraName(project.obraId)}</td>
<td>{lookup.vendedorName(project.vendedorId)}</td>
<td>{lookup.equipamentoName(project.equipamentoId)}</td>
```

4. Remover imports de `project-directory.ts` se houver algum restante.

- [ ] **Step 2: Verificar testes de tabela após mudança**

```bash
npm test -- tests/ui/projects-table-urgency.test.tsx
```

Expected: `PASS` (o teste não valida os nomes das células, apenas o menu de ações).

- [ ] **Step 3: Atualizar project-details-drawer.tsx**

No `web/features/projects/components/project-details-drawer.tsx`:

1. Adicionar import:
```typescript
import { useMasterDataLookup } from "@/features/master-data/hooks/use-master-data-lookup";
```

2. Dentro do componente, adicionar:
```typescript
const lookup = useMasterDataLookup();
```

3. Substituir todas as referências a campos renomeados:
```tsx
// Construtora
lookup.construtoraName(project.construtoraId)

// Obra
lookup.obraName(project.obraId)

// Equipamento
lookup.equipamentoName(project.equipamentoId)

// Tipo de Cabine
lookup.tipoCabineName(project.tipoCabineId)

// Vendedor
lookup.vendedorName(project.vendedorId)

// Engenheiro (nome + telefone vêm do cadastro agora)
// Se engenheiroId estiver definido, buscar o engenheiro completo do store para exibir nome e telefone
```

4. Para exibir dados do engenheiro (nome + telefone), o drawer precisa também de acesso ao master store:
```typescript
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";

// dentro do componente:
const { engenheiros } = useMasterDataStore();
const engenheiro = project.engenheiroId
  ? engenheiros.find((e) => e.id === project.engenheiroId)
  : null;
```

5. Substituir referências a `project.engenheiro_nome` e `project.engenheiro_celular`:
```tsx
// ANTES:
{project.engenheiro_nome && <span>{project.engenheiro_nome}</span>}
{project.engenheiro_celular && <span>{project.engenheiro_celular}</span>}

// DEPOIS:
{engenheiro && <span>{engenheiro.name}</span>}
{engenheiro?.phone && <span>{engenheiro.phone}</span>}
```

- [ ] **Step 4: Atualizar projects-kanban.tsx**

No `web/features/projects/components/projects-kanban.tsx`:

1. Adicionar import:
```typescript
import { useMasterDataLookup } from "@/features/master-data/hooks/use-master-data-lookup";
```

2. Dentro do componente raiz do kanban:
```typescript
const lookup = useMasterDataLookup();
```

3. Passar `lookup` como prop para os cards ou usar diretamente onde os nomes são exibidos:
```tsx
// ANTES:
<span>{project.construtora}</span>
<span>{project.obra}</span>

// DEPOIS:
<span>{lookup.construtoraName(project.construtoraId)}</span>
<span>{lookup.obraName(project.obraId)}</span>
```

- [ ] **Step 5: Atualizar projects-kpi-dashboard.tsx**

No `web/features/projects/components/projects-kpi-dashboard.tsx`:

1. Adicionar import:
```typescript
import { useMasterDataLookup } from "@/features/master-data/hooks/use-master-data-lookup";
```

2. Substituir todas as referências a campos renomeados para exibição de nomes em tooltips ou labels.

3. Se o dashboard agrupa por construtora/vendedor usando `project.construtora`:
```typescript
// ANTES:
const grouped = projects.reduce((acc, p) => {
  const key = p.construtora;
  ...
}, {});

// DEPOIS:
const lookup = useMasterDataLookup();
const grouped = projects.reduce((acc, p) => {
  const key = lookup.construtoraName(p.construtoraId);
  ...
}, {});
```

- [ ] **Step 6: Verificar erros de tipo**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: zero erros.

- [ ] **Step 7: Commit**

```bash
git add features/projects/components/projects-table.tsx \
        features/projects/components/project-details-drawer.tsx \
        features/projects/components/projects-kanban.tsx \
        features/projects/components/projects-kpi-dashboard.tsx
git commit -m "refactor: update display components to use useMasterDataLookup"
```

---

### Task 6: Atualizar testes existentes

**Files:**
- Modify: `tests/domain/project-seed.test.ts`
- Modify: `tests/state/projects-store.test.ts`
- Modify: `tests/ui/projects-table-urgency.test.tsx`
- Modify: `tests/ui/projects-page.test.tsx`

- [ ] **Step 1: Atualizar project-seed.test.ts**

Ler o arquivo `web/tests/domain/project-seed.test.ts` e localizar todos os asserts que verificam `project.construtora`, `project.obra`, etc.

Substituir:
```typescript
// ANTES:
expect(projects[0].construtora).toBe("18 DO FORTE");
expect(projects[0].obra).toBeDefined();
expect(projects[0].vendedor).toBeTruthy();

// DEPOIS:
expect(projects[0].construtoraId).toBeTruthy();
expect(projects[0].obraId).toBeTruthy();
expect(projects[0].vendedorId).toBeTruthy();
```

Se o teste verificava strings específicas de nome, substituir por verificações de formato de ID:
```typescript
expect(projects[0].construtoraId).toMatch(/^[a-z]-\d{3}$|^[A-Za-z0-9_-]{8}$/);
```

- [ ] **Step 2: Atualizar projects-store.test.ts**

No `web/tests/state/projects-store.test.ts`, localizar todos os `createProject(...)` e atualizar os campos de entrada:

```typescript
// ANTES:
const result = store.createProject({
  construtora: "TEST CONST",
  obra: "TEST OBRA",
  equipamento: "EK-15",
  vendedor: "RENATO",
  codigo_projeto: "TST-001",
  data_lancamento: "2026-01-01",
});

// DEPOIS:
const result = store.createProject({
  construtoraId: "c-test",
  obraId: "o-test",
  equipamentoId: "e-test",
  vendedorId: "v-test",
  codigo_projeto: "TST-001",
  data_lancamento: "2026-01-01",
});
```

Atualizar também qualquer verificação de `project.construtora` → `project.construtoraId`, etc.

- [ ] **Step 3: Atualizar tests/ui que usam project data**

Para cada arquivo em `tests/ui/` que cria ou acessa projetos, atualizar campos renomeados. Verificar em especial `projects-page.test.tsx` e `project-details-drawer.test.tsx`:

```typescript
// Se havia:
project.construtora = "ACRY"
// Substituir por:
project.construtoraId = "c-002"
```

Adicionar mock do `useMasterDataLookup` nos testes de UI que renderizam componentes que usam o hook:

```typescript
vi.mock("@/features/master-data/hooks/use-master-data-lookup", () => ({
  useMasterDataLookup: () => ({
    construtoraName: (id: string) => `Const-${id}`,
    obraName: (id: string) => `Obra-${id}`,
    vendedorName: (id: string) => `Vend-${id}`,
    equipamentoName: (id: string) => `Equip-${id}`,
    tipoCabineName: (id: string | undefined) => (id ? `Tipo-${id}` : ""),
    engenheiroName: (id: string | undefined) => (id ? `Eng-${id}` : ""),
  }),
}));
```

Adicionar também mock do `useMasterDataStore` para testes que renderizam o drawer:

```typescript
vi.mock("@/features/master-data/state/master-data-store", () => ({
  useMasterDataStore: () => ({
    construtoras: [],
    obras: [],
    equipamentos: [],
    tiposCabine: [],
    vendedores: [],
    engenheiros: [],
  }),
}));
```

- [ ] **Step 4: Rodar toda a suite**

```bash
npm test
```

Expected: todos os testes passando. Se algum falhar, ler a mensagem de erro e ajustar o mock/campo correspondente.

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "test: update all tests for Project type migration to ID fields"
```

---

### Task 7: Verificação final da Fase 3

- [ ] **Step 1: Verificar que project-directory.ts não é importado em lugar nenhum**

```bash
grep -r "project-directory" . --include="*.ts" --include="*.tsx" | grep -v ".git"
```

Expected: zero resultados.

- [ ] **Step 2: Rodar toda a suite de testes**

```bash
npm test
```

Expected: todos os testes passando.

- [ ] **Step 3: Verificar tipo**

```bash
npx tsc --noEmit
```

Expected: zero erros.

- [ ] **Step 4: Verificar lint**

```bash
npm run lint
```

Expected: sem erros.

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 6: Verificação manual**

Abrir `http://localhost:3000`:
- [ ] Tabela exibe nomes corretos (não IDs) em Construtora/Obra/Vendedor/Equipamento
- [ ] Drawer de detalhe exibe nomes corretos
- [ ] Kanban exibe nomes corretos nos cards
- [ ] KPIs/agrupamentos mostram nomes legíveis

- [ ] **Step 7: Commit final da fase**

```bash
git commit -m "feat: complete Phase 3 — Project type fully migrated to master-data IDs"
```

---

## Próxima fase

Após a Fase 3 estar verde, prosseguir com:

📄 `docs/superpowers/plans/2026-05-28-phase4-dropdown-integration-plan.md`
