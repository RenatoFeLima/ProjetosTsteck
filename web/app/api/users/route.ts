import { type NextRequest } from "next/server";
import { requireUser, HttpError } from "@/server/auth/guards";
import { requireSameOrigin } from "@/server/auth/csrf";
import { listUsers, createUser, type CreateUserInput } from "@/server/services/userService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireUser();
    // A LISTA completa de usuários (com roles, permissões, mustChangePassword e
    // último login) é dado sensível — restrita a ADMIN. Outros papéis usam
    // /api/users/[id] quando precisam de um usuário específico.
    if (actor.role !== "ADMIN") {
      throw new HttpError(403, "Você não tem permissão para listar usuários.");
    }
    // RESSALVA TÉCNICA: a listagem ainda devolve `permissions` e
    // `mustChangePassword` por compatibilidade com a UI de admin (badge + form de
    // edição leem da lista). Aceitável pois a rota é ADMIN-only e `toSessionUser`
    // já remove passwordHash. Melhoria futura: lista com campos mínimos e
    // /api/users/[id] com o objeto completo para edição.
    return ok({ users: await listUsers(actor) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    const body = (await req.json().catch(() => ({}))) as Partial<CreateUserInput>;
    const user = await createUser(actor, body as CreateUserInput);
    return ok({ user }, 201);
  } catch (e) {
    return fail(e);
  }
}
