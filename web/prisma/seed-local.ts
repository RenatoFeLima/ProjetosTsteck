// ============================================================================
// SEED LOCAL DE DESENVOLVIMENTO — dados 100% fictícios para validação visual da
// feature "Unidade da Obra". Executado por `npm run db:seed-local`.
//
// TRAVA DE SEGURANÇA (obrigatória):
//   - só roda se o host for 127.0.0.1, localhost ou ::1;
//   - o banco precisa ser EXATAMENTE `tsteck_projetos_dev`;
//   - a validação ocorre ANTES de instanciar o Prisma / qualquer query;
//   - nunca imprime a DATABASE_URL completa, senha ou segredos.
//
// CREDENCIAIS: o admin local vem de SEED_LOCAL_ADMIN_USERNAME / _NAME / _PASSWORD
// no .env.local (git-ignored). Nenhuma credencial fixa neste arquivo.
//
// Idempotente: rodar novamente não duplica registros. Não faz delete/truncate/drop/reset.
//
// NÃO copia usuários, credenciais, hashes ou dados pessoais reais da produção.
// ============================================================================

const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const REQUIRED_DB = "tsteck_projetos_dev";

// ─── Guarda de ambiente (antes de tocar o Prisma) ───────────────────────────
function assertLocalDatabaseOrExit(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error("✖ DATABASE_URL não definida. Abortando seed local.");
    process.exit(1);
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    console.error("✖ DATABASE_URL inválida. Abortando seed local.");
    process.exit(1);
  }

  const host = url.hostname;
  const dbName = url.pathname.replace(/^\//, "");

  if (!ALLOWED_HOSTS.has(host)) {
    // Mostra apenas o host (nunca a URL/credenciais) para diagnóstico seguro.
    console.error(
      `✖ Seed local BLOQUEADO: host "${host}" não é local. ` +
        `Permitidos: ${[...ALLOWED_HOSTS].join(", ")}.`,
    );
    process.exit(1);
  }

  if (dbName !== REQUIRED_DB) {
    console.error(
      `✖ Seed local BLOQUEADO: banco "${dbName}" não é "${REQUIRED_DB}".`,
    );
    process.exit(1);
  }

  console.log(`✔ Ambiente local confirmado (host ${host}, banco ${dbName}).`);
}

assertLocalDatabaseOrExit();

// Só importa o Prisma DEPOIS da trava, garantindo que nenhuma conexão seja
// aberta se a validação falhar.
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../features/auth/lib/password-utils";
import { FULL_PERMISSIONS } from "../features/auth/lib/permissions";

const prisma = new PrismaClient();

// Credenciais do admin local: SEMPRE lidas do .env.local (git-ignored).
// Nada de credencial fixa em código versionado.
function readAdminCredentials(): { username: string; name: string; password: string } {
  const username = process.env.SEED_LOCAL_ADMIN_USERNAME?.trim();
  const name = process.env.SEED_LOCAL_ADMIN_NAME?.trim() || username;
  const password = process.env.SEED_LOCAL_ADMIN_PASSWORD;

  const missing: string[] = [];
  if (!username) missing.push("SEED_LOCAL_ADMIN_USERNAME");
  if (!password) missing.push("SEED_LOCAL_ADMIN_PASSWORD");

  if (missing.length > 0) {
    console.error(
      `✖ Seed local ABORTADO: defina ${missing.join(" e ")} no .env.local ` +
        "(arquivo git-ignored) antes de rodar o seed.",
    );
    process.exit(1);
  }

  return { username: username!, name: name!, password: password! };
}

const LOCAL_ADMIN = readAdminCredentials();

async function ensureAdmin() {
  const existing = await prisma.user.findUnique({ where: { username: LOCAL_ADMIN.username } });
  if (existing) {
    // Ressincroniza a senha com SEED_LOCAL_ADMIN_PASSWORD para que o .env.local
    // seja sempre a fonte da verdade da credencial local (idempotente).
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: LOCAL_ADMIN.name,
        passwordHash: await hashPassword(LOCAL_ADMIN.password),
        role: "ADMIN",
        active: true,
        mustChangePassword: false,
        permissionsJson: FULL_PERMISSIONS,
      },
    });
    return;
  }
  await prisma.user.create({
    data: {
      username: LOCAL_ADMIN.username,
      name: LOCAL_ADMIN.name,
      passwordHash: await hashPassword(LOCAL_ADMIN.password),
      role: "ADMIN",
      active: true,
      mustChangePassword: false,
      permissionsJson: FULL_PERMISSIONS,
    },
  });
}

// Cria uma obra com suas unidades e devolve o mapa nome→id das unidades.
async function ensureWorkWithUnits(
  constructorId: string,
  workName: string,
  unitNames: string[],
): Promise<{ workId: string; unitIds: Record<string, string> }> {
  let work = await prisma.work.findFirst({ where: { constructorId, name: workName } });
  if (!work) {
    work = await prisma.work.create({ data: { constructorId, name: workName, city: "São Paulo" } });
  }
  const unitIds: Record<string, string> = {};
  for (let i = 0; i < unitNames.length; i++) {
    const name = unitNames[i];
    let unit = await prisma.workUnit.findFirst({ where: { workId: work.id, name } });
    if (!unit) {
      unit = await prisma.workUnit.create({ data: { workId: work.id, name, sortOrder: i + 1 } });
    }
    unitIds[name] = unit.id;
  }
  return { workId: work.id, unitIds };
}

async function ensureConstructor(name: string): Promise<string> {
  const existing = await prisma.constructor.findFirst({ where: { name } });
  if (existing) return existing.id;
  const created = await prisma.constructor.create({ data: { name } });
  return created.id;
}

async function ensureByName<T extends { id: string }>(
  find: () => Promise<T | null>,
  create: () => Promise<T>,
): Promise<string> {
  const existing = await find();
  if (existing) return existing.id;
  return (await create()).id;
}

async function main() {
  await ensureAdmin();

  // ─── Construtoras + Obras + Unidades ──────────────────────────────────────
  const dialogoId = await ensureConstructor("DIALOGO");
  const eztecId = await ensureConstructor("EZTEC");

  const adolfo = await ensureWorkWithUnits(dialogoId, "ADOLFO PINHEIRO", ["T1 2°", "T2 1°", "T3 3°"]);
  const agami = await ensureWorkWithUnits(eztecId, "AGAMI", ["ELEV 1", "ELEV 2"]);

  // ─── Cadastros mínimos ────────────────────────────────────────────────────
  const equipId = await ensureByName(
    () => prisma.equipment.findFirst({ where: { code: "EK-15/26" } }),
    () => prisma.equipment.create({ data: { code: "EK-15/26", description: "Elevador padrão (dev)" } }),
  );
  const sellerId = await ensureByName(
    () => prisma.seller.findFirst({ where: { name: "Vendedor Dev" } }),
    () => prisma.seller.create({ data: { name: "Vendedor Dev" } }),
  );
  const cabinId = await ensureByName(
    () => prisma.cabinType.findFirst({ where: { name: "Padrão" } }),
    () => prisma.cabinType.create({ data: { name: "Padrão" } }),
  );

  // ─── Projetos fictícios ───────────────────────────────────────────────────
  // 3 com unidade (para validar exibição) + 1 SEM unidade (compatibilidade
  // com projetos antigos, workUnitId null).
  const projetos: Array<{ code: string; workId: string; workUnitId: string | null; constructorId: string }> = [
    { code: "DEV-ADO-0001", workId: adolfo.workId, workUnitId: adolfo.unitIds["T1 2°"], constructorId: dialogoId },
    { code: "DEV-ADO-0002", workId: adolfo.workId, workUnitId: adolfo.unitIds["T2 1°"], constructorId: dialogoId },
    { code: "DEV-AGA-0001", workId: agami.workId, workUnitId: agami.unitIds["ELEV 1"], constructorId: eztecId },
    { code: "DEV-LEGADO-0001", workId: adolfo.workId, workUnitId: null, constructorId: dialogoId },
  ];

  for (const p of projetos) {
    const existing = await prisma.project.findUnique({ where: { code: p.code } });
    if (existing) continue;
    await prisma.project.create({
      data: {
        code: p.code,
        constructorId: p.constructorId,
        workId: p.workId,
        workUnitId: p.workUnitId,
        sellerId,
        equipmentId: equipId,
        cabinTypeId: cabinId,
        status: "CADASTRO_INICIAL",
      },
    });
  }

  const totalUnits = await prisma.workUnit.count();
  const totalProjects = await prisma.project.count();
  // Nunca imprime a senha — ela vive apenas no .env.local.
  console.log(
    `✔ Seed local concluído. Admin: ${LOCAL_ADMIN.username} (senha em SEED_LOCAL_ADMIN_PASSWORD) · ` +
      `${totalUnits} unidades, ${totalProjects} projetos no banco.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("Falha no seed local:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
