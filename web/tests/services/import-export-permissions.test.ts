// @vitest-environment node
// Permissões de importação/exportação são server-side. Rodamos em node (não
// jsdom) porque os services puxam @/lib/db/prisma, que recusa carregar com
// `window` definido. Os guards lançam ANTES de qualquer query, então não há
// acesso real ao banco nestes testes.
import { describe, expect, it } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { SessionUser } from "@/server/auth/session";
import type { UserRole } from "@/features/auth/lib/auth-types";
import { HttpError } from "@/server/auth/guards";

import { dryRunProjectsExcel, commitProjectsExcelBatch } from "@/server/services/projectsExcelImportService";
import { dryRunFinalProjectsImport, commitFinalProjectsBatch } from "@/server/services/finalProjectsImportService";
import { exportProjectsCsv } from "@/server/services/projectService";

function makeUser(role: UserRole): SessionUser {
  return {
    id: `id-${role}`,
    username: role.toLowerCase(),
    name: role,
    email: null,
    role,
    active: true,
    mustChangePassword: false,
    permissions: getDefaultPermissions(role),
    lastLoginAt: null,
    sellerId: role === "SELLER" ? "seller-1" : null,
  };
}

async function expect403(fn: () => Promise<unknown>) {
  try {
    await fn();
    throw new Error("esperava HttpError 403, mas não lançou");
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    expect((e as HttpError).status).toBe(403);
  }
}

describe("Importação — somente ADMIN (backend retorna 403)", () => {
  const nonAdmins: UserRole[] = ["PROJECTS", "COMMERCIAL", "SELLER", "VIEWER", "CUSTOM", "MANAGER"];

  for (const role of nonAdmins) {
    it(`4. ${role} recebe 403 em dry-run de importação (projects excel)`, async () => {
      await expect403(() => dryRunProjectsExcel(makeUser(role), "csv qualquer"));
    });

    it(`4. ${role} recebe 403 em commit de importação (projects excel)`, async () => {
      await expect403(() => commitProjectsExcelBatch(makeUser(role), "csv qualquer", 0, 50));
    });

    it(`4. ${role} recebe 403 em dry-run de importação (final projects)`, async () => {
      await expect403(() => dryRunFinalProjectsImport(makeUser(role), "csv qualquer"));
    });

    it(`4. ${role} recebe 403 em commit de importação (final projects)`, async () => {
      await expect403(() => commitFinalProjectsBatch(makeUser(role), "csv qualquer", 0, 50));
    });
  }
});

describe("Exportação — SELLER/COMMERCIAL bloqueados (backend retorna 403)", () => {
  it("11. SELLER recebe 403 ao exportar a base de projetos", async () => {
    await expect403(() => exportProjectsCsv(makeUser("SELLER")));
  });

  it("11. COMMERCIAL recebe 403 ao exportar a base de projetos", async () => {
    await expect403(() => exportProjectsCsv(makeUser("COMMERCIAL")));
  });
});
