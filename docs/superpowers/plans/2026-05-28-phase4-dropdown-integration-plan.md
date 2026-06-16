# Fase 4 — Dropdown Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Pré-requisito:** Fase 3 completa, todos os testes passando, tipo `Project` totalmente migrado para IDs.

**Goal:** Conectar os formulários e filtros de projetos ao master data store — `project-form-modal.tsx` passa a oferecer dropdowns dinâmicos vindos do `useMasterDataStore`, obras filtradas por construtora selecionada, e `projects-toolbar.tsx` passa a filtrar por IDs em vez de strings.

**Architecture:** Fase 4 toca apenas em `project-form-modal.tsx`, `projects-toolbar.tsx` e `projects-kpi-dashboard.tsx`. Não há criação de tipos novos. Não há migration de dados.

---

## File Structure

| Operação | Arquivo |
|---|---|
| MODIFY | `features/projects/components/project-form-modal.tsx` |
| MODIFY | `features/projects/components/projects-toolbar.tsx` |
| MODIFY | `features/projects/components/projects-kpi-dashboard.tsx` |
| MODIFY | `tests/ui/project-form-modal.test.tsx` |
| CREATE | `tests/ui/projects-toolbar.test.tsx` |

---

### Task 1: Atualizar `project-form-modal.tsx`

**Files:**
- Modify: `features/projects/components/project-form-modal.tsx`

- [ ] **Step 1: Ler o arquivo atual para entender a estrutura completa**

```bash
cat features/projects/components/project-form-modal.tsx
```

Identificar:
- Lista de imports atuais
- Como o formulário armazena estado (`useState`)
- Quais campos usam `PRESET_*` listas
- Como `SearchableCombobox` é chamado
- Como `obras` são filtradas por construtora atualmente

- [ ] **Step 2: Remover imports de project-directory.ts**

Remover linhas que importam qualquer `PRESET_*`:
```typescript
// REMOVER:
import {
  PRESET_CONSTRUTORAS,
  PRESET_OBRAS,
  PRESET_OBRAS_BY_CONSTRUTORA,
  PRESET_VENDEDORES,
  PRESET_EQUIPAMENTOS,
} from "@/features/projects/domain/project-directory";
```

- [ ] **Step 3: Adicionar import do master data store**

```typescript
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";
```

- [ ] **Step 4: Conectar os selectors ao formulário**

Dentro do componente, substituir as listas fixas por seletores do store:

```typescript
const masterStore = useMasterDataStore();

// Dropdowns dinâmicos
const construtoraOptions = masterStore.activeConstrutoras();
const obraOptions = masterStore.activeObras(formData.construtoraId);
const vendedorOptions = masterStore.activeVendedores();
const equipamentoOptions = masterStore.activeEquipamentos();
const tipoCabineOptions = masterStore.activeTiposCabine();
const engenheiroOptions = masterStore.activeEngenheiros();
```

- [ ] **Step 5: Atualizar campos do formulário**

Para cada `SearchableCombobox` (ou `<select>`) no formulário, atualizar:

```tsx
// Construtora
<SearchableCombobox
  label="Construtora"
  value={formData.construtoraId ?? ""}
  options={construtoraOptions.map((c) => ({ value: c.id, label: c.name }))}
  onChange={(value) => {
    // Ao mudar construtora, limpar obra se não pertencer mais
    const currentObra = masterStore.obras.find((o) => o.id === formData.obraId);
    const newObraId = currentObra?.construtoraId === value ? formData.obraId : "";
    setFormData((prev) => ({ ...prev, construtoraId: value, obraId: newObraId }));
    setIsDirty(true);
  }}
  required
/>

// Obra — filtrada por construtora selecionada
<SearchableCombobox
  label="Obra"
  value={formData.obraId ?? ""}
  options={obraOptions.map((o) => ({ value: o.id, label: o.name }))}
  onChange={(value) => { setFormData((prev) => ({ ...prev, obraId: value })); setIsDirty(true); }}
  disabled={!formData.construtoraId}
  required
/>

// Vendedor
<SearchableCombobox
  label="Vendedor"
  value={formData.vendedorId ?? ""}
  options={vendedorOptions.map((v) => ({ value: v.id, label: v.name }))}
  onChange={(value) => { setFormData((prev) => ({ ...prev, vendedorId: value })); setIsDirty(true); }}
  required
/>

// Equipamento
<SearchableCombobox
  label="Equipamento"
  value={formData.equipamentoId ?? ""}
  options={equipamentoOptions.map((e) => ({ value: e.id, label: e.code }))}
  onChange={(value) => { setFormData((prev) => ({ ...prev, equipamentoId: value })); setIsDirty(true); }}
  required
/>

// Tipo Cabine (opcional)
<SearchableCombobox
  label="Tipo de Cabine"
  value={formData.tipoCabineId ?? ""}
  options={[{ value: "", label: "—" }, ...tipoCabineOptions.map((t) => ({ value: t.id, label: t.name }))]}
  onChange={(value) => { setFormData((prev) => ({ ...prev, tipoCabineId: value || undefined })); setIsDirty(true); }}
/>

// Engenheiro (opcional)
<SearchableCombobox
  label="Engenheiro"
  value={formData.engenheiroId ?? ""}
  options={[{ value: "", label: "—" }, ...engenheiroOptions.map((e) => ({ value: e.id, label: e.name }))]}
  onChange={(value) => { setFormData((prev) => ({ ...prev, engenheiroId: value || undefined })); setIsDirty(true); }}
/>
```

**Nota:** O campo `engenheiro_celular` era input de texto livre no formulário antigo. Na nova arquitetura, o telefone vem do cadastro do engenheiro — remover o campo `engenheiro_celular` do formulário. Remover também os campos `engenheiro_nome` e `engenheiro_celular` do objeto `formData`.

- [ ] **Step 6: Verificar a API de SearchableCombobox**

```bash
grep -n "type\|Props\|export" features/projects/components/searchable-combobox.tsx | head -20
```

Ajustar as props conforme a API real do componente se necessário.

- [ ] **Step 7: Verificar a validação de `handleSave`**

Atualizar a validação dos campos obrigatórios:
```typescript
// ANTES:
if (!formData.construtora?.trim()) return setError("...");
if (!formData.obra?.trim()) return setError("...");
if (!formData.vendedor?.trim()) return setError("...");
if (!formData.equipamento?.trim()) return setError("...");

// DEPOIS:
if (!formData.construtoraId) return setError("Construtora é obrigatória.");
if (!formData.obraId) return setError("Obra é obrigatória.");
if (!formData.vendedorId) return setError("Vendedor é obrigatório.");
if (!formData.equipamentoId) return setError("Equipamento é obrigatório.");
```

- [ ] **Step 8: Verificar erros de tipo**

```bash
npx tsc --noEmit 2>&1 | grep "project-form-modal" | head -20
```

Expected: zero erros.

- [ ] **Step 9: Commit**

```bash
git add features/projects/components/project-form-modal.tsx
git commit -m "feat: connect project-form-modal to master-data store with dynamic dropdowns"
```

---

### Task 2: Atualizar `projects-toolbar.tsx`

**Files:**
- Modify: `features/projects/components/projects-toolbar.tsx`

- [ ] **Step 1: Ler o arquivo atual**

```bash
cat features/projects/components/projects-toolbar.tsx
```

Identificar:
- Como filtros são chamados (`setFilters`, `filters`)
- Quais campos de filtro existem (os que foram migrados para `construtoraId`, etc.)
- Como dropdowns de construtora/obra/vendedor/equipamento são renderizados

- [ ] **Step 2: Remover imports de project-directory.ts**

Remover imports de `PRESET_CONSTRUTORAS`, `PRESET_OBRAS`, `PRESET_VENDEDORES`, `PRESET_EQUIPAMENTOS`.

- [ ] **Step 3: Adicionar import do master data store**

```typescript
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";
```

- [ ] **Step 4: Substituir listas fixas por seletores dinâmicos**

```typescript
const masterStore = useMasterDataStore();

// Usar no lugar dos PRESET_*:
const construtoraOptions = masterStore.activeConstrutoras();
const obraOptions = masterStore.activeObras(filters.construtoraId || undefined);
const vendedorOptions = masterStore.activeVendedores();
const equipamentoOptions = masterStore.activeEquipamentos();
```

- [ ] **Step 5: Atualizar os filtros emitidos**

Substituir:
```tsx
// ANTES:
onChange({ construtora: value })
onChange({ obra: value })
onChange({ vendedor: value })
onChange({ equipamento: value })

// DEPOIS:
onChange({ construtoraId: value })
onChange({ obraId: value })
onChange({ vendedorId: value })
onChange({ equipamentoId: value })
```

- [ ] **Step 6: Atualizar os dropdowns/selects para usar IDs como valores**

```tsx
// Construtora
<select
  value={filters.construtoraId ?? ""}
  onChange={(e) => {
    // Ao mudar construtora, limpar obra
    onChange({ construtoraId: e.target.value, obraId: "" });
  }}
>
  <option value="">Todas</option>
  {construtoraOptions.map((c) => (
    <option key={c.id} value={c.id}>{c.name}</option>
  ))}
</select>

// Obra — filtrada por construtoraId selecionado
<select
  value={filters.obraId ?? ""}
  onChange={(e) => onChange({ obraId: e.target.value })}
  disabled={!filters.construtoraId}
>
  <option value="">Todas</option>
  {obraOptions.map((o) => (
    <option key={o.id} value={o.id}>{o.name}</option>
  ))}
</select>

// Vendedor
<select
  value={filters.vendedorId ?? ""}
  onChange={(e) => onChange({ vendedorId: e.target.value })}
>
  <option value="">Todos</option>
  {vendedorOptions.map((v) => (
    <option key={v.id} value={v.id}>{v.name}</option>
  ))}
</select>

// Equipamento
<select
  value={filters.equipamentoId ?? ""}
  onChange={(e) => onChange({ equipamentoId: e.target.value })}
>
  <option value="">Todos</option>
  {equipamentoOptions.map((e) => (
    <option key={e.id} value={e.id}>{e.code}</option>
  ))}
</select>
```

**Nota:** Se a toolbar usa `SearchableCombobox` em vez de `<select>`, adaptar de forma equivalente.

- [ ] **Step 7: Verificar erros de tipo**

```bash
npx tsc --noEmit 2>&1 | grep "projects-toolbar" | head -20
```

Expected: zero erros.

- [ ] **Step 8: Commit**

```bash
git add features/projects/components/projects-toolbar.tsx
git commit -m "feat: connect projects-toolbar filters to master-data store"
```

---

### Task 3: Atualizar `projects-kpi-dashboard.tsx` (se necessário)

**Files:**
- Modify: `features/projects/components/projects-kpi-dashboard.tsx` (apenas se ainda tiver imports de project-directory)

- [ ] **Step 1: Verificar se ainda há imports de project-directory**

```bash
grep "project-directory\|PRESET_" features/projects/components/projects-kpi-dashboard.tsx
```

Se houver, remover e conectar ao master store da mesma forma que nos tasks anteriores.

Se `projects-kpi-dashboard.tsx` exibe opções de filtro estáticas (não usa PRESET_), apenas verificar que as referências de campo sejam os nomes novos.

- [ ] **Step 2: Commit se houve mudanças**

```bash
git add features/projects/components/projects-kpi-dashboard.tsx
git commit -m "feat: connect projects-kpi-dashboard to master-data store"
```

---

### Task 4: Atualizar testes existentes + criar testes novos

**Files:**
- Modify: `tests/ui/project-form-modal.test.tsx`
- Create: `tests/ui/projects-toolbar.test.tsx`

- [ ] **Step 1: Atualizar project-form-modal.test.tsx**

Ler o arquivo `web/tests/ui/project-form-modal.test.tsx` e:

1. Adicionar mock do `useMasterDataStore` no topo:

```typescript
vi.mock("@/features/master-data/state/master-data-store", () => ({
  useMasterDataStore: () => ({
    activeConstrutoras: () => [
      { id: "c-001", name: "ACRY", active: true },
      { id: "c-002", name: "EZTEC", active: true },
    ],
    activeObras: (construtoraId?: string) => {
      if (construtoraId === "c-001") return [{ id: "o-001", name: "ARTHUR DE AZEVEDO", construtoraId: "c-001", active: true }];
      if (construtoraId === "c-002") return [{ id: "o-002", name: "IBIRAPUERA", construtoraId: "c-002", active: true }];
      return [];
    },
    activeVendedores: () => [{ id: "v-001", name: "RENATO", active: true }],
    activeEquipamentos: () => [{ id: "e-001", code: "EK-15/26", description: "EK-15/26", active: true }],
    activeTiposCabine: () => [],
    activeEngenheiros: () => [],
    obras: [
      { id: "o-001", name: "ARTHUR DE AZEVEDO", construtoraId: "c-001", active: true },
      { id: "o-002", name: "IBIRAPUERA", construtoraId: "c-002", active: true },
    ],
  }),
}));
```

2. Atualizar testes que criavam projetos com campos antigos:

```typescript
// ANTES:
createProject({ construtora: "ACRY", obra: "ARTHUR DE AZEVEDO", ... })

// DEPOIS:
createProject({ construtoraId: "c-001", obraId: "o-001", ... })
```

3. Adicionar novo teste: obra é limpa ao trocar construtora:

```typescript
it("clears obra when construtora changes", async () => {
  // Renderizar com projeto existente (edit mode) com construtoraId=c-001, obraId=o-001
  // Mudar construtora para c-002
  // Verificar que obraId foi limpo no form
});
```

- [ ] **Step 2: Criar projects-toolbar.test.tsx**

Criar `web/tests/ui/projects-toolbar.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectsToolbar } from "@/features/projects/components/projects-toolbar";

vi.mock("@/features/master-data/state/master-data-store", () => ({
  useMasterDataStore: () => ({
    activeConstrutoras: () => [
      { id: "c-001", name: "ACRY", active: true },
      { id: "c-002", name: "EZTEC", active: true },
    ],
    activeObras: (construtoraId?: string) =>
      construtoraId === "c-001"
        ? [{ id: "o-001", name: "ARTHUR DE AZEVEDO", construtoraId: "c-001", active: true }]
        : [],
    activeVendedores: () => [{ id: "v-001", name: "RENATO", active: true }],
    activeEquipamentos: () => [{ id: "e-001", code: "EK-15/26", description: "EK-15/26", active: true }],
  }),
}));

// Mock do projects store filters
vi.mock("@/features/projects/state/projects-store", () => ({
  useProjectsStore: () => ({
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
    setFilters: vi.fn(),
  }),
}));

describe("ProjectsToolbar", () => {
  it("renders construtora options from master store", () => {
    render(<ProjectsToolbar />);
    expect(screen.getByText("ACRY")).toBeInTheDocument();
    expect(screen.getByText("EZTEC")).toBeInTheDocument();
  });

  it("renders vendedor options from master store", () => {
    render(<ProjectsToolbar />);
    expect(screen.getByText("RENATO")).toBeInTheDocument();
  });

  it("renders equipamento option with code from master store", () => {
    render(<ProjectsToolbar />);
    expect(screen.getByText("EK-15/26")).toBeInTheDocument();
  });
});
```

**Nota:** Ajustar as props e a interface do `ProjectsToolbar` de acordo com a API real do componente. Se `ProjectsToolbar` recebe `filters` e `onFilterChange` como props em vez de usar o store diretamente, atualizar o mock e o teste.

- [ ] **Step 3: Rodar os testes do formulário e toolbar**

```bash
npm test -- tests/ui/project-form-modal.test.tsx tests/ui/projects-toolbar.test.tsx
```

Expected: testes passando.

- [ ] **Step 4: Rodar toda a suite**

```bash
npm test
```

Expected: todos os testes passando.

- [ ] **Step 5: Commit**

```bash
git add tests/ui/project-form-modal.test.tsx tests/ui/projects-toolbar.test.tsx
git commit -m "test: update form-modal tests and add projects-toolbar tests for dynamic dropdowns"
```

---

### Task 5: Verificação final — Fase 4

- [ ] **Step 1: Verificar que project-directory.ts não é mais importado em lugar nenhum**

```bash
grep -r "project-directory\|PRESET_CONSTRUTORAS\|PRESET_OBRAS\|PRESET_VENDEDORES\|PRESET_EQUIPAMENTOS" . --include="*.ts" --include="*.tsx" | grep -v ".git"
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

- [ ] **Step 6: Verificação manual completa**

Abrir `http://localhost:3000` e testar:

**Formulário de novo projeto:**
- [ ] Dropdown de construtora exibe lista dinâmica do cadastro mestre
- [ ] Ao selecionar uma construtora, dropdown de obra exibe apenas obras dessa construtora
- [ ] Ao trocar construtora, campo de obra é limpo
- [ ] Dropdown de equipamento exibe lista do cadastro mestre
- [ ] Dropdown de vendedor exibe lista do cadastro mestre
- [ ] Dropdown de tipo de cabine é opcional
- [ ] Dropdown de engenheiro é opcional

**Toolbar de filtros:**
- [ ] Filtro de construtora exibe opções do cadastro mestre
- [ ] Ao selecionar construtora, obras filtradas exibem apenas obras dela
- [ ] Filtros funcionam corretamente com projetos da tabela

**Fluxo completo:**
- [ ] Criar nova construtora em Cadastros > Construtoras
- [ ] Criar nova obra vinculada a ela
- [ ] Criar novo projeto usando a nova construtora e obra
- [ ] Projeto aparece na tabela com nomes corretos

- [ ] **Step 7: Commit final**

```bash
git commit -m "feat: complete Phase 4 — all project forms and filters use master-data store"
```

---

## Feature Completa 🎉

Após a Fase 4 estar verde, a feature Sidebar + Master Data está **100% implementada**:

| Fase | Status | Entregável |
|---|---|---|
| Fase 1 | ✅ | Shell + Sidebar com colapso, IdentificationModal, páginas stub |
| Fase 2 | ✅ | 6 entidades CRUD com Zustand persist, auditoria |
| Fase 3 | ✅ | Tipo Project migrado para IDs, lookup hook, project-directory removido |
| Fase 4 | ✅ | Formulários e filtros conectados ao master data store |

**Próximos passos opcionais:**
- Skill: `superpowers:finishing-a-development-branch` para criar PR e integrar
- Skill: `superpowers:requesting-code-review` para revisão antes de merge
