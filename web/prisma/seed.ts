// Seed do administrador inicial.
// Executado por `npm run db:seed` (que injeta variáveis de .env.local via dotenv-cli).
// Idempotente: se o admin já existir, não duplica — apenas garante role/permissões.

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../features/auth/lib/password-utils";
import { FULL_PERMISSIONS } from "../features/auth/lib/permissions";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.INITIAL_ADMIN_USERNAME?.trim();
  const name = process.env.INITIAL_ADMIN_NAME?.trim() || username;
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Defina INITIAL_ADMIN_USERNAME e INITIAL_ADMIN_PASSWORD no .env.local antes de rodar o seed.",
    );
  }
  if (password.startsWith("__PREENCHER")) {
    throw new Error(
      "INITIAL_ADMIN_PASSWORD ainda está com o placeholder. Defina uma senha real no .env.local.",
    );
  }

  const existing = await prisma.user.findUnique({ where: { username } });

  if (existing) {
    // Garante que o admin inicial permaneça ADMIN, ativo e com permissões totais.
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: "ADMIN", active: true, permissionsJson: FULL_PERMISSIONS },
    });
    console.log(`✔ Admin "${username}" já existe — garantido ADMIN ativo. Nada duplicado.`);
    return;
  }

  const passwordHash = await hashPassword(password);

  const admin = await prisma.user.create({
    data: {
      username,
      name: name!,
      passwordHash,
      role: "ADMIN",
      active: true,
      mustChangePassword: false,
      permissionsJson: FULL_PERMISSIONS,
      createdById: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "USER_SEEDED",
      actorName: "sistema",
      entityType: "user",
      entityId: admin.id,
      message: `Administrador inicial "${admin.name}" (${admin.username}) criado pelo seed.`,
    },
  });

  console.log(`✔ Administrador inicial criado: ${admin.username} (${admin.id}).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("Falha no seed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
