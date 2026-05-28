// Shared form utility functions for project create/edit forms

export function formatProjectCode(value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  const a = clean.slice(0, 3);
  const b = clean.slice(3, 6);
  const c = clean.slice(6, 10);
  return [a, b, c].filter(Boolean).join("-");
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function stripPhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeEngineerName(value: string): string {
  const collapsed = value.trim().replace(/\s+/g, " ");
  if (!collapsed) return "";
  const withoutPrefix = collapsed.replace(/^eng(?:enheiro)?\u00BAo?\.?\s*/i, "").trim();
  const titled = withoutPrefix
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ");
  return titled ? `Eng\u00BA ${titled}` : "";
}
