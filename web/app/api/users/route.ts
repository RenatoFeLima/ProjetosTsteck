import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { listUsers, createUser, type CreateUserInput } from "@/server/services/userService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireUser();
    return ok({ users: await listUsers(actor) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser();
    const body = (await req.json().catch(() => ({}))) as Partial<CreateUserInput>;
    const user = await createUser(actor, body as CreateUserInput);
    return ok({ user }, 201);
  } catch (e) {
    return fail(e);
  }
}
