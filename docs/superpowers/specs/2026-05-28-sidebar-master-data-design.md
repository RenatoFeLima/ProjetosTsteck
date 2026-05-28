# Spec: Sidebar + Cadastros Mestres — Pipeline de Projetos TSTECK

**Data:** 2026-05-28  
**Status:** Aprovado — aguardando implementação  
**Autor:** Brainstorming session

---

## 1. Visão Geral

Transformar o Pipeline de Projetos de uma single-page app sem navegação em um sistema operacional completo com sidebar de navegação, identidade de usuário, cadastros mestres para as 6 entidades principais e integração dessas entidades com todos os dropdowns/comboboxes existentes.

### Decisões confirmadas

| Decisão | Escolha |
|---|---|
| Navegação de cadastros | Next.js App Router — rotas separadas |
| Persistência master data | Zustand + persist middleware (localStorage) |
| Modelo de dados em Project | Normalizado — IDs referenciam entidades |
| Identidade do usuário | Configurável via localStorage, modal na primeira abertura |
| Permissões | Visibilidade na sidebar baseada em perfil |

---

## 2. Estrutura de Rotas e Layout

### Route Group `(main)`

```
app/
  layout.tsx                         ← mantido: fonts, metadata, <html>/<body>
  (main)/
    layout.tsx                       ← NOVO: AppShell (sidebar + main)
    page.tsx                         ← move atual page.tsx (URL "/" inalterada)
    master/
      construtoras/page.tsx
      obras/page.tsx
      equipamentos/page.tsx
      tipos-cabine/page.tsx
      vendedores/page.tsx
      engenheiros/page.tsx
      auditoria/page.tsx             ← somente Administrador
  globals.css
```

### `app/(main)/layout.tsx`

Server Component. Renderiza:

```tsx
<div className="flex h-screen overflow-hidden">
  <AppSidebar />
  <main className="flex-1 min-w-0 overflow-y-auto bg-background">
    {children}
  </main>
</div>
```

`AppSidebar` é um Client Component (precisa de estado de collapse). O `<main>` recebe o conteúdo de cada rota. O `PageContainer` existente (max-width + padding) permanece inalterado dentro do main.

---

## 3. Sidebar — AppSidebar

### Visual

- Fundo: branco (`bg-white`), borda direita sutil (`border-r border-zinc-200`)
- Fonte: IBM Plex Sans (já no projeto)
- Expandida: `w-[240px]`, `flex-shrink-0`
- Recolhida: `w-[64px]`, apenas ícones
- Transição suave: `transition-[width] duration-200`

### Estrutura (de cima para baixo)

```
┌──────────────────────────────┐
│  ▌ TSTECK   Projetos         │  ← SidebarBrand
│                     [←]      │  ← botão toggle collapse
├──────────────────────────────┤
│  ◉ Projetos                  │  ← item ativo
│    Kanban                    │
│    KPIs                      │
│    Alertas                   │
├── CADASTROS ─────────────────┤  ← SidebarNavGroup (Admin + Projetista)
│    Construtoras              │
│    Obras                     │
│    Equipamentos              │
│    Tipos de Cabine           │
│    Vendedores                │
│    Engenheiros               │
├── CONFIGURAÇÕES ─────────────┤  ← SidebarNavGroup (Admin)
│    Preferências              │
│    Logs / Auditoria          │
├──────────────────────────────┤
│  [RF]  Renato Ferreira       │  ← SidebarUserProfile
│        Administrador         │
└──────────────────────────────┘
```

### Item ativo

Detectado via `usePathname()`. Visual:
- Background: `bg-red-50`
- Texto: `text-[#9e0b0f]`
- Borda esquerda: `border-l-2 border-[#9e0b0f]`

Hover em inativos: `hover:bg-zinc-100`

### Modo recolhido

- Exibe apenas ícones centralizados
- Label oculto com `sr-only` ou `hidden`
- Radix `Tooltip` com label completo no hover de cada item
- Botão toggle vira `[→]` quando recolhido

### Mobile (`< lg`)

- Sidebar some do layout (`hidden lg:flex`)
- Botão hambúrguer no header da página abre Radix Dialog como overlay
- Largura do overlay: `280px`, fundo com backdrop

### Permissões de visibilidade

| Perfil | Projetos nav | Grupo Cadastros | Grupo Configurações |
|---|---|---|---|
| `admin` | ✅ | ✅ | ✅ |
| `projetista` | ✅ | ✅ | ❌ |
| `comercial` | ✅ | ❌ | ❌ |
| `visualizacao` | ✅ | ❌ | ❌ |

Verificação via `currentUser.role` do `useCurrentUser` hook. Nenhuma proteção de rota — somente visibilidade.

### Componentes

| Componente | Responsabilidade |
|---|---|
| `AppSidebar` | Container principal, estado collapsed, provider do contexto |
| `SidebarBrand` | Logo TSTECK + subtítulo + botão toggle |
| `SidebarNavGroup` | Grupo com label, ícone e lista de items. Oculto se sem permissão |
| `SidebarNavItem` | Ícone + label + active state + tooltip quando collapsed |
| `SidebarUserProfile` | Avatar com iniciais, nome, perfil no rodapé |
| `useSidebar` hook | `collapsed: boolean`, `toggle()`, persiste em localStorage |

### Ícones (lucide-react — já no projeto)

| Item | Ícone |
|---|---|
| Projetos | `LayoutDashboard` |
| Kanban | `Kanban` |
| KPIs | `BarChart3` |
| Alertas | `Bell` |
| Construtoras | `Building2` |
| Obras | `HardHat` |
| Equipamentos | `Wrench` |
| Tipos de Cabine | `Box` |
| Vendedores | `UserRound` |
| Engenheiros | `GraduationCap` |
| Preferências | `SlidersHorizontal` |
| Auditoria | `ScrollText` |

---

## 4. Identidade do Usuário

### Tipo

```typescript
type UserRole = "admin" | "projetista" | "comercial" | "visualizacao";

type CurrentUser = {
  name: string;       // "Renato Ferreira"
  role: UserRole;
  initials: string;   // derivado: "RF"
};
```

### Hook `useCurrentUser`

- Lê/escreve `localStorage.getItem("tsteck:current-user")`
- Retorna `{ user: CurrentUser | null, saveUser, clearUser }`
- `initials` são derivadas automaticamente do nome (primeiras letras das palavras)

### `IdentificationModal`

- Aparece quando `user === null` (primeira abertura)
- Campos: "Seu nome" (obrigatório) + "Perfil" (select com as 4 opções)
- Não pode ser fechado sem preencher — sem botão cancelar
- Após salvar, nunca aparece novamente
- Reutilizado em Configurações → Preferências (com dados pré-preenchidos e botão cancelar habilitado)

### Integração com auditoria

Toda ação de CRUD no master data store recebe o `currentUser.name` como `performedBy`. O campo é obrigatório — se por algum motivo `user === null`, usar `"Sistema"` como fallback.

---

## 5. Camada de Dados Mestres

### Localização

```
features/master-data/
  domain/
    master-data-types.ts
    master-data-seed.ts
  state/
    master-data-store.ts
  hooks/
    use-master-data-lookup.ts
  components/
    master-data-page.tsx
    master-data-table.tsx
    master-data-form-dialog.tsx
    constructor-form.tsx
    work-form.tsx
    equipment-form.tsx
    cabin-type-form.tsx
    seller-form.tsx
    engineer-form.tsx
```

### Tipos base

```typescript
type MasterEntity = {
  id: string;          // nanoid() — 8 chars
  active: boolean;
  createdAt: string;   // ISO date
  updatedAt: string;
  createdBy: string;   // nome do usuário
};

type Construtora = MasterEntity & {
  name: string;        // obrigatório, único (normalizado lowercase para dedup)
  cnpj?: string;
  phone?: string;
  email?: string;
  notes?: string;
};

type Obra = MasterEntity & {
  construtoraId: string;   // obrigatório
  name: string;            // obrigatório, único por construtoraId
  code?: string;
  address?: string;
  city?: string;
  state?: string;          // UF
  notes?: string;
};

type Equipamento = MasterEntity & {
  code: string;            // obrigatório, único, sempre uppercase
  description: string;     // obrigatório
  family?: string;
  capacity?: string;
  dimension?: string;
  notes?: string;
};

type TipoCabine = MasterEntity & {
  name: string;            // obrigatório, único
  description?: string;
};

type Vendedor = MasterEntity & {
  name: string;            // obrigatório, único
  email?: string;
  phone?: string;
};

type Engenheiro = MasterEntity & {
  name: string;   // obrigatório — sempre prefixado "Engº", dedup do prefixo na entrada
  phone?: string; // máscara: (11) 93333-4444 ou (11) 3333-4444
  email?: string;
};
```

### Audit log

```typescript
type AuditEvent = {
  id: string;
  entity: "construtora" | "obra" | "equipamento" | "tipoCabine" | "vendedor" | "engenheiro";
  entityId: string;
  entityName: string;
  action: "created" | "updated" | "activated" | "deactivated" | "deleted";
  performedBy: string;
  performedAt: string;        // ISO datetime
  previousValue?: string;     // JSON resumido do campo alterado
  newValue?: string;
};
```

### Master Data Store

Zustand + `persist` com key `"tsteck:master-data"`.

**Inicialização:** se `construtoras.length === 0`, popula com dados de `master-data-seed.ts`. Dados do usuário nunca são sobrescritos após o primeiro load.

**Ações por entidade (padrão idêntico para todas as 6):**

```typescript
// exemplo para Construtora — mesmo padrão para as demais
addConstrutora(input: Omit<Construtora, keyof MasterEntity>, performedBy: string): void
updateConstrutora(id: string, patch: Partial<Construtora>, performedBy: string): void
toggleConstrutora(id: string, performedBy: string): void   // ativa/inativa
deleteConstrutora(id: string, performedBy: string): void   // só se sem projetos vinculados
```

**Selectors ativos:**

```typescript
activeConstrutoras(): Construtora[]
activeObras(construtoraId?: string): Obra[]   // filtra por construtoraId se informado
activeEquipamentos(): Equipamento[]
activeTiposCabine(): TipoCabine[]
activeVendedores(): Vendedor[]
activeEngenheiros(): Engenheiro[]
```

**Regras de integridade:**

- `deleteConstrutora`: bloqueia se existir **qualquer obra vinculada** (ativa ou inativa) ou **qualquer projeto** (qualquer status) com `construtoraId`
- `deleteObra`: bloqueia se existir qualquer projeto (qualquer status) com `obraId`
- Demais entidades: deleção física permitida; preferir inativação
- Nomes normalizados para detecção de duplicidade (trim + lowercase + remover acentos)

### Seed com IDs determinísticos

`master-data-seed.ts` exporta:
- Arrays de entidades com IDs fixos (formato `"c-001"`, `"o-001"`, `"e-001"`, etc.)
- Mapa `SEED_IDS` para uso no `project-seed.ts`:
  ```typescript
  export const SEED_IDS = {
    construtoras: { "BAHIA RENTAL": "c-001", "ACRY": "c-002", ... },
    obras: { "ARTHUR DE AZEVEDO": "o-001", ... },
    vendedores: { "RENATO": "v-001", ... },
    equipamentos: { "EK-15/26": "e-001", ... },
    tiposCabine: { "Simples": "tc-001", ... },
    engenheiros: { "Engº Rafael": "eng-001", ... },
  };
  ```

---

## 6. Componentes CRUD Genéricos

### `MasterDataPage`

Props:
```typescript
type MasterDataPageProps<T extends MasterEntity> = {
  title: string;
  description: string;
  addLabel: string;
  rows: T[];
  columns: ColumnDef<T>[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onToggleActive: (id: string) => void;
  onDelete?: (id: string) => void;    // omitir quando deleção não é permitida
  isLoading?: boolean;
};
```

Renderiza: header + busca + filtro status + `MasterDataTable` + paginação (pageSize: 15).

Busca: filtragem client-side sobre o campo `name` (ou `code` para Equipamento).  
Filtro status: Todos | Ativos | Inativos — seletor de 3 opções.

### `MasterDataTable`

Tabela `table-fixed w-full` com colgroup. Última coluna é sempre "Ações" (Radix DropdownMenu).

Estados tratados:
- **Loading:** 5 skeleton rows com `animate-pulse`
- **Erro:** card vermelho com mensagem e botão retry
- **Lista vazia:** card dashed com CTA "Adicionar primeiro item"
- **Sem resultado de busca:** card neutro com botão "Limpar busca"

### `MasterDataFormDialog`

Radix Dialog. Props: `open`, `mode: "create" | "edit"`, `entityLabel`, `onClose`, `onSave`, `children`.

- Header: `"Nova {entityLabel}"` ou `"Editar {entityLabel}"`
- Scroll interno se conteúdo for longo
- Footer fixo: botão "Salvar" (`bg-[#9e0b0f]`) + botão "Cancelar"
- Se fechar com alterações não salvas: `UnsavedChangesDialog` (componente já existente)
- Após salvar com sucesso: toast de confirmação + fecha dialog

---

## 7. Migração do Tipo Project

### Campos renomeados

| Campo atual | Campo novo | Observação |
|---|---|---|
| `construtora: string` | `construtoraId: string` | |
| `obra: string` | `obraId: string` | |
| `vendedor: string` | `vendedorId: string` | |
| `equipamento: string` | `equipamentoId: string` | |
| `tipo_cabine?: string` | `tipoCabineId?: string` | |
| `engenheiro_nome?: string` | `engenheiroId?: string` | unificado |
| `engenheiro_celular?: string` | removido | info vive no cadastro |

### Hook `useMasterDataLookup`

```typescript
function useMasterDataLookup() {
  // retorna funções de resolução ID → nome
  // usa Map pré-computado com useMemo para O(1)
  // fallback: retorna o próprio ID se não encontrado
  return {
    construtoraName(id: string): string,
    obraName(id: string): string,
    vendedorName(id: string): string,
    equipamentoName(id: string): string,
    tipoCabineName(id: string | undefined): string,
    engenheiroName(id: string | undefined): string,
  };
}
```

### Componentes afetados

| Componente | Mudança |
|---|---|
| `project-types.ts` | Campos renomeados |
| `project-seed.ts` | Usa `SEED_IDS` do master-data-seed |
| `project-directory.ts` | **Deletado** |
| `projects-store.ts` | Filtros usam `construtoraId`, `obraId` etc.; remove `PRESET_*` |
| `projects-table.tsx` | Exibição via `useMasterDataLookup()` |
| `projects-toolbar.tsx` | Dropdowns usam `activeConstrutoras()` etc., emitem IDs |
| `project-form-modal.tsx` | Dropdowns usam selectors ativos, salvam IDs; obra filtrada por construtoraId |
| `project-details-drawer.tsx` | Exibição via `useMasterDataLookup()` |
| `projects-kanban.tsx` | Exibição via `useMasterDataLookup()` |
| `projects-kpi-dashboard.tsx` | Filtros usam selectors do master store, emitem IDs |

### Regra obra dependente de construtora

No `ProjectFormModal`, ao alterar `construtoraId`:
- Lista de obras filtrada para `activeObras(novaConstutoraId)`
- Se `obraId` atual não pertence à nova construtora → limpar `obraId`

---

## 8. Fases de Implementação

### Fase 1 — Shell + Sidebar

**Entrega:** Layout navegável, sidebar funcional, identidade do usuário.  
**Arquivos criados:**
- `app/(main)/layout.tsx`
- `app/(main)/page.tsx` (move atual)
- `features/sidebar/components/app-sidebar.tsx`
- `features/sidebar/components/sidebar-brand.tsx`
- `features/sidebar/components/sidebar-nav-group.tsx`
- `features/sidebar/components/sidebar-nav-item.tsx`
- `features/sidebar/components/sidebar-user-profile.tsx`
- `features/sidebar/hooks/use-sidebar.ts`
- `features/user/hooks/use-current-user.ts`
- `features/user/components/identification-modal.tsx`

Rotas de master criadas como stubs: retornam `<div>Em breve</div>`.

**Impacto em existentes:** mínimo — apenas move `app/page.tsx`.  
**Testável ao final:** sidebar aparece, navegar entre projetos e stubs funciona, IdentificationModal aparece na primeira abertura.

---

### Fase 2 — Master Data Layer

**Entrega:** 6 telas CRUD completamente funcionais com persistência.  
**Arquivos criados:**
- `features/master-data/domain/master-data-types.ts`
- `features/master-data/domain/master-data-seed.ts`
- `features/master-data/state/master-data-store.ts`
- `features/master-data/components/master-data-page.tsx`
- `features/master-data/components/master-data-table.tsx`
- `features/master-data/components/master-data-form-dialog.tsx`
- `features/master-data/components/{constructor,work,equipment,cabin-type,seller,engineer}-form.tsx`
- `app/(main)/master/{construtoras,obras,...}/page.tsx` (stubs removidos)

**Impacto em existentes:** nenhum — projetos ainda usam strings.  
**Testável ao final:** criar/editar/inativar construtoras, obras (filtradas por construtora), equipamentos, etc. Dados persistem no reload.

---

### Fase 3 — Migração de Projetos

**Entrega:** Project type normalizado; todos os componentes exibem via lookup.  
**Mudanças:**
- `project-types.ts`: campos renomeados para IDs
- `project-seed.ts`: usa `SEED_IDS`
- `project-directory.ts`: deletado
- `projects-store.ts`: filtros com IDs
- `use-master-data-lookup.ts`: criado
- `projects-table.tsx`, `project-details-drawer.tsx`, `projects-kanban.tsx`: exibição via lookup

**Impacto em existentes:** alto — todos os componentes que exibem nome de entidade são tocados.  
**Testável ao final:** tabela, kanban e drawer exibem nomes corretamente; filtros funcionam com IDs.

---

### Fase 4 — Integração de Dropdowns

**Entrega:** Formulários e filtros consomem master store; obra dependente de construtora.  
**Mudanças:**
- `project-form-modal.tsx`: dropdowns dinâmicos, obra filtrada
- `projects-toolbar.tsx`: filtros dinâmicos via master store
- `projects-kpi-dashboard.tsx`: filtros via master store

**Testável ao final:** cadastrar nova construtora → aparece imediatamente no dropdown do formulário de projeto e nos filtros; inativar equipamento → some dos dropdowns de novos projetos.

---

## 9. Testes

Cada fase inclui testes unitários/integração relevantes:

- **Fase 1:** `use-current-user.test.ts`, `use-sidebar.test.ts`
- **Fase 2:** `master-data-store.test.ts` (CRUD, dedup, ativação, audit log), testes de UI dos formulários
- **Fase 3:** `project-seed.test.ts` (atualizado para IDs), `use-master-data-lookup.test.ts`
- **Fase 4:** `projects-toolbar.test.tsx` (filtros dinâmicos), `project-form-modal.test.tsx` (obra dependente)

Testes existentes são atualizados ao longo da Fase 3 para refletir a migração de tipo.

---

## 10. Fora de Escopo

Os seguintes itens são explicitamente fora deste spec:

- Autenticação real (Supabase Auth, JWT, sessões)
- Proteção de rotas por perfil (middleware Next.js)
- Integração com API REST ou banco de dados
- Controle de usuários (criar/editar outros usuários no sistema)
- Integração com sistema externo de cadastros

Esses itens são candidatos ao próximo spec após a integração com Supabase.
