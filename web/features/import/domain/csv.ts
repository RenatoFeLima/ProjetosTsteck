// Parser CSV mínimo e robusto, sem dependências externas. Usado pela importação
// do legado (planilhas exportadas do Google Sheets: vírgula como separador,
// aspas duplas para escape, BOM no início, muitas colunas vazias à direita).

/** Faz o parse de um texto CSV em uma matriz de linhas/células.
 *  Trata: aspas, vírgulas e quebras de linha dentro de aspas, CRLF e BOM. */
export function parseCsv(text: string): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // remove BOM
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
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignora; a quebra real é tratada no \n
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

/** Faz o parse em objetos { header -> valor }. A primeira linha são os cabeçalhos
 *  (trim aplicado). Cabeçalhos vazios são ignorados (colunas-fantasma do export).
 *  Linhas totalmente vazias são descartadas. Valores recebem trim. */
export function parseCsvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i];
    if (r.every((c) => c.trim() === "")) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = (r[idx] ?? "").trim();
    });
    out.push(obj);
  }
  return out;
}
