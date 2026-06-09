import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocka a camada HTTP para controlar a resolução/rejeição da criação e provar a
// reconciliação de id otimista sem tocar na rede (mesma origem dos 404/400).
vi.mock("@/features/projects/lib/projects-api", () => ({
  apiListProjects: vi.fn(async () => []),
  apiCreateProject: vi.fn(),
  apiUpdateProject: vi.fn(),
  apiChangeStatus: vi.fn(),
  apiSetUrgency: vi.fn(),
  apiAddObservation: vi.fn(),
}));

import {
  useProjectsStore,
  setProjectsErrorSink,
} from "@/features/projects/state/projects-store";
import * as api from "@/features/projects/lib/projects-api";
import type { Project } from "@/features/projects/domain/project-types";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function realProject(id: string, code: string): Project {
  return {
    id,
    construtora: "ACRY",
    obra: "ARTHUR DE AZEVEDO",
    equipamento: "EK-15/26",
    codigo_projeto: code,
    vendedor: "RENATO",
    proj_obra_recebido: false,
    local_cabine_definido: false,
    alinhamento: false,
    data_lancamento: "2026-06-01",
    data_alinhamento: null,
    status_atual: "CADASTRO INICIAL",
    status_entered_at: "2026-06-01",
    data_envio: null,
    data_aprovacao: null,
    urgente: false,
    reviewCount: 0,
    reviewHistory: [],
    finalReviewCount: 0,
    finalReviewHistory: [],
    created_at: "2026-06-01",
    updated_at: "2026-06-01",
  };
}

const baseInput = {
  construtora: "ACRY",
  obra: "ARTHUR DE AZEVEDO",
  vendedor: "RENATO",
  equipamento: "EK-15/26",
  data_lancamento: "2026-06-01",
};

beforeEach(() => {
  vi.clearAllMocks();
  setProjectsErrorSink(null);
  useProjectsStore.setState({ projects: [], statusHistory: [], observations: [] });
});

describe("reconciliação de id otimista", () => {
  it("não dispara requests secundárias enquanto o projeto não está persistido", () => {
    const d = deferred<Project>();
    vi.mocked(api.apiCreateProject).mockReturnValue(d.promise);

    const res = useProjectsStore
      .getState()
      .createProject({ ...baseInput, codigo_projeto: "REC-000-0001" });
    expect(res.ok).toBe(true);
    const tempId = res.project!.id;

    // Ações secundárias sobre o id temporário NÃO podem ir à rede (evita 404).
    useProjectsStore.getState().addObservation(tempId, "obs durante criação", "user");
    useProjectsStore.getState().updateProject(tempId, { engenheiro_nome: "X" });

    expect(api.apiAddObservation).not.toHaveBeenCalled();
    expect(api.apiUpdateProject).not.toHaveBeenCalled();
  });

  it("remapeia projeto, histórico e observações do id temporário para o id real", async () => {
    const d = deferred<Project>();
    vi.mocked(api.apiCreateProject).mockReturnValue(d.promise);

    const res = useProjectsStore
      .getState()
      .createProject({ ...baseInput, codigo_projeto: "REC-000-0002" });
    const tempId = res.project!.id;

    // Histórico otimista nasce com o id temporário.
    expect(useProjectsStore.getState().statusHistory.some((h) => h.projeto_id === tempId)).toBe(true);

    d.resolve(realProject("real-id-abc", "REC-000-0002"));
    await flush();

    const projects = useProjectsStore.getState().projects;
    const history = useProjectsStore.getState().statusHistory;

    // Projeto agora tem o id real; nenhum órfão no id temporário.
    expect(projects.find((p) => p.codigo_projeto === "REC-000-0002")?.id).toBe("real-id-abc");
    expect(history.some((h) => h.projeto_id === tempId)).toBe(false);
    expect(history.some((h) => h.projeto_id === "real-id-abc")).toBe(true);
  });

  it("remove o projeto fantasma e reporta erro ao usuário quando a criação falha", async () => {
    const d = deferred<Project>();
    vi.mocked(api.apiCreateProject).mockReturnValue(d.promise);
    const errors: string[] = [];
    setProjectsErrorSink((m) => errors.push(m));

    const res = useProjectsStore
      .getState()
      .createProject({ ...baseInput, codigo_projeto: "FAIL-000-0001" });
    const tempId = res.project!.id;
    expect(useProjectsStore.getState().projects.some((p) => p.id === tempId)).toBe(true);

    d.reject(new Error('Obra "X" não encontrada para a construtora selecionada.'));
    await flush();

    expect(useProjectsStore.getState().projects.some((p) => p.id === tempId)).toBe(false);
    expect(useProjectsStore.getState().statusHistory.some((h) => h.projeto_id === tempId)).toBe(false);
    expect(errors[0]).toContain("Obra");
  });
});

describe("urgência", () => {
  it("marca urgente e mantém após a resposta da API (não some ao reidratar)", async () => {
    useProjectsStore.setState({ projects: [realProject("u1", "URG-000-0001")] });
    // A API persiste e devolve o projeto urgente (priority -> urgente=true).
    vi.mocked(api.apiSetUrgency).mockResolvedValue({ ...realProject("u1", "URG-000-0001"), urgente: true });

    useProjectsStore.getState().toggleUrgente("u1");
    expect(useProjectsStore.getState().projects.find((p) => p.id === "u1")?.urgente).toBe(true); // otimista
    expect(api.apiSetUrgency).toHaveBeenCalledWith("u1", true);

    await flush();
    // Após a resposta da API, continua urgente (antes o real podia sobrescrever p/ false).
    expect(useProjectsStore.getState().projects.find((p) => p.id === "u1")?.urgente).toBe(true);
  });

  it("faz rollback e reporta erro se a API de urgência falhar", async () => {
    useProjectsStore.setState({ projects: [realProject("u2", "URG-000-0002")] });
    const errors: string[] = [];
    setProjectsErrorSink((m) => errors.push(m));
    vi.mocked(api.apiSetUrgency).mockRejectedValue(new Error("403"));
    // hydrate (rollback) relê do MySQL: projeto volta NÃO urgente.
    vi.mocked(api.apiListProjects).mockResolvedValue([realProject("u2", "URG-000-0002")]);

    useProjectsStore.getState().toggleUrgente("u2");
    await flush();

    expect(useProjectsStore.getState().projects.find((p) => p.id === "u2")?.urgente).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("edição envia a urgência ao backend (persistir em priority)", () => {
    useProjectsStore.setState({ projects: [realProject("u3", "URG-000-0003")] });
    vi.mocked(api.apiUpdateProject).mockResolvedValue({ ...realProject("u3", "URG-000-0003"), urgente: true });

    useProjectsStore.getState().updateProject("u3", { urgente: true });

    expect(api.apiUpdateProject).toHaveBeenCalledWith(
      "u3",
      expect.objectContaining({ urgente: true }),
    );
  });
});
