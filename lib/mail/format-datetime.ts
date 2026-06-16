// Formatação de data/hora dos e-mails SEMPRE no fuso de Brasília
// (America/Sao_Paulo). O servidor (Vercel) roda em UTC — sem isto a hora sai
// errada. Helper único usado por todos os templates.

const TZ = "America/Sao_Paulo";

/** Data + hora no fuso de Brasília: dd/MM/yyyy, HH:mm (24h). */
export function formatDateTimeBR(value?: string | Date | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Data pura (sem hora): dd/MM/yyyy. Para valores "yyyy-MM-dd", usa a data
 *  literal (sem conversão de fuso, evitando virar o dia anterior). */
export function formatDateBR(value?: string | Date | null): string {
  if (!value) return "";
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}
