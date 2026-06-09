// Guards de autorização server-side. Usados por services e route handlers.
// Defesa em profundidade: a verificação acontece no servidor, não só na UI.

import type { UserPermissions } from "@/features/auth/lib/auth-types";
import { getSession, type SessionUser } from "./session";

export class HttpError extends Error {
  // `code` é o identificador estável do erro (ex.: "VALIDATION_ERROR"); `message`
  // é a mensagem amigável exibida ao usuário. Quando omitido, é derivado do status.
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = "HttpError";
  }
}

/** Exige usuário autenticado e ativo. Lança 401 caso contrário. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new HttpError(401, "Não autenticado.");
  return user;
}

/** Exige uma permissão específica. Lança 401/403. */
export async function requirePermission(
  check: (p: UserPermissions) => boolean,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!check(user.permissions)) {
    throw new HttpError(403, "Você não tem permissão para executar esta ação.");
  }
  return user;
}

/** Versão sincrona para validar um actor já carregado (usada nos services). */
export function assertPermission(
  user: SessionUser,
  check: (p: UserPermissions) => boolean,
): void {
  if (!check(user.permissions)) {
    throw new HttpError(403, "Você não tem permissão para executar esta ação.");
  }
}
