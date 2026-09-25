// @vitest-environment node
// Backlog V2 — rotas irmãs REMOVIDAS: POST /api/notifications/project-created e
// POST /api/notifications/deadline-warning. Mesmo padrão da rota do Backlog V:
// sem autenticação real (só Origin + X-Requested-With, forjáveis) e com o
// destinatário vindo do payload. Nenhum fluxo as chamava: o e-mail de projeto
// criado sai de createProject (servidor) e o alerta de prazo sai do job
// /api/jobs/check-deadlines (CRON_SECRET), ambos chamando o envio direto.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const SOURCE_DIRS = ["app", "features", "lib", "server"];
const REMOVED = ["project-created", "deadline-warning"];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) out.push(full);
  }
  return out;
}
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("Backlog V2 — rotas project-created e deadline-warning removidas", () => {
  it.each(REMOVED)("a rota %s não existe mais", (route) => {
    expect(existsSync(path.join(ROOT, `app/api/notifications/${route}`))).toBe(false);
  });

  it("nenhum código do app referencia as rotas removidas", () => {
    const hits = SOURCE_DIRS.flatMap((d) => sourceFiles(path.join(ROOT, d)))
      .filter((f) => REMOVED.some((r) => readFileSync(f, "utf8").includes(`notifications/${r}`)))
      .map((f) => path.relative(ROOT, f));
    expect(hits).toEqual([]);
  });

  it("o cliente não dispara mais notificações: sem funções de envio nem apiFetch no serviço", () => {
    const src = read("features/projects/services/project-notification-service.ts");
    expect(src).not.toMatch(/sendProjectCreatedNotification|sendDeadlineNotification|sendProjectNotification|notifyProjectEvent/);
    expect(src).not.toMatch(/apiFetch|fetch\(/);
  });

  it("nenhum código de cliente chama /api/notifications/", () => {
    const hits = ["features", "app", "lib"]
      .flatMap((d) => sourceFiles(path.join(ROOT, d)))
      .filter((f) => !f.includes(`${path.sep}api${path.sep}`))
      .filter((f) => /["'`]\/api\/notifications\//.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(ROOT, f));
    expect(hits).toEqual([]);
  });

  it("os envios legítimos continuam no servidor", () => {
    // Projeto criado: createProject → dispatchProjectNotification (e-mail PROJECT_CREATED).
    expect(read("server/services/projectService.ts")).toMatch(/eventType:\s*releasedOnCreate \? "PROJECT_RELEASED_TO_ELABORATE_ANTE_PROJECT" : "PROJECT_CREATED"/);
    // Alerta de prazo: job protegido por CRON_SECRET chama o envio direto.
    const job = read("app/api/jobs/check-deadlines/route.ts");
    expect(job).toMatch(/CRON_SECRET/);
    expect(job).toMatch(/sendDeadlineWarningEmail/);
  });

  it("helpers e templates compartilhados continuam disponíveis", async () => {
    const svc = await import("@/features/projects/services/project-notification-service");
    expect(typeof svc.getProjectNotificationRecipients).toBe("function");
    expect(typeof svc.isValidEmail).toBe("function");
    expect(existsSync(path.join(ROOT, "lib/mail/templates/project-created-template.ts"))).toBe(true);
    expect(existsSync(path.join(ROOT, "lib/mail/templates/deadline-warning-template.ts"))).toBe(true);
  });
});
