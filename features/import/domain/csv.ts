// Parser CSV robusto, sem dependências externas.
// Suporta separadores: vírgula (,), ponto-e-vírgula (;), tab (\t).
// Remove BOM UTF-8, normaliza CRLF, trim em cabeçalhos e valores.

/** Detecta o separador predominante da primeira linha não-vazia do CSV. */
export function detectDelimiter(text: string): "," | ";" | "\t" | null {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  const counts = {
    ",": (firstLine.match(/,/g) ?? []).length,
    ";": (firstLine.match(/;/g) ?? []).length,
    "\t": (firstLine.match(/\t/g) ?? []).length,
  } as const;
  const winner = (Object.entries(counts) as [string, number][])
    .sort((a, b) => b[1] - a[1])[0];
  return winner[1] > 0 ? (winner[0] as "," | ";" | "\t") : null;
}

/** Faz o parse de um texto CSV em matriz de linhas/células.
 *  Trata: aspas, delimitadores e quebras de linha dentro de aspas, CRLF, BOM. */
export function parseCsv(text: string, delimiter?: "," | ";" | "\t"): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // remove BOM
  const sep = delimiter ?? detectDelimiter(s) ?? ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 1; // aspas escapadas ("")
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignora; a quebra real é o \n
    } else {
      field += c;
    }
  }
  // último campo/linha (arquivo pode não terminar com \n)
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export type CsvDiagnostic = {
  delimiter: string;
  delimiterLabel: string;
  columns: string[];
  firstRow: Record<string, string> | null;
  uniqueStatusValues: string[];
};

/** Faz o parse em objetos { header -> valor } e retorna diagnóstico junto.
 *  A primeira linha são os cabeçalhos (trim). Colunas vazias são ignoradas.
 *  Linhas totalmente vazias são descartadas. */
export function parseCsvToObjectsWithDiag(
  text: string,
  statusColumn?: string,
): { rows: Record<string, string>[]; diag: CsvDiagnostic } {
  const delimiter = detectDelimiter(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) ?? ",";
  const delimiterLabel =
    delimiter === ";" ? "ponto-e-vírgula (;)" :
    delimiter === "\t" ? "tab (\\t)" :
    "vírgula (,)";

  const rawRows = parseCsv(text, delimiter);
  if (rawRows.length === 0) {
    return {
      rows: [],
      diag: { delimiter, delimiterLabel, columns: [], firstRow: null, uniqueStatusValues: [] },
    };
  }

  const headers = rawRows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rawRows.length; i += 1) {
    const r = rawRows[i];
    if (r.every((c) => c.trim() === "")) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = (r[idx] ?? "").trim();
    });
    out.push(obj);
  }

  const statusCol = statusColumn ?? "STATUS";
  const uniqueStatusValues = [...new Set(out.map((r) => r[statusCol] ?? "").filter(Boolean))].sort();

  return {
    rows: out,
    diag: {
      delimiter,
      delimiterLabel,
      columns: headers.filter(Boolean),
      firstRow: out[0] ?? null,
      uniqueStatusValues,
    },
  };
}

/** Retrocompatibilidade — usa auto-detecção de delimitador. */
export function parseCsvToObjects(text: string): Record<string, string>[] {
  return parseCsvToObjectsWithDiag(text).rows;
}
