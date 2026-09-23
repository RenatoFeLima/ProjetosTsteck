import { getSession } from "@/server/auth/session";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sessão atual.
 *
 * Contrato (mantido de propósito — o bootstrap do AuthProvider depende dele):
 * - sem sessão            → 200 { user: null }   (ausência de sessão NÃO é erro)
 * - sessão válida         → 200 { user: {...} }
 * - banco indisponível    → 503 SERVICE_UNAVAILABLE
 * - erro inesperado       → 500 INTERNAL_ERROR
 *
 * Antes desta rota não tinha try/catch: uma falha do Prisma escapava do
 * handler e virava um 500 genérico do framework, sem código nem requestId.
 */
export async function GET() {
  try {
    const user = await getSession();
    return ok({ user });
  } catch (e) {
    return fail(e);
  }
}
