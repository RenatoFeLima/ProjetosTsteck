import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const cadastroPath = path.join(ROOT, "TABELA DE PROJETOS (1)(CADASTRO INICIAL).csv");
const antePath = path.join(ROOT, "TABELA DE PROJETOS (1)(ANTE-PROJETO).csv");
const seedOutPath = path.join(ROOT, "features", "projects", "domain", "project-seed.ts");
const directoryOutPath = path.join(ROOT, "features", "projects", "domain", "project-directory.ts");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (ch === '\r') {
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeUpperNoAccent(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function toBoolean(value) {
  const n = normalizeUpperNoAccent(value);
  if (n === "VERDADEIRO" || n === "SIM" || n === "TRUE" || n === "1") return true;
  if (n === "FALSO" || n === "NAO" || n === "NÃO" || n === "FALSE" || n === "0") return false;
  return false;
}

function toIsoDate(value) {
  const raw = normalizeText(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const clean = raw.replace(/\./g, "/");
  const m = clean.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,4})$/);
  if (!m) return null;

  let a = Number(m[1]);
  let b = Number(m[2]);
  let c = Number(m[3]);

  let year;
  let month;
  let day;

  if (String(m[1]).length === 4) {
    year = a;
    month = b;
    day = c;
  } else if (String(m[3]).length === 4) {
    year = c;
    // Source sheets are exported in month/day/year formatting.
    month = a;
    day = b;
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function mapStatus(value) {
  const n = normalizeUpperNoAccent(value);
  if (!n) return { status: null, urgente: false };
  if (n === "CADASTRO INICIAL") return { status: "CADASTRO INICIAL", urgente: false };
  if (n === "ELABORAR ANTE-PROJETO" || n === "ELABORAR ANTE PROJETO") {
    return { status: "ELABORAR ANTE-PROJETO", urgente: false };
  }
  if (n === "ANTE-PROJETO ENVIADO" || n === "ANTE PROJETO ENVIADO") {
    return { status: "ANTE-PROJETO ENVIADO", urgente: false };
  }
  if (n === "ANTE-PROJETO APROVADO" || n === "ANTE PROJETO APROVADO") {
    return { status: "ANTE-PROJETO APROVADO", urgente: false };
  }
  if (n === "PROJETO APROVADO") return { status: "PROJETO APROVADO", urgente: false };
  if (n === "PROJETO FINAL ENVIADO") return { status: "PROJETO FINAL ENVIADO", urgente: false };
  if (n === "REVISAO DE ESTUDO" || n === "REVISÃO DE ESTUDO") {
    return { status: "REVISAO DE ESTUDO", urgente: false };
  }
  if (n.includes("URGENTE")) return { status: null, urgente: true };
  return { status: null, urgente: false };
}

function token(value, size = 3) {
  const clean = normalizeUpperNoAccent(value).replace(/[^A-Z0-9]+/g, "");
  return (clean || "X").slice(0, size);
}

function fallbackCode(fields, usedCodes) {
  const base = `CRE-${token(fields.construtora, 3)}-${token(fields.obra, 3)}-${token(fields.equipamento || fields.engenheiro_nome || "GEN", 3)}`;
  if (!usedCodes.has(base)) {
    usedCodes.add(base);
    return base;
  }
  let i = 2;
  while (usedCodes.has(`${base}-${i}`)) i += 1;
  const code = `${base}-${i}`;
  usedCodes.add(code);
  return code;
}

function compositeKey(fields) {
  return [
    normalizeUpperNoAccent(fields.construtora),
    normalizeUpperNoAccent(fields.obra),
    normalizeUpperNoAccent(fields.engenheiro_nome),
  ].join("|");
}

function statusRank(status) {
  const rank = {
    "CADASTRO INICIAL": 0,
    "ELABORAR ANTE-PROJETO": 1,
    "ANTE-PROJETO ENVIADO": 2,
    "ANTE-PROJETO APROVADO": 3,
    "PROJETO APROVADO": 4,
    "PROJETO FINAL ENVIADO": 5,
    "REVISAO DE ESTUDO": 6,
  };
  return rank[status] ?? 0;
}

const cadastroCsv = fs.readFileSync(cadastroPath, "utf8");
const anteCsv = fs.readFileSync(antePath, "utf8");

const cadastroRows = parseCsv(cadastroCsv);
const anteRows = parseCsv(anteCsv);

const usedCodes = new Set();
const byId = new Map();
const byComposite = new Map();
let idCounter = 1;

function register(record) {
  byId.set(record.id, record);
  byComposite.set(record._composite, record.id);
}

for (const row of cadastroRows.slice(1)) {
  const construtora = normalizeText(row[1]);
  const obra = normalizeText(row[2]);
  if (!construtora || !obra) continue;

  const engenheiro_nome = normalizeText(row[3]);
  const equipamento = normalizeText(row[5]);
  const rawCode = normalizeText(row[7]);
  const vendedor = normalizeText(row[8]) || "SEM VENDEDOR";

  const fields = { construtora, obra, equipamento, engenheiro_nome };
  const code = rawCode || fallbackCode(fields, usedCodes);
  if (rawCode) usedCodes.add(rawCode);

  const comp = compositeKey({ construtora, obra, engenheiro_nome });
  if (byComposite.has(comp)) continue;

  const data_lancamento = toIsoDate(row[11]) ?? "2025-01-01";
  const data_prazo_ap = toIsoDate(row[14]);

  const record = {
    id: `seed-${idCounter}`,
    _composite: comp,
    construtora,
    obra,
    engenheiro_nome,
    engenheiro_celular: normalizeText(row[4]),
    equipamento: equipamento || "N/I",
    tipo_cabine: normalizeText(row[6]),
    codigo_projeto: code,
    vendedor,
    proj_obra_recebido: toBoolean(row[9]),
    local_cabine_definido: toBoolean(row[10]),
    alinhamento: toBoolean(row[0]),
    data_lancamento,
    data_alinhamento: toBoolean(row[0]) ? data_lancamento : null,
    status_atual: "CADASTRO INICIAL",
    data_previsao: null,
    data_envio: null,
    data_aprovacao: null,
    data_prazo_ap,
    variacao_cabine: normalizeText(row[12]),
    projeto_base: "",
    aprovacao_final: false,
    local_cabine_final: false,
    data_final: null,
    urgente: normalizeUpperNoAccent(row[15]).includes("ATRAS") || normalizeUpperNoAccent(row[15]).includes("⚠"),
    created_at: data_lancamento,
    updated_at: data_lancamento,
  };

  register(record);
  idCounter += 1;
}

for (const row of anteRows.slice(1)) {
  const construtora = normalizeText(row[0]);
  const obra = normalizeText(row[1]);
  if (!construtora || !obra) continue;

  const engenheiro_nome = normalizeText(row[2]);
  const comp = compositeKey({ construtora, obra, engenheiro_nome });
  const existingId = byComposite.get(comp);

  const mapped = mapStatus(row[4]);
  const data_previsao = toIsoDate(row[3]);
  const data_envio = toIsoDate(row[5]);
  const data_aprovacao = toIsoDate(row[6]);
  const data_prazo_ap = toIsoDate(row[8]);
  const obs = normalizeText(row[7]);

  if (existingId) {
    const current = byId.get(existingId);

    // Ante-projeto always has precedence for workflow status and operational dates.
    if (mapped.status && statusRank(mapped.status) >= statusRank(current.status_atual)) {
      current.status_atual = mapped.status;
    }

    current.urgente = current.urgente || mapped.urgente;
    current.data_previsao = data_previsao ?? current.data_previsao;
    current.data_envio = data_envio ?? current.data_envio;
    current.data_aprovacao = data_aprovacao ?? current.data_aprovacao;
    current.data_prazo_ap = data_prazo_ap ?? current.data_prazo_ap;

    if (obs) {
      current.variacao_cabine = current.variacao_cabine
        ? `${current.variacao_cabine} | ${obs}`
        : obs;
    }

    current.updated_at = [current.updated_at, data_aprovacao, data_envio, data_previsao].filter(Boolean).sort().slice(-1)[0] || current.updated_at;
    continue;
  }

  const data_lancamento = data_envio ?? data_previsao ?? data_aprovacao ?? "2025-01-01";
  const code = fallbackCode({ construtora, obra, equipamento: "", engenheiro_nome }, usedCodes);

  const record = {
    id: `seed-${idCounter}`,
    _composite: comp,
    construtora,
    obra,
    engenheiro_nome,
    engenheiro_celular: "",
    equipamento: "N/I",
    tipo_cabine: "",
    codigo_projeto: code,
    vendedor: "SEM VENDEDOR",
    proj_obra_recebido: false,
    local_cabine_definido: false,
    alinhamento: false,
    data_lancamento,
    data_alinhamento: null,
    status_atual: mapped.status ?? "ELABORAR ANTE-PROJETO",
    data_previsao,
    data_envio,
    data_aprovacao,
    data_prazo_ap,
    variacao_cabine: obs,
    projeto_base: "",
    aprovacao_final: false,
    local_cabine_final: false,
    data_final: null,
    urgente: mapped.urgente,
    created_at: data_lancamento,
    updated_at: data_aprovacao ?? data_envio ?? data_previsao ?? data_lancamento,
  };

  register(record);
  idCounter += 1;
}

const projects = [...byId.values()]
  .map((record) => {
    const project = { ...record };
    delete project._composite;
    return project;
  })
  .sort((a, b) => a.codigo_projeto.localeCompare(b.codigo_projeto));

const header = `import type { Project } from "./project-types";\n\n`;
const projectsLiteral = JSON.stringify(projects, null, 2)
  .replace(/"(id|construtora|obra|engenheiro_nome|engenheiro_celular|equipamento|tipo_cabine|codigo_projeto|vendedor|proj_obra_recebido|local_cabine_definido|alinhamento|data_lancamento|data_alinhamento|status_atual|data_previsao|data_envio|data_aprovacao|data_prazo_ap|variacao_cabine|projeto_base|aprovacao_final|local_cabine_final|data_final|urgente|created_at|updated_at)":/g, "$1:")
  .replace(/"CADASTRO INICIAL"|"ELABORAR ANTE-PROJETO"|"ANTE-PROJETO ENVIADO"|"ANTE-PROJETO APROVADO"|"PROJETO APROVADO"|"PROJETO FINAL ENVIADO"|"REVISAO DE ESTUDO"/g, (m) => m);

const seedOutput = `${header}const SEED_PROJECTS: Project[] = ${projectsLiteral};\n\nexport function buildSeedProjects(): Project[] {\n  return SEED_PROJECTS.map((project) => ({ ...project }));\n}\n`;
fs.writeFileSync(seedOutPath, seedOutput, "utf8");

const directoryOutput = `import { buildSeedProjects } from "./project-seed";\n\nconst projects = buildSeedProjects();\n\nfunction sortValues(values: string[]): string[] {\n  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>\n    a.localeCompare(b, "pt-BR", { sensitivity: "base" }),\n  );\n}\n\nexport const PRESET_CONSTRUTORAS = sortValues(projects.map((project) => project.construtora));\n\nexport const PRESET_OBRAS_BY_CONSTRUTORA: Record<string, string[]> = PRESET_CONSTRUTORAS.reduce(\n  (acc, construtora) => {\n    acc[construtora] = sortValues(\n      projects\n        .filter((project) => project.construtora === construtora)\n        .map((project) => project.obra),\n    );\n    return acc;\n  },\n  {} as Record<string, string[]>,\n);\n\nexport const PRESET_OBRAS = sortValues(projects.map((project) => project.obra));\nexport const PRESET_VENDEDORES = sortValues(projects.map((project) => project.vendedor));\nexport const PRESET_EQUIPAMENTOS = sortValues(projects.map((project) => project.equipamento));\n`;

fs.writeFileSync(directoryOutPath, directoryOutput, "utf8");

console.log(`Generated ${projects.length} unique projects.`);
