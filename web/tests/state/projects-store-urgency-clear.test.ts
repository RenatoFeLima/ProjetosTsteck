import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocka a camada HTTP: queremos provar o estado OTIMISTA do store ao mover para
// ANTE-PROJETO ENVIADO, sem tocar na rede. apiChangeStatus devolve o projeto já
// reconciliado (urgência limpa, como o backend faz).
vi.mock("@/features/projects/lib/projects-api", () => ({
  apiListProjects: vi.fn(async () => []),
  apiCreateProject: vi.fn(),
  apiUpdateProject: vi.fn(),
  apiChangeStatus: vi.fn(),
  apiSetUrgency: vi.fn(),
  apiAddObservation: vi.fn(),
  apiGetHistory: vi.fn(),
  apiGetAnalytics: vi.fn(),
}));

import { useProjectsStore } from "@/features/projects/state/projects-store";
import * as api from "@/features/projects/lib/projects-api";
import type { Project } from "@/features/projects/domain/project-types";

function urgentProject(id: string): Project {
  return {
    id,
    construtora: "ACRY",
    obra: "OBRA",
    equipamento: "EK-15/26",
    codigo_projeto: "URG-000-0001",
    vendedor: "RENATO",
    proj_obra_recebido: true,
    local_cabine_definido: true,
    alinhamento: true,
    data_lancamento: "2026-05-01",
    data_alinhamento: "2026-05-05",
    status_atual: "ELABORAR ANTE-PROJETO",
    status_entered_at: "2026-05-05",
    data_envio: null,
    data_aprovacao: null,
    urgente: true,
    urgentDeadline: "2026-06-30",
    urgentReason: "Cliente pressionando",
    reviewCount: 0,
    reviewHistory: [],
    finalReviewCount: 0,
    finalReviewHistory: [],
    created_at: "2026-05-01",
    updated_at: "2026-05-10",
  };
}

beforeEach(() => {
  useProjectsStore.setState({ projects: [], statusHistory: [], observations: [] });
  vi.clearAllMocks();
  // O reconcile substitui pelo retorno do backend — devolvemos o projeto já sem urgência.
  vi.mocked(api.apiChangeStatus).mockResolvedValue({
    ...urgentProject("u1"),
    status_atual: "ANTE-PROJETO ENVIADO",
    urgente: false,
    urgentDeadline: null,
    urgentReason: null,
  });
});

describe("store.moveStatus → ANTE-PROJETO ENVIADO limpa urgência (Regra 2 frontend)", () => {
  it("7. otimisticamente remove urgente, urgentDeadline e urgentReason", () => {
    useProjectsStore.setState((s) => ({ projects: [...s.projects, urgentProject("u1")] }));

    const result = useProjectsStore.getState().moveStatus("u1", "ANTE-PROJETO ENVIADO", "kanban");
    expect(result.ok).toBe(true);

    const moved = useProjectsStore.getState().projects.find((p) => p.id === "u1");
    expect(moved?.status_atual).toBe("ANTE-PROJETO ENVIADO");
    expect(moved?.urgente).toBe(false);
    expect(moved?.urgentDeadline ?? null).toBeNull();
    expect(moved?.urgentReason ?? null).toBeNull();
  });

  it("mover para REVISAO DE ESTUDO NÃO limpa urgência (só ANTE-PROJETO ENVIADO/PROJETO APROVADO limpam)", () => {
    // Projeto urgente já em ANTE-PROJETO ENVIADO (transição válida → REVISAO DE ESTUDO).
    const p = { ...urgentProject("u3"), status_atual: "ANTE-PROJETO ENVIADO" as const, urgente: true };
    useProjectsStore.setState((s) => ({ projects: [...s.projects, p] }));

    const result = useProjectsStore.getState().moveStatus("u3", "REVISAO DE ESTUDO", "kanban", "motivo");
    expect(result.ok).toBe(true);

    const moved = useProjectsStore.getState().projects.find((x) => x.id === "u3");
    expect(moved?.status_atual).toBe("REVISAO DE ESTUDO");
    expect(moved?.urgente).toBe(true);
  });
});
