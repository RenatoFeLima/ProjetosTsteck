// Guard de integridade da fonte de produção.
//
// A Vercel compila com Root Directory = web, então /web é a ÚNICA fonte que
// chega em produção. Este script falha (exit 1) se algum arquivo crítico de
// produção sumir de /web — pegando cedo o erro clássico de "implementei na
// pasta errada e funciona local mas não na Vercel".
//
// Rode a partir de /web:  node scripts/check-production-root.mjs
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = dirname(dirname(fileURLToPath(import.meta.url))); // .../web
const fail = (msg) => {
  console.error(`❌ check:production-root — ${msg}`);
  process.exitCode = 1;
};

// 1) Diretórios/arquivos críticos que precisam existir em /web.
const requiredPaths = [
  "app",
  "features",
  "server",
  "prisma",
  "package.json",
  "prisma/schema.prisma",
  "app/api/build-info/route.ts",
  "app/api/projects/[id]/urgency/route.ts",
  "app/api/projects/next-code-suggestion/route.ts",
  "app/api/projects/[id]/status/route.ts",
];

for (const rel of requiredPaths) {
  if (!existsSync(join(webRoot, rel))) fail(`arquivo/pasta de produção ausente em web/: ${rel}`);
}

// 2) Campos críticos do schema Prisma usados por urgência/prazo.
const schemaPath = join(webRoot, "prisma/schema.prisma");
if (existsSync(schemaPath)) {
  const schema = readFileSync(schemaPath, "utf8");
  for (const field of ["urgentDeadline", "urgentReason", "deadline"]) {
    if (!new RegExp(`\\b${field}\\b`).test(schema)) {
      fail(`campo "${field}" ausente em web/prisma/schema.prisma (urgência/prazo dependem dele)`);
    }
  }
}

// 3) A raiz do repositório NÃO pode voltar a ter um app Next duplicado.
const repoRoot = dirname(webRoot);
for (const ghost of ["app", "features", "server"]) {
  if (existsSync(join(repoRoot, ghost))) {
    fail(`a raiz do repo voltou a ter "${ghost}/" — só /web deve conter o app (ver README)`);
  }
}

if (process.exitCode) {
  console.error("\nFonte de produção inconsistente. Corrija antes do deploy.");
} else {
  console.log("✅ check:production-root — /web íntegro; raiz sem app duplicado.");
}
