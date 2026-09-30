// @vitest-environment node
// Vínculo N:N usuário ↔ vendedores (UserSeller) no serviço de usuários.
// Banco em memória com $transaction REAL (snapshot/rollback) e falha injetável:
// prova que usuário + vínculos + espelho legado + auditoria são tudo ou nada.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { UserRole } from "@/features/auth/lib/auth-types";
import type { SessionUser } from "@/server/auth/session";
import { HttpError } from "@/server/auth/guards";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const h = vi.hoisted(() => {
  const state = { db: {} as Record<string, Row[]>, failOn: null as string | null, calls: [] as string[], seq: 0 };
  const links = (userId: string) =>
    state.db.userSeller.filter((l) => l.userId === userId).map((l) => ({ sellerId: l.sellerId })).sort((a, b) => a.sellerId.localeCompare(b.sellerId));
  const withLinks = (u: Row | undefined, include?: Row) => (u ? { ...u, ...(include?.sellerLinks ? { sellerLinks: links(u.id) } : {}) } : null);
  const fail = (op: string) => {
    state.calls.push(op);
    if (state.failOn === op) throw new Error(`falha simulada em ${op}`);
  };
  const matchUser = (u: Row, where: Row) =>
    Object.entries(where).every(([k, v]) => (v && typeof v === "object" && "not" in v ? u[k] !== v.not : u[k] === v));
  const clean = (data: Row) => Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));

  const prisma: Row = {
    user: {
      findUnique: vi.fn(async ({ where, include }: Row) => { fail("user.findUnique"); return withLinks(state.db.user.find((u) => matchUser(u, where)), include); }),
      findFirst: vi.fn(async ({ where }: Row) => state.db.user.find((u) => matchUser(u, where)) ?? null),
      findMany: vi.fn(async ({ include }: Row = {}) => { fail("user.findMany"); return state.db.user.map((u) => withLinks(u, include)); }),
      count: vi.fn(async ({ where }: Row) => state.db.user.filter((u) => matchUser(u, where)).length),
      create: vi.fn(async ({ data, include }: Row) => {
        fail("user.create");
        const { sellerLinks, ...rest } = data;
        const user = { id: `u${++state.seq}`, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null, ...clean(rest) };
        state.db.user.push(user);
        for (const l of sellerLinks?.create ?? []) state.db.userSeller.push({ userId: user.id, sellerId: l.sellerId });
        return withLinks(user, include);
      }),
      update: vi.fn(async ({ where, data, include }: Row) => {
        fail("user.update");
        const user = state.db.user.find((u) => u.id === where.id)!;
        Object.assign(user, clean(data));
        return withLinks(user, include);
      }),
    },
    seller: {
      findMany: vi.fn(async ({ where }: Row) => { fail("seller.findMany"); return state.db.seller.filter((s) => where.id.in.includes(s.id)).map((s) => ({ ...s })); }),
    },
    userSeller: {
      findMany: vi.fn(async ({ where }: Row) => { fail("userSeller.findMany"); return links(where.userId); }),
      deleteMany: vi.fn(async ({ where }: Row) => {
        fail("userSeller.deleteMany");
        const before = state.db.userSeller.length;
        state.db.userSeller = state.db.userSeller.filter((l) => !(l.userId === where.userId && (!where.sellerId || where.sellerId.in.includes(l.sellerId))));
        return { count: before - state.db.userSeller.length };
      }),
      createMany: vi.fn(async ({ data }: Row) => {
        fail("userSeller.createMany");
        for (const l of data) if (!state.db.userSeller.some((x) => x.userId === l.userId && x.sellerId === l.sellerId)) state.db.userSeller.push(l);
        return { count: data.length };
      }),
    },
    auditLog: { create: vi.fn(async ({ data }: Row) => { fail("auditLog.create"); state.db.auditLog.push({ ...data }); return data; }) },
  };
  prisma.$transaction = vi.fn(async (fn: (tx: Row) => Promise<unknown>) => {
    const snapshot = structuredClone(state.db);
    try {
      return await fn(prisma);
    } catch (e) {
      state.db = snapshot;
      throw e;
    }
  });
  return { state, prisma };
});
vi.mock("@/lib/db/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/features/auth/lib/password-utils", () => ({ hashPassword: vi.fn(async () => "hash"), verifyPassword: vi.fn() }));

import { createUser, legacySellerMirror, listUsers, promoteToAdmin, updateUser, LEGACY_SELLER_FIELD_MESSAGE } from "@/server/services/userService";
import { toSessionUser, USER_SELLER_LINKS } from "@/server/auth/session";

const S = h.state;
function actor(role: UserRole = "ADMIN", patch?: (p: ReturnType<typeof getDefaultPermissions>) => void): SessionUser {
  const permissions = structuredClone(getDefaultPermissions(role));
  patch?.(permissions);
  return { id: `actor-${role}`, username: role.toLowerCase(), name: `Admin ${role}`, email: null, role, active: true, mustChangePassword: false, permissions, lastLoginAt: null, sellerIds: [] };
}
const ADMIN = actor();

function seed(links: string[] = [], over: Row = {}) {
  S.db = {
    user: [
      { id: "admin-1", username: "admin", name: "Admin", email: null, role: "ADMIN", active: true, mustChangePassword: false, permissionsJson: {}, sellerId: null },
      { id: "u-sel", username: "joao", name: "João", email: null, role: "SELLER", active: true, mustChangePassword: false, permissionsJson: {}, sellerId: links[0] ?? null, ...over },
    ],
    seller: [
      { id: "sA", name: "MÔNICA", active: true },
      { id: "sB", name: "CARLOS", active: true },
      { id: "sC", name: "JULIANA", active: true },
      { id: "sI", name: "INATIVO", active: false },
      ...Array.from({ length: 20 }, (_, i) => ({ id: `sX${String(i).padStart(2, "0")}`, name: `EXTRA ${i}`, active: true })),
    ],
    userSeller: links.map((sellerId) => ({ userId: "u-sel", sellerId })),
    auditLog: [],
  };
}
const linksOf = (userId: string) => S.db.userSeller.filter((l) => l.userId === userId).map((l) => l.sellerId).sort();
const userRow = (id: string) => S.db.user.find((u) => u.id === id)!;
const lastAudit = () => S.db.auditLog.at(-1)!;
const names = (list: { name: string }[]) => list.map((s) => s.name).sort();
function newUser(sellerIds: unknown, extra: Row = {}) {
  return { username: "novo", name: "Novo", password: "segredo1", role: "SELLER" as UserRole, active: true, mustChangePassword: true, sellerIds, ...extra } as any;
}
async function httpStatus(p: Promise<unknown>) {
  return p.then(() => 200, (e) => (e instanceof HttpError ? e.status : `erro: ${e?.message}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  S.failOn = null;
  S.calls = [];
  S.seq = 0;
  seed();
});

describe("criação", () => {
  it("SELLER com 2 vendedores: vínculos, espelho legado e auditoria do conjunto inicial", async () => {
    const out = await createUser(ADMIN, newUser(["sB", "sA"]));
    expect(out.sellerIds).toEqual(["sA", "sB"]);
    expect(linksOf(out.id)).toEqual(["sA", "sB"]);
    expect(userRow(out.id).sellerId).toBe("sA"); // menor id do conjunto
    const audit = lastAudit();
    expect(audit.action).toBe("USER_CREATED");
    expect(names(audit.metadataJson.sellers.after)).toEqual(["CARLOS", "MÔNICA"]);
    expect(names(audit.metadataJson.sellers.added)).toEqual(["CARLOS", "MÔNICA"]);
    expect(audit.metadataJson.sellers.removed).toEqual([]);
  });

  it("vários vendedores (20)", async () => {
    const ids = Array.from({ length: 20 }, (_, i) => `sX${String(i).padStart(2, "0")}`);
    const out = await createUser(ADMIN, newUser(ids));
    expect(linksOf(out.id)).toHaveLength(20);
  });

  it("IDs duplicados são unificados", async () => {
    const out = await createUser(ADMIN, newUser(["sA", "sA", "sB"]));
    expect(linksOf(out.id)).toEqual(["sA", "sB"]);
  });

  it.each([
    ["lista vazia", []],
    ["sem o campo", undefined],
  ])("SELLER sem vendedor (%s) → 400, nada criado", async (_l, ids) => {
    expect(await httpStatus(createUser(ADMIN, newUser(ids)))).toBe(400);
    expect(S.db.user).toHaveLength(2);
  });

  it.each([
    ["vendedor inexistente", ["sA", "nao-existe"]],
    ["vendedor inativo (novo vínculo)", ["sI"]],
    ["lista inválida (não é array)", "sA"],
    ["lista inválida (id vazio)", ["sA", " "]],
    ["lista inválida (número)", ["sA", 7]],
  ])("%s → 400, nada criado", async (_l, ids) => {
    expect(await httpStatus(createUser(ADMIN, newUser(ids)))).toBe(400);
    expect(S.db.user).toHaveLength(2);
    expect(S.db.userSeller).toEqual([]);
    expect(S.db.auditLog).toEqual([]);
  });

  it("contrato antigo (sellerId no corpo) → 400 pedindo para recarregar", async () => {
    const err = await createUser(ADMIN, newUser(["sA"], { sellerId: "sA" })).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.message).toBe(LEGACY_SELLER_FIELD_MESSAGE);
  });

  it("perfil não-Vendedor ignora vendedores enviados: sem vínculo e espelho nulo", async () => {
    const out = await createUser(ADMIN, newUser(["sA"], { role: "PROJECTS" }));
    expect(linksOf(out.id)).toEqual([]);
    expect(userRow(out.id).sellerId).toBeNull();
  });

  it("falha na auditoria desfaz tudo (usuário e vínculos)", async () => {
    S.failOn = "auditLog.create";
    await expect(createUser(ADMIN, newUser(["sA", "sB"]))).rejects.toThrow(/falha simulada/);
    expect(S.db.user).toHaveLength(2);
    expect(S.db.userSeller).toEqual([]);
  });
});

describe("edição", () => {
  it("adicionando: [A] → [A, B]", async () => {
    seed(["sA"]);
    await updateUser(ADMIN, "u-sel", { sellerIds: ["sA", "sB"] });
    expect(linksOf("u-sel")).toEqual(["sA", "sB"]);
    const s = lastAudit().metadataJson.sellers;
    expect(names(s.before)).toEqual(["MÔNICA"]);
    expect(names(s.after)).toEqual(["CARLOS", "MÔNICA"]);
    expect(names(s.added)).toEqual(["CARLOS"]);
    expect(s.removed).toEqual([]);
    expect(lastAudit()).toMatchObject({ action: "USER_UPDATED", actorUserId: ADMIN.id, actorName: ADMIN.name, entityId: "u-sel" });
  });

  it("removendo: [A, B] → [A]", async () => {
    seed(["sA", "sB"]);
    await updateUser(ADMIN, "u-sel", { sellerIds: ["sA"] });
    expect(linksOf("u-sel")).toEqual(["sA"]);
    expect(names(lastAudit().metadataJson.sellers.removed)).toEqual(["CARLOS"]);
  });

  it("substituindo todos: [A, B] → [C]; espelho vai para o novo conjunto", async () => {
    seed(["sA", "sB"]);
    await updateUser(ADMIN, "u-sel", { sellerIds: ["sC"] });
    expect(linksOf("u-sel")).toEqual(["sC"]);
    expect(userRow("u-sel").sellerId).toBe("sC");
    const s = lastAudit().metadataJson.sellers;
    expect(names(s.added)).toEqual(["JULIANA"]);
    expect(names(s.removed)).toEqual(["CARLOS", "MÔNICA"]);
  });

  it("payload duplicado é unificado", async () => {
    seed(["sA"]);
    await updateUser(ADMIN, "u-sel", { sellerIds: ["sB", "sB", "sA"] });
    expect(linksOf("u-sel")).toEqual(["sA", "sB"]);
  });

  it("ID inválido → 400 e nada muda", async () => {
    seed(["sA"]);
    const before = structuredClone(S.db);
    expect(await httpStatus(updateUser(ADMIN, "u-sel", { sellerIds: ["sA", "nao-existe"] }))).toBe(400);
    expect(S.db).toEqual(before);
  });

  it("sem sellerIds no pedido (só nome): vínculos intactos e auditoria sem 'sellers'", async () => {
    seed(["sA", "sB"]);
    await updateUser(ADMIN, "u-sel", { name: "João Silva" });
    expect(linksOf("u-sel")).toEqual(["sA", "sB"]);
    expect(lastAudit().metadataJson).toBeUndefined();
  });

  it("contrato antigo (sellerId) → 400, sem converter para [sellerId]", async () => {
    seed(["sA", "sB"]);
    expect(await httpStatus(updateUser(ADMIN, "u-sel", { sellerId: "sA" } as any))).toBe(400);
    expect(linksOf("u-sel")).toEqual(["sA", "sB"]);
  });

  it("falha na auditoria desfaz vínculos e usuário", async () => {
    seed(["sA"]);
    const before = structuredClone(S.db);
    S.failOn = "auditLog.create";
    await expect(updateUser(ADMIN, "u-sel", { name: "Outro", sellerIds: ["sA", "sB"] })).rejects.toThrow(/falha simulada/);
    expect(S.db).toEqual(before);
  });
});

describe("espelho legado (rollback seguro)", () => {
  it("mantém o legado quando ele continua no conjunto", async () => {
    seed(["sA", "sB"], { sellerId: "sB" });
    await updateUser(ADMIN, "u-sel", { sellerIds: ["sB", "sC"] });
    expect(userRow("u-sel").sellerId).toBe("sB");
  });

  it("critério determinístico: menor id do conjunto quando o atual saiu", () => {
    expect(legacySellerMirror("sA", ["sC", "sB"])).toBe("sB");
    expect(legacySellerMirror(null, ["sC", "sB"])).toBe("sB");
    expect(legacySellerMirror("sA", [])).toBeNull();
  });

  it("SELLER [A, B]: em qualquer sequência de edições, o espelho SEMPRE pertence ao conjunto atual", async () => {
    seed(["sA", "sB"]);
    for (const next of [["sB"], ["sC", "sA"], ["sA"], ["sB", "sC"], ["sC"], ["sA", "sB", "sC"]]) {
      await updateUser(ADMIN, "u-sel", { sellerIds: next });
      expect(linksOf("u-sel")).toEqual([...next].sort());
      expect(next).toContain(userRow("u-sel").sellerId);
    }
  });
});

describe("vendedor inativo", () => {
  it("inativo JÁ vinculado: editar outros campos é permitido (corrige o bug do select)", async () => {
    seed(["sI"]);
    await updateUser(ADMIN, "u-sel", { name: "João", sellerIds: ["sI"] });
    expect(linksOf("u-sel")).toEqual(["sI"]);
  });

  it("inativo já vinculado pode continuar ao adicionar outro", async () => {
    seed(["sI"]);
    await updateUser(ADMIN, "u-sel", { sellerIds: ["sI", "sA"] });
    expect(linksOf("u-sel")).toEqual(["sA", "sI"]);
  });

  it("inativo NOVO → 400", async () => {
    seed(["sA"]);
    expect(await httpStatus(updateUser(ADMIN, "u-sel", { sellerIds: ["sA", "sI"] }))).toBe(400);
    expect(linksOf("u-sel")).toEqual(["sA"]);
  });
});

describe("SELLER sem vendedor", () => {
  it("SELLER antigo sem vínculo: editar sem escolher vendedor → 400", async () => {
    seed([]);
    expect(await httpStatus(updateUser(ADMIN, "u-sel", { name: "João" }))).toBe(400);
    expect(await httpStatus(updateUser(ADMIN, "u-sel", { sellerIds: [] }))).toBe(400);
  });

  it("…e escolhendo pelo menos um → ok", async () => {
    seed([]);
    await updateUser(ADMIN, "u-sel", { sellerIds: ["sA"] });
    expect(linksOf("u-sel")).toEqual(["sA"]);
  });
});

describe("troca de perfil", () => {
  it("SELLER [A, B] → ADMIN (edição): UserSeller vazio, legado nulo, auditoria removed = [A, B]", async () => {
    seed(["sA", "sB"]);
    const out = await updateUser(ADMIN, "u-sel", { role: "ADMIN" });
    expect(out.sellerIds).toEqual([]);
    expect(linksOf("u-sel")).toEqual([]);
    expect(userRow("u-sel").sellerId).toBeNull();
    const s = lastAudit().metadataJson.sellers;
    expect(names(s.removed)).toEqual(["CARLOS", "MÔNICA"]);
    expect(s.after).toEqual([]);
  });

  it("SELLER [A, B] → PROJECTS mesmo reenviando sellerIds: vínculos removidos", async () => {
    seed(["sA", "sB"]);
    await updateUser(ADMIN, "u-sel", { role: "PROJECTS", sellerIds: ["sA", "sB"] });
    expect(linksOf("u-sel")).toEqual([]);
  });

  it("promover a administrador (rota própria) também remove e audita", async () => {
    seed(["sA", "sB"]);
    await promoteToAdmin(ADMIN, "u-sel");
    expect(linksOf("u-sel")).toEqual([]);
    expect(userRow("u-sel").sellerId).toBeNull();
    expect(lastAudit().action).toBe("USER_PROMOTED_ADMIN");
    expect(names(lastAudit().metadataJson.sellers.removed)).toEqual(["CARLOS", "MÔNICA"]);
  });

  it("voltar para SELLER exige escolher vendedor de novo", async () => {
    seed(["sA"]);
    await updateUser(ADMIN, "u-sel", { role: "PROJECTS" });
    expect(await httpStatus(updateUser(ADMIN, "u-sel", { role: "SELLER" }))).toBe(400);
    await updateUser(ADMIN, "u-sel", { role: "SELLER", sellerIds: ["sB"] });
    expect(linksOf("u-sel")).toEqual(["sB"]);
  });
});

describe("autorização", () => {
  it("SELLER nunca altera usuários — nem os próprios vendedores — mesmo com permissionsJson adulterado", async () => {
    seed(["sA"]);
    const tampered = actor("SELLER", (p) => { p.users.edit = true; p.users.create = true; });
    expect(await httpStatus(updateUser({ ...tampered, id: "u-sel" }, "u-sel", { sellerIds: ["sA", "sB", "sC"] }))).toBe(403);
    expect(await httpStatus(createUser(tampered, newUser(["sA"])))).toBe(403);
    expect(linksOf("u-sel")).toEqual(["sA"]);
  });

  it("perfil sem users.edit (PROJECTS) → 403", async () => {
    seed(["sA"]);
    expect(await httpStatus(updateUser(actor("PROJECTS"), "u-sel", { sellerIds: ["sB"] }))).toBe(403);
  });
});

describe("leitura", () => {
  it("lista de usuários: vínculos carregados junto, sem N+1", async () => {
    seed(["sA", "sB"]);
    const out = await listUsers(ADMIN);
    expect(out.find((u) => u.id === "u-sel")!.sellerIds).toEqual(["sA", "sB"]);
    expect(h.prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(h.prisma.user.findMany.mock.calls[0][0].include).toEqual(USER_SELLER_LINKS);
    expect(h.prisma.userSeller.findMany).not.toHaveBeenCalled();
  });

  it("toSessionUser: sellerIds vem de UserSeller; sem a relação carregada → [] (falha fechada)", () => {
    const base = { id: "x", username: "x", name: "x", email: null, role: "SELLER", active: true, mustChangePassword: false, permissionsJson: {}, lastLoginAt: null, sellerId: "sLegado" } as any;
    expect(toSessionUser({ ...base, sellerLinks: [{ sellerId: "sA" }, { sellerId: "sB" }] })).toMatchObject({ sellerIds: ["sA", "sB"], sellerId: "sLegado" });
    expect(toSessionUser(base).sellerIds).toEqual([]);
  });
});
