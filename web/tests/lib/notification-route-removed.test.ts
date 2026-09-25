// @vitest-environment node
// Backlog V — a rota POST /api/notifications/project-movement foi REMOVIDA.
// Ela não exigia sessão (só Origin + X-Requested-With, forjáveis fora do
// navegador) e enviava e-mail para o endereço informado no payload. Depois dos
// Backlogs P e W nenhum fluxo a usava: os e-mails de status e urgência saem do
// servidor (dispatchProjectNotification), após o commit. Este teste impede que
// a rota ou o cliente que a chamava voltem.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const SOURCE_DIRS = ["app", "features", "lib", "server"];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) out.push(full);
  }
  return out;
}

describe("Backlog V — rota de notificação de movimentação removida", () => {
  it("o arquivo da rota não existe mais", () => {
    expect(existsSync(path.join(ROOT, "app/api/notifications/project-movement/route.ts"))).toBe(false);
    expect(existsSync(path.join(ROOT, "app/api/notifications/project-movement"))).toBe(false);
  });

  it("nenhum código do app referencia a rota removida", () => {
    const hits = SOURCE_DIRS.flatMap((d) => sourceFiles(path.join(ROOT, d)))
      .filter((f) => readFileSync(f, "utf8").includes("notifications/project-movement"))
      .map((f) => path.relative(ROOT, f));
    expect(hits).toEqual([]);
  });

  it("o cliente não tem mais as funções que chamavam a rota", () => {
    const src = readFileSync(path.join(ROOT, "features/projects/services/project-notification-service.ts"), "utf8");
    expect(src).not.toMatch(/export\s+async\s+function\s+sendProjectNotification\b/);
    expect(src).not.toMatch(/export\s+async\s+function\s+notifyProjectEvent\b/);
  });

  it("os helpers compartilhados usados pelo envio no servidor continuam disponíveis", async () => {
    const mod = await import("@/features/projects/services/project-notification-service");
    expect(typeof mod.getProjectNotificationRecipients).toBe("function");
    expect(typeof mod.isValidEmail).toBe("function");
    const notify = await import("@/lib/mail/notify-project");
    expect(typeof notify.dispatchProjectNotification).toBe("function");
  });
});
