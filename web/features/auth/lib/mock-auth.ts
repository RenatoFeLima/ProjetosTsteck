/**
 * Credenciais de teste — ambiente de desenvolvimento.
 * TODO: substituir por autenticação via API real em produção.
 */
export const MOCK_USER = {
  email: "admin@tsteck.com",
  password: "Tsteck@2026",
  displayName: "Administrador TSTECK",
  role: "Admin" as const,
} as const;

export function validateCredentials(email: string, password: string): boolean {
  return (
    email.trim().toLowerCase() === MOCK_USER.email &&
    password === MOCK_USER.password
  );
}
