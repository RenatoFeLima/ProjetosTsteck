// @vitest-environment node
// authService.login — usuário inexistente, usuário inativo e senha incorreta
// precisam ser INDISTINGUÍVEIS de fora, senão o login vira oráculo de
// enumeração de usuários.
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as null | Record<string, unknown>,
  passwordValid: true,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async () => state.user),
      update: vi.fn(async () => state.user),
    },
  },
}));

vi.mock("@/server/services/auditService", () => ({ writeAudit: vi.fn(async () => {}) }));

vi.mock("@/features/auth/lib/password-utils", () => ({
  verifyPassword: vi.fn(async () => state.passwordValid),
  hashPassword: vi.fn(async () => "hash"),
}));

import { login } from "@/server/services/authService";

function activeUser() {
  return {
    id: "u1",
    username: "usuarioteste",
    name: "Usuário Teste",
    email: null,
    role: "ADMIN",
    active: true,
    mustChangePassword: false,
    passwordHash: "hash",
    permissionsJson: {},
    lastLoginAt: null,
    sellerId: null,
  };
}

beforeEach(() => {
  state.user = activeUser();
  state.passwordValid = true;
});

describe("não vazar existência de usuário", () => {
  it("usuário inexistente, inativo e senha errada retornam EXATAMENTE o mesmo", async () => {
    state.user = null;
    const inexistente = await login("naoexiste", "x");

    state.user = { ...activeUser(), active: false };
    const inativo = await login("usuarioteste", "x");

    state.user = activeUser();
    state.passwordValid = false;
    const senhaErrada = await login("usuarioteste", "errada");

    expect(inexistente).toEqual(inativo);
    expect(inativo).toEqual(senhaErrada);
    expect(senhaErrada).toEqual({
      ok: false,
      code: "INVALID_CREDENTIALS",
      error: "Usuário ou senha incorretos.",
    });
  });

  it("credencial válida retorna ok:true", async () => {
    const result = await login("usuarioteste", "certa");
    expect(result.ok).toBe(true);
  });
});

describe("falha de infraestrutura não vira credencial inválida", () => {
  it("erro do Prisma PROPAGA (não retorna ok:false)", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const err = new Error("Can't reach database server at `db.exemplo.invalid:3306`");
    err.name = "PrismaClientInitializationError";
    vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(err);

    // Se isto virasse `{ ok: false }`, a rota consumiria a quota de credencial
    // durante uma indisponibilidade — a raiz do incidente.
    await expect(login("usuarioteste", "x")).rejects.toThrow(
      /Can't reach database server/,
    );
  });
});
