/**
 * Utilitários de hash de senha usando PBKDF2-SHA256 via Web Crypto API.
 * Funciona em browser e Node.js 18+. Sem dependências externas.
 *
 * Formato do hash armazenado: "pbkdf2:<saltHex>:<derivedKeyHex>"
 * NUNCA armazenar ou logar a senha em texto puro.
 */

const ALGORITHM = "pbkdf2";
const ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;

function bufToHex(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

/**
 * Gera hash seguro de senha usando PBKDF2-SHA256.
 * Cada chamada gera um salt aleatório — hashes do mesmo texto serão diferentes.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as ArrayBuffer, iterations: ITERATIONS },
    keyMaterial,
    KEY_LENGTH_BITS,
  );
  return `${ALGORITHM}:${bufToHex(salt)}:${bufToHex(derivedBits)}`;
}

/**
 * Verifica se uma senha em texto puro corresponde ao hash armazenado.
 * Retorna false em caso de qualquer erro (hash malformado, etc.).
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  try {
    const parts = storedHash.split(":");
    if (parts.length !== 3 || parts[0] !== ALGORITHM) return false;
    const [, saltHex, expectedHex] = parts;
    const salt = hexToBuf(saltHex);
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const derivedBits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as ArrayBuffer, iterations: ITERATIONS },
      keyMaterial,
      KEY_LENGTH_BITS,
    );
    return bufToHex(derivedBits) === expectedHex;
  } catch {
    return false;
  }
}
