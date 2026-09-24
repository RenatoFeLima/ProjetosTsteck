import { beforeEach, describe, expect, it, vi } from "vitest";

// Camada HTTP mockada: controla quando/como a listagem de projetos resolve.
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

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const project = { id: "p1", codigo_projeto: "CRE-000-0001" } as Project;

beforeEach(() => {
  vi.mocked(api.apiListProjects).mockReset();
  useProjectsStore.setState({ projects: [], loadStatus: "idle" });
});

describe("projects store — loadStatus", () => {
  it("inicia em idle (nenhuma carga concluída ainda)", () => {
    expect(useProjectsStore.getState().loadStatus).toBe("idle");
  });

  it("fica em loading durante a 1ª carga e vai para ready ao receber os dados", async () => {
    const d = deferred<Project[]>();
    vi.mocked(api.apiListProjects).mockReturnValue(d.promise);

    const pending = useProjectsStore.getState().hydrate();
    expect(useProjectsStore.getState().loadStatus).toBe("loading");

    d.resolve([project]);
    await pending;
    expect(useProjectsStore.getState().loadStatus).toBe("ready");
    expect(useProjectsStore.getState().projects).toEqual([project]);
  });

  it("resultado vazio também é ready (vazio real, não loading)", async () => {
    vi.mocked(api.apiListProjects).mockResolvedValue([]);
    await useProjectsStore.getState().hydrate();
    expect(useProjectsStore.getState().loadStatus).toBe("ready");
  });

  it("falha na 1ª carga vira error (não finge lista vazia)", async () => {
    vi.mocked(api.apiListProjects).mockRejectedValue(new Error("rede"));
    await useProjectsStore.getState().hydrate();
    expect(useProjectsStore.getState().loadStatus).toBe("error");
  });

  it("retry após erro volta a loading e depois ready", async () => {
    vi.mocked(api.apiListProjects).mockRejectedValueOnce(new Error("rede"));
    await useProjectsStore.getState().hydrate();
    expect(useProjectsStore.getState().loadStatus).toBe("error");

    const d = deferred<Project[]>();
    vi.mocked(api.apiListProjects).mockReturnValue(d.promise);
    const pending = useProjectsStore.getState().hydrate();
    expect(useProjectsStore.getState().loadStatus).toBe("loading");
    d.resolve([project]);
    await pending;
    expect(useProjectsStore.getState().loadStatus).toBe("ready");
  });

  it("recarga em segundo plano não volta a loading (sem piscar skeleton)", async () => {
    vi.mocked(api.apiListProjects).mockResolvedValue([project]);
    await useProjectsStore.getState().hydrate();

    const d = deferred<Project[]>();
    vi.mocked(api.apiListProjects).mockReturnValue(d.promise);
    const pending = useProjectsStore.getState().hydrate();
    expect(useProjectsStore.getState().loadStatus).toBe("ready");
    expect(useProjectsStore.getState().projects).toEqual([project]);
    d.resolve([project]);
    await pending;
  });

  it("falha em recarga de segundo plano mantém ready e os dados atuais", async () => {
    vi.mocked(api.apiListProjects).mockResolvedValue([project]);
    await useProjectsStore.getState().hydrate();

    vi.mocked(api.apiListProjects).mockRejectedValue(new Error("rede"));
    await useProjectsStore.getState().hydrate();
    expect(useProjectsStore.getState().loadStatus).toBe("ready");
    expect(useProjectsStore.getState().projects).toEqual([project]);
  });
});
