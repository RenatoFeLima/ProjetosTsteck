// Máscaras de formatação dos cadastros (CNPJ e telefone/celular).
// Estratégia: exibir formatado (form + listas) e SALVAR apenas dígitos no banco
// (consistente e compatível com a API/MySQL). As funções de formatação são
// idempotentes — formatar um valor já formatado funciona —, então registros
// antigos (formatados ou não) continuam abrindo corretamente na edição.

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Formata progressivamente como CNPJ: 00.000.000/0000-00 (máx 14 dígitos). */
export function formatCnpj(value: string | null | undefined): string {
  const d = onlyDigits(value).slice(0, 14);
  if (!d) return "";
  let out = d.slice(0, 2);
  if (d.length > 2) out += "." + d.slice(2, 5);
  if (d.length > 5) out += "." + d.slice(5, 8);
  if (d.length > 8) out += "/" + d.slice(8, 12);
  if (d.length > 12) out += "-" + d.slice(12, 14);
  return out;
}

/** Formata telefone fixo/celular BR: (00) 0000-0000 ou (00) 00000-0000. */
export function formatPhoneBR(value: string | null | undefined): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Validação de CNPJ (14 dígitos + dígitos verificadores). Vazio é tratado pelo
 *  chamador (campo opcional). */
export function isValidCnpj(value: string | null | undefined): boolean {
  const c = onlyDigits(value);
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false; // todos os dígitos iguais

  const checkDigit = (len: number): number => {
    let sum = 0;
    let pos = len - 7;
    for (let i = len; i >= 1; i -= 1) {
      sum += Number(c[len - i]) * pos;
      pos -= 1;
      if (pos < 2) pos = 9;
    }
    const res = sum % 11;
    return res < 2 ? 0 : 11 - res;
  };

  if (checkDigit(12) !== Number(c[12])) return false;
  return checkDigit(13) === Number(c[13]);
}
