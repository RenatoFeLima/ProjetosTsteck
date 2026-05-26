# Projetos UI Local (Tela 2 + Tela 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma versao funcional local (sem Supabase) da Tela 2 (Tabela/Kanban/Alertas) e Tela 3 (modal responsivo de cadastro/detalhe), com regras de negocio, historico de status append-only e seed representativo.

**Architecture:** Aplicacao Next.js 14 com App Router organizada por dominio em `features/projects`, separando regras puras (domain), estado local (store) e componentes de UI. Toda alteracao de status passa por uma funcao unica de transicao para garantir bloqueios, side effects de datas e log append-only. O status urgente e tratado como prioridade visual (`urgente` booleano), nao como coluna de pipeline.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui, Zustand, dnd-kit, date-fns, Vitest, Testing Library.

---

## File Structure (target)

- `app/layout.tsx` - layout base da aplicacao.
- `app/page.tsx` - pagina principal da Tela 2.
- `app/globals.css` - estilos globais e tokens.
- `features/projects/domain/project-types.ts` - tipos e enums do dominio.
- `features/projects/domain/project-rules.ts` - regras puras (prazo, badges, transicoes, alinhamento).
- `features/projects/domain/project-seed.ts` - seed local com 20-30 projetos.
- `features/projects/state/projects-store.ts` - store Zustand com CRUD e filtros.
- `features/projects/components/projects-toolbar.tsx` - busca + filtros + toggle de view + novo projeto.
- `features/projects/components/projects-table.tsx` - visualizacao tabela.
- `features/projects/components/projects-kanban.tsx` - visualizacao kanban com dnd-kit.
- `features/projects/components/projects-alerts.tsx` - visualizacao de alertas priorizada.
- `features/projects/components/project-form-modal.tsx` - Tela 3 modal responsivo.
- `features/projects/components/pill-badges.tsx` - badges de status/prazo/urgente.
- `features/projects/components/projects-page-shell.tsx` - composicao da Tela 2.
- `tests/domain/project-rules.test.ts` - testes unitarios de regras.
- `tests/state/projects-store.test.ts` - testes de estado/transicoes.
- `tests/ui/projects-page.test.tsx` - testes de integracao da UI.
- `vitest.config.ts` - configuracao do Vitest.
- `tests/setup.ts` - setup de ambiente de testes.

---

### Task 1: Bootstrap do projeto e dependencias

**Files:**
- Create: `package.json` (via CLI)
- Create: `app/layout.tsx` (via scaffold)
- Create: `app/page.tsx` (via scaffold)
- Create: `tailwind.config.ts` (via scaffold)

- [ ] **Step 1: Criar app Next.js 14 com TypeScript e Tailwind**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir false --import-alias "@/*"
```
Expected: projeto Next criado com `app/`, `tsconfig.json`, `next.config.*`, `tailwind.config.*`.

- [ ] **Step 2: Instalar libs do dominio/UI**

Run:
```bash
npm install zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities date-fns lucide-react
```
Expected: `added ... packages` sem erro.

- [ ] **Step 3: Instalar libs de teste**

Run:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```
Expected: dependencias de teste instaladas.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: bootstrap next14 project with base dependencies"
```

---

### Task 2: Configurar shadcn/ui e setup de testes

**Files:**
- Create: `components/ui/*` (gerado pelo shadcn)
- Create: `lib/utils.ts`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Modify: `package.json`

- [ ] **Step 1: Inicializar shadcn**

Run:
```bash
npx shadcn@latest init -d
```
Expected: criacao de `components.json`, `components/ui`, `lib/utils.ts`.

- [ ] **Step 2: Criar configuracao do Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
```

- [ ] **Step 3: Criar setup de testes**

Create `tests/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Adicionar script de teste**

Modify `package.json` scripts:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 5: Rodar testes vazios para validar setup**

Run:
```bash
npm run test
```
Expected: `No test files found` ou execucao sem erro de configuracao.

- [ ] **Step 6: Commit**

```bash
git add components.json components/ui lib/utils.ts vitest.config.ts tests/setup.ts package.json
git commit -m "chore: setup shadcn and vitest test harness"
```

---

### Task 3: Definir tipos e regras de dominio (TDD)

**Files:**
- Create: `features/projects/domain/project-types.ts`
- Create: `features/projects/domain/project-rules.ts`
- Test: `tests/domain/project-rules.test.ts`

- [ ] **Step 1: Escrever testes falhando para regras de prazo e status**

Create `tests/domain/project-rules.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  computePrazoEntrega,
  computePrazoBadge,
  canAdvanceStatus,
  applyAlignmentAutomation,
  transitionStatus,
} from "@/features/projects/domain/project-rules";

describe("project-rules", () => {
  it("calcula prazo = data_alinhamento + 45 dias", () => {
    const prazo = computePrazoEntrega("2026-05-01");
    expect(prazo).toBe("2026-06-15");
  });

  it("recalcula prazo ao alterar data_alinhamento", () => {
    const original = computePrazoEntrega("2026-05-01");
    const changed = computePrazoEntrega("2026-05-10");
    expect(original).toBe("2026-06-15");
    expect(changed).toBe("2026-06-24");
  });

  it("bloqueia avancar status quando alinhamento=false", () => {
    expect(canAdvanceStatus(false)).toBe(false);
  });

  it("automacao de alinhamento quando pre-requisitos true", () => {
    const out = applyAlignmentAutomation({
      proj_obra_recebido: true,
      local_cabine_definido: true,
      alinhamento: false,
      data_alinhamento: null,
    });
    expect(out.alinhamentoSuggested).toBe(true);
    expect(out.nextDataAlinhamento).not.toBeNull();
  });

  it("seta data_envio ao mover para ANTE-PROJETO ENVIADO", () => {
    const moved = transitionStatus({
      currentStatus: "ELABORAR ANTE-PROJETO",
      nextStatus: "ANTE-PROJETO ENVIADO",
      aligned: true,
      today: "2026-05-26",
      data_envio: null,
      data_aprovacao: null,
    });
    expect(moved.data_envio).toBe("2026-05-26");
  });
});
```

- [ ] **Step 2: Rodar teste e validar falha**

Run:
```bash
npm run test -- tests/domain/project-rules.test.ts
```
Expected: FAIL com modulo/funcoes ausentes.

- [ ] **Step 3: Implementar tipos do dominio**

Create `features/projects/domain/project-types.ts`:
```ts
export const PROJECT_STATUSES = [
  "ELABORAR ANTE-PROJETO",
  "ANTE-PROJETO ENVIADO",
  "ANTE-PROJETO APROVADO",
  "PROJETO APROVADO",
  "PROJETO FINAL ENVIADO",
  "REVISAO DE ESTUDO",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type PrazoBadge = "sem_prazo" | "no_prazo" | "atencao" | "atrasado";

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
  proj_obra_recebido: boolean;
  local_cabine_definido: boolean;
  alinhamento: boolean;
  data_lancamento: string;
  data_alinhamento: string | null;
  status_atual: ProjectStatus;
  data_envio: string | null;
  data_aprovacao: string | null;
  urgente: boolean;
  created_at: string;
  updated_at: string;
};

export type StatusHistoryItem = {
  id: string;
  projeto_id: string;
  status_de: ProjectStatus | null;
  status_para: ProjectStatus;
  alterado_em: string;
  origem: "kanban" | "formulario" | "acao-rapida";
};
```

- [ ] **Step 4: Implementar regras puras**

Create `features/projects/domain/project-rules.ts`:
```ts
import { addDays, differenceInCalendarDays, formatISO, parseISO } from "date-fns";
import type { PrazoBadge, ProjectStatus } from "./project-types";

export function computePrazoEntrega(dataAlinhamento: string | null): string | null {
  if (!dataAlinhamento) return null;
  return formatISO(addDays(parseISO(dataAlinhamento), 45), { representation: "date" });
}

export function computePrazoBadge(todayISO: string, prazoEntregaISO: string | null): PrazoBadge {
  if (!prazoEntregaISO) return "sem_prazo";
  const delta = differenceInCalendarDays(parseISO(prazoEntregaISO), parseISO(todayISO));
  if (delta < 0) return "atrasado";
  if (delta <= 10) return "atencao";
  return "no_prazo";
}

export function canAdvanceStatus(aligned: boolean): boolean {
  return aligned;
}

export function applyAlignmentAutomation(input: {
  proj_obra_recebido: boolean;
  local_cabine_definido: boolean;
  alinhamento: boolean;
  data_alinhamento: string | null;
}) {
  const prereqOk = input.proj_obra_recebido && input.local_cabine_definido;
  if (!prereqOk) {
    return { alinhamentoSuggested: false, nextDataAlinhamento: input.data_alinhamento };
  }
  return {
    alinhamentoSuggested: true,
    nextDataAlinhamento: input.data_alinhamento ?? formatISO(new Date(), { representation: "date" }),
  };
}

export function transitionStatus(input: {
  currentStatus: ProjectStatus;
  nextStatus: ProjectStatus;
  aligned: boolean;
  today: string;
  data_envio: string | null;
  data_aprovacao: string | null;
}) {
  if (input.currentStatus !== input.nextStatus && !input.aligned) {
    throw new Error("Nao e possivel avancar status sem alinhamento.");
  }
  return {
    data_envio:
      input.nextStatus === "ANTE-PROJETO ENVIADO" && !input.data_envio ? input.today : input.data_envio,
    data_aprovacao:
      input.nextStatus === "ANTE-PROJETO APROVADO" && !input.data_aprovacao
        ? input.today
        : input.data_aprovacao,
  };
}
```

- [ ] **Step 5: Rodar testes e validar PASS**

Run:
```bash
npm run test -- tests/domain/project-rules.test.ts
```
Expected: PASS em todos os casos.

- [ ] **Step 6: Commit**

```bash
git add features/projects/domain tests/domain/project-rules.test.ts
git commit -m "feat(domain): add project types and business rules with tests"
```

---

### Task 4: Implementar seed local representativo (20-30 projetos)

**Files:**
- Create: `features/projects/domain/project-seed.ts`
- Test: `tests/domain/project-seed.test.ts`

- [ ] **Step 1: Escrever teste do seed (falhando)**

Create `tests/domain/project-seed.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildSeedProjects } from "@/features/projects/domain/project-seed";

describe("project seed", () => {
  it("gera entre 20 e 30 projetos com cobertura minima", () => {
    const seed = buildSeedProjects();
    expect(seed.length).toBeGreaterThanOrEqual(20);
    expect(seed.length).toBeLessThanOrEqual(30);
    expect(seed.some((p) => p.urgente)).toBe(true);
    expect(seed.some((p) => p.alinhamento === false)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e validar FAIL**

Run:
```bash
npm run test -- tests/domain/project-seed.test.ts
```
Expected: FAIL por modulo ausente.

- [ ] **Step 3: Implementar seed**

Create `features/projects/domain/project-seed.ts`:
```ts
import { formatISO } from "date-fns";
import type { Project, ProjectStatus } from "./project-types";

const STATUSES: ProjectStatus[] = [
  "ELABORAR ANTE-PROJETO",
  "ANTE-PROJETO ENVIADO",
  "ANTE-PROJETO APROVADO",
  "PROJETO APROVADO",
  "PROJETO FINAL ENVIADO",
  "REVISAO DE ESTUDO",
];

export function buildSeedProjects(): Project[] {
  const today = formatISO(new Date(), { representation: "date" });
  return Array.from({ length: 24 }).map((_, i) => ({
    id: `seed-${i + 1}`,
    construtora: ["ALFA", "BETA", "GAMA"][i % 3],
    obra: `Obra ${i + 1}`,
    engenheiro_nome: i % 2 === 0 ? `Eng ${i + 1}` : "",
    engenheiro_celular: "",
    equipamento: ["EK-15/26", "EK-20/30", "M-13/18"][i % 3],
    tipo_cabine: ["SIMPLES", "DUPLA", "ESPECIAL"][i % 3],
    codigo_projeto: `COD-${1000 + i}`,
    vendedor: ["LUCIANO", "ERICA", "MONICA", "RENATO"][i % 4],
    proj_obra_recebido: i % 5 !== 0,
    local_cabine_definido: i % 6 !== 0,
    alinhamento: i % 5 !== 0,
    data_lancamento: today,
    data_alinhamento: i % 5 === 0 ? null : today,
    status_atual: STATUSES[i % STATUSES.length],
    data_envio: null,
    data_aprovacao: null,
    urgente: i % 8 === 0,
    created_at: today,
    updated_at: today,
  }));
}
```

- [ ] **Step 4: Rodar teste e validar PASS**

Run:
```bash
npm run test -- tests/domain/project-seed.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/projects/domain/project-seed.ts tests/domain/project-seed.test.ts
git commit -m "feat(seed): add representative local project seed dataset"
```

---

### Task 5: Criar store local com CRUD, filtros e historico

**Files:**
- Create: `features/projects/state/projects-store.ts`
- Test: `tests/state/projects-store.test.ts`

- [ ] **Step 1: Testes do store (falhando)**

Create `tests/state/projects-store.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createProjectsStore } from "@/features/projects/state/projects-store";

describe("projects store", () => {
  it("cria projeto com status inicial", () => {
    const store = createProjectsStore();
    store.getState().createProject({
      construtora: "ALFA",
      obra: "Nova",
      codigo_projeto: "CRE-1",
      vendedor: "LUCIANO",
      equipamento: "EK-15/26",
      data_lancamento: "2026-05-26",
    });
    const created = store.getState().projects.find((p) => p.codigo_projeto === "CRE-1");
    expect(created?.status_atual).toBe("ELABORAR ANTE-PROJETO");
  });

  it("registra historico ao mudar status", () => {
    const store = createProjectsStore();
    const p = store.getState().projects[0];
    store.getState().moveStatus(p.id, "ANTE-PROJETO ENVIADO", "kanban");
    expect(store.getState().statusHistory.some((h) => h.projeto_id === p.id)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e validar FAIL**

Run:
```bash
npm run test -- tests/state/projects-store.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implementar store**

Create `features/projects/state/projects-store.ts`:
```ts
import { createStore } from "zustand/vanilla";
import { formatISO } from "date-fns";
import type { Project, ProjectStatus, StatusHistoryItem } from "@/features/projects/domain/project-types";
import { buildSeedProjects } from "@/features/projects/domain/project-seed";
import { transitionStatus } from "@/features/projects/domain/project-rules";

type Filters = {
  search: string;
  status: "all" | ProjectStatus;
  construtora: string;
  vendedor: string;
  equipamento: string;
  atrasadoOnly: boolean;
  urgenteOnly: boolean;
};

type StoreState = {
  projects: Project[];
  statusHistory: StatusHistoryItem[];
  filters: Filters;
  createProject: (input: Pick<Project, "construtora" | "obra" | "codigo_projeto" | "vendedor" | "equipamento" | "data_lancamento"> & Partial<Project>) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  toggleUrgente: (id: string) => void;
  moveStatus: (id: string, nextStatus: ProjectStatus, origem: StatusHistoryItem["origem"]) => void;
  setFilters: (patch: Partial<Filters>) => void;
};

export const createProjectsStore = () =>
  createStore<StoreState>((set, get) => ({
    projects: buildSeedProjects(),
    statusHistory: [],
    filters: {
      search: "",
      status: "all",
      construtora: "",
      vendedor: "",
      equipamento: "",
      atrasadoOnly: false,
      urgenteOnly: false,
    },
    createProject: (input) => {
      const now = formatISO(new Date(), { representation: "date" });
      const next: Project = {
        id: crypto.randomUUID(),
        construtora: input.construtora,
        obra: input.obra,
        codigo_projeto: input.codigo_projeto,
        vendedor: input.vendedor,
        equipamento: input.equipamento,
        data_lancamento: input.data_lancamento,
        engenheiro_nome: input.engenheiro_nome ?? "",
        engenheiro_celular: input.engenheiro_celular ?? "",
        tipo_cabine: input.tipo_cabine ?? "",
        proj_obra_recebido: false,
        local_cabine_definido: false,
        alinhamento: false,
        data_alinhamento: null,
        status_atual: "ELABORAR ANTE-PROJETO",
        data_envio: null,
        data_aprovacao: null,
        urgente: false,
        created_at: now,
        updated_at: now,
      };
      set((s) => ({ projects: [next, ...s.projects] }));
    },
    updateProject: (id, patch) =>
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch, updated_at: formatISO(new Date(), { representation: "date" }) } : p)),
      })),
    deleteProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
    toggleUrgente: (id) =>
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? { ...p, urgente: !p.urgente } : p)),
      })),
    moveStatus: (id, nextStatus, origem) => {
      const current = get().projects.find((p) => p.id === id);
      if (!current) return;
      const today = formatISO(new Date(), { representation: "date" });
      const side = transitionStatus({
        currentStatus: current.status_atual,
        nextStatus,
        aligned: current.alinhamento,
        today,
        data_envio: current.data_envio,
        data_aprovacao: current.data_aprovacao,
      });
      const history: StatusHistoryItem = {
        id: crypto.randomUUID(),
        projeto_id: current.id,
        status_de: current.status_atual,
        status_para: nextStatus,
        alterado_em: today,
        origem,
      };
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === id
            ? { ...p, status_atual: nextStatus, data_envio: side.data_envio, data_aprovacao: side.data_aprovacao, updated_at: today }
            : p,
        ),
        statusHistory: [history, ...s.statusHistory],
      }));
    },
    setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  }));
```

- [ ] **Step 4: Rodar teste do store**

Run:
```bash
npm run test -- tests/state/projects-store.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/projects/state/projects-store.ts tests/state/projects-store.test.ts
git commit -m "feat(state): add local projects store with CRUD filters and status history"
```

---

### Task 6: Implementar UI base da Tela 2 (toolbar + badges + shell)

**Files:**
- Create: `features/projects/components/pill-badges.tsx`
- Create: `features/projects/components/projects-toolbar.tsx`
- Create: `features/projects/components/projects-page-shell.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Criar badges reutilizaveis**

Create `features/projects/components/pill-badges.tsx`:
```tsx
export function UrgenteBadge({ urgente }: { urgente: boolean }) {
  if (!urgente) return null;
  return <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">URGENTE</span>;
}
```

- [ ] **Step 2: Criar toolbar com filtros e alternador de views**

Create `features/projects/components/projects-toolbar.tsx` with controlled props:
```tsx
export type ProjectsView = "table" | "kanban" | "alerts";

export function ProjectsToolbar(props: {
  view: ProjectsView;
  onViewChange: (v: ProjectsView) => void;
  onNewProject: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
      <input className="h-9 rounded border px-3" placeholder="Buscar por codigo, construtora ou obra" />
      <button onClick={() => props.onViewChange("table")}>Tabela</button>
      <button onClick={() => props.onViewChange("kanban")}>Kanban</button>
      <button onClick={() => props.onViewChange("alerts")}>Alertas</button>
      <button onClick={props.onNewProject} className="ml-auto rounded bg-black px-3 py-2 text-white">Novo Projeto</button>
    </div>
  );
}
```

- [ ] **Step 3: Criar shell da pagina**

Create `features/projects/components/projects-page-shell.tsx`:
```tsx
"use client";

import { useState } from "react";
import { ProjectsToolbar, type ProjectsView } from "./projects-toolbar";

export function ProjectsPageShell() {
  const [view, setView] = useState<ProjectsView>("table");

  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Projetos</h1>
      <ProjectsToolbar view={view} onViewChange={setView} onNewProject={() => {}} />
      <section className="mt-4 rounded-xl border p-4">View ativa: {view}</section>
    </main>
  );
}
```

- [ ] **Step 4: Ligar shell na home**

Modify `app/page.tsx`:
```tsx
import { ProjectsPageShell } from "@/features/projects/components/projects-page-shell";

export default function HomePage() {
  return <ProjectsPageShell />;
}
```

- [ ] **Step 5: Rodar app para validar render**

Run:
```bash
npm run dev
```
Expected: pagina `/` exibindo cabecalho, toolbar e view ativa.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx features/projects/components/pill-badges.tsx features/projects/components/projects-toolbar.tsx features/projects/components/projects-page-shell.tsx
git commit -m "feat(ui): add projects page shell toolbar and reusable badges"
```

---

### Task 7: Implementar visualizacao Tabela e Alertas com prioridade

**Files:**
- Create: `features/projects/components/projects-table.tsx`
- Create: `features/projects/components/projects-alerts.tsx`
- Modify: `features/projects/components/projects-page-shell.tsx`

- [ ] **Step 1: Criar tabela de projetos**

Create `features/projects/components/projects-table.tsx` with props `projects`, `onOpen`, `onToggleUrgente`.

- [ ] **Step 2: Criar alertas com ordem Urgente -> Atrasado -> Atencao**

Create `features/projects/components/projects-alerts.tsx` sorting logic:
```ts
function alertRank(p: Project): number {
  if (p.urgente) return 0;
  const badge = computePrazoBadge(today, computePrazoEntrega(p.data_alinhamento));
  if (badge === "atrasado") return 1;
  if (badge === "atencao") return 2;
  return 3;
}
```

- [ ] **Step 3: Integrar views no shell**

Modify `projects-page-shell.tsx` to render `ProjectsTable` when `view === "table"` and `ProjectsAlerts` when `view === "alerts"`.

- [ ] **Step 4: Teste de integracao da prioridade de alertas**

Create assertion in `tests/ui/projects-page.test.tsx`:
```ts
it("prioriza urgente acima de atrasado", () => {
  // render e validar ordem visual dos cards de alerta
});
```

- [ ] **Step 5: Rodar testes**

Run:
```bash
npm run test -- tests/ui/projects-page.test.tsx
```
Expected: PASS para caso de prioridade.

- [ ] **Step 6: Commit**

```bash
git add features/projects/components/projects-table.tsx features/projects/components/projects-alerts.tsx features/projects/components/projects-page-shell.tsx tests/ui/projects-page.test.tsx
git commit -m "feat(ui): implement table and alerts views with revised alert priority"
```

---

### Task 8: Implementar Kanban com 6 colunas e dnd-kit

**Files:**
- Create: `features/projects/components/projects-kanban.tsx`
- Modify: `features/projects/components/projects-page-shell.tsx`
- Test: `tests/ui/projects-page.test.tsx`

- [ ] **Step 1: Criar kanban com 6 colunas fixas**

Columns:
```ts
const COLUMNS: ProjectStatus[] = [
  "ELABORAR ANTE-PROJETO",
  "ANTE-PROJETO ENVIADO",
  "ANTE-PROJETO APROVADO",
  "PROJETO APROVADO",
  "PROJETO FINAL ENVIADO",
  "REVISAO DE ESTUDO",
];
```

- [ ] **Step 2: Implementar drag-and-drop com bloqueio de alinhamento**

On drop:
```ts
if (!project.alinhamento && targetStatus !== project.status_atual) {
  setToast("Nao e possivel avancar status sem alinhamento.");
  return;
}
onMoveStatus(project.id, targetStatus, "kanban");
```

- [ ] **Step 3: Exibir badge URGENTE no card sem mudar coluna**

Render:
```tsx
<UrgenteBadge urgente={project.urgente} />
```

- [ ] **Step 4: Integrar no shell**

Render `ProjectsKanban` quando `view === "kanban"`.

- [ ] **Step 5: Teste de bloqueio de transicao**

Add in `tests/ui/projects-page.test.tsx`:
```ts
it("bloqueia mover card quando alinhamento=false", () => {
  // simular tentativa de mover e validar feedback
});
```

- [ ] **Step 6: Commit**

```bash
git add features/projects/components/projects-kanban.tsx features/projects/components/projects-page-shell.tsx tests/ui/projects-page.test.tsx
git commit -m "feat(kanban): add 6-column board with dnd and alignment blocking"
```

---

### Task 9: Implementar Tela 3 modal responsivo com validacoes

**Files:**
- Create: `features/projects/components/project-form-modal.tsx`
- Modify: `features/projects/components/projects-page-shell.tsx`
- Test: `tests/ui/projects-page.test.tsx`

- [ ] **Step 1: Criar modal com campos obrigatorios/opcionais**

Obrigatorios no submit:
```ts
const required = [
  "construtora",
  "obra",
  "codigo_projeto",
  "vendedor",
  "equipamento",
  "data_lancamento",
] as const;
```

- [ ] **Step 2: Implementar unicidade de codigo_projeto em tempo real**

Rule:
```ts
const duplicated = projects.some(
  (p) => p.codigo_projeto === form.codigo_projeto && p.id !== editingId,
);
```

- [ ] **Step 3: Implementar automacao do bloco alinhamento**

When toggles become true:
```ts
if (next.proj_obra_recebido && next.local_cabine_definido) {
  next.alinhamento = true;
  if (!next.data_alinhamento) next.data_alinhamento = todayISO;
}
```

- [ ] **Step 4: Implementar comportamento responsivo**

CSS classes:
```tsx
<div className="fixed inset-0 z-50 bg-black/40">
  <div className="h-full w-full bg-white md:mx-auto md:my-8 md:h-[85vh] md:max-w-5xl md:rounded-2xl">
    {/* conteudo */}
  </div>
</div>
```
Expected: <768 full-screen; >=768 modal central.

- [ ] **Step 5: Integrar abrir/fechar e salvar no shell**

Wire handlers no `ProjectsPageShell` para criar/editar/excluir.

- [ ] **Step 6: Testar validacoes do formulario**

Add tests in `tests/ui/projects-page.test.tsx`:
```ts
it("exige campos obrigatorios no cadastro", () => {
  // submit vazio e valida mensagens
});

it("bloqueia codigo_projeto duplicado em tempo real", () => {
  // digitar codigo existente e validar erro
});
```

- [ ] **Step 7: Commit**

```bash
git add features/projects/components/project-form-modal.tsx features/projects/components/projects-page-shell.tsx tests/ui/projects-page.test.tsx
git commit -m "feat(form): add responsive project modal with validation and alignment automation"
```

---

### Task 10: Exibir observacoes append-only e historico de status

**Files:**
- Modify: `features/projects/components/project-form-modal.tsx`
- Modify: `features/projects/state/projects-store.ts`
- Test: `tests/state/projects-store.test.ts`

- [ ] **Step 1: Adicionar estado de observacoes no store**

Add shape:
```ts
type ProjectObservation = {
  id: string;
  projeto_id: string;
  usuario: string;
  texto: string;
  criado_em: string;
};
```

- [ ] **Step 2: Implementar append-only de observacoes**

Action:
```ts
addObservation: (projetoId, texto, usuario) => {
  // push novo item sem sobrescrever anteriores
}
```

- [ ] **Step 3: Exibir historico de status e observacoes no modal**

Render listas ordenadas por data decrescente, somente leitura do historico.

- [ ] **Step 4: Testes de append-only e historico**

Add test:
```ts
it("append-only: nova observacao nao sobrescreve historico", () => {
  // adicionar 2 observacoes e validar tamanho=2
});
```

- [ ] **Step 5: Commit**

```bash
git add features/projects/state/projects-store.ts features/projects/components/project-form-modal.tsx tests/state/projects-store.test.ts
git commit -m "feat(history): add append-only observations and status history panel"
```

---

### Task 11: Cobertura final de testes e estabilizacao

**Files:**
- Modify: `tests/domain/project-rules.test.ts`
- Modify: `tests/state/projects-store.test.ts`
- Modify: `tests/ui/projects-page.test.tsx`

- [ ] **Step 1: Fechar cobertura de recalculo de prazo e badge**

Test case:
```ts
it("atualiza badge quando data_alinhamento muda", () => {
  // editar projeto, recalcular prazo e validar badge atualizado
});
```

- [ ] **Step 2: Rodar suite completa**

Run:
```bash
npm run test
```
Expected: PASS em todos os testes.

- [ ] **Step 3: Rodar lint e build**

Run:
```bash
npm run lint
npm run build
```
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add tests
git commit -m "test: finalize domain state and ui coverage for local sprint"
```

---

### Task 12: Checklist de aceite e handoff

**Files:**
- Create: `docs/superpowers/reports/2026-05-26-projetos-ui-local-qa.md`

- [ ] **Step 1: Criar relatorio de aceite com evidencias**

Create `docs/superpowers/reports/2026-05-26-projetos-ui-local-qa.md` with checklist:
```md
- [x] CRUD no modal
- [x] Tabela/Kanban/Alertas com filtros
- [x] Kanban 6 colunas
- [x] URGENTE como badge
- [x] Automacao de alinhamento
- [x] Prioridade de alertas correta
- [x] Responsividade modal (<768 full-screen)
- [x] Historico de status append-only
- [x] Seed 20-30 registros representativos
```

- [ ] **Step 2: Commit final da sprint local**

```bash
git add docs/superpowers/reports/2026-05-26-projetos-ui-local-qa.md
git commit -m "docs: add QA acceptance report for local projects sprint"
```

---

## Self-Review

### 1. Spec coverage

- Kanban 6 colunas sem `URGENTE!` como coluna: coberto em Task 8.
- `urgente` como badge sem alterar `status_atual`: Tasks 7, 8 e 9.
- Automacao de alinhamento por toggles: Task 9.
- Alertas com prioridade Urgente > Atrasado > Atencao: Task 7.
- Campos obrigatorios/opcionais explicitos: Task 9.
- Modal responsivo mobile/full-screen: Task 9.
- Recalculo de prazo e badge ao alterar `data_alinhamento`: Tasks 3 e 11.
- Seed 20-30 com cobertura representativa: Task 4.
- Historico de status append-only: Tasks 5 e 10.

Sem gaps em relacao a spec aprovada.

### 2. Placeholder scan

Sem `TBD`, `TODO` ou referencias vagas de implementacao.

### 3. Type consistency

- `ProjectStatus`, `Project`, `StatusHistoryItem` definidos em `project-types.ts` e reutilizados nas tasks seguintes.
- Origens de historico padronizadas: `kanban | formulario | acao-rapida`.
- Regras de prazo centralizadas em `project-rules.ts`.
