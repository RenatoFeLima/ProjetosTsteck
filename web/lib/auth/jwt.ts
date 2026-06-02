// Assinatura/verificação do JWT de sessão (HS256 via jose). SERVER-SIDE apenas.
// O segredo nunca é exposto ao cliente. O token guarda só o id do usuário (sub);
// permissões/estado são sempre relidos do banco a cada request (sem dados velhos).

import { SignJWT, jwtVerify } from "jose";

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.startsWith("__PREENCHER")) {
    throw new Error("AUTH_SECRET não configurado no .env.local.");
  }
  return new TextEncoder().encode(s);
}

export function sessionDurationSeconds(): number {
  const hours = Number(process.env.AUTH_SESSION_HOURS ?? 12);
  return (Number.isFinite(hours) && hours > 0 ? hours : 12) * 3600;
}

export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${sessionDurationSeconds()}s`)
    .sign(getSecret());
}

/** Retorna o userId (sub) se o token for válido e não expirado; senão null. */
export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
