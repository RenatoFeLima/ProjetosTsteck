import { addDays, formatISO } from "date-fns";
import type { Project, ProjectStatus } from "./project-types";

const STATUSES: ProjectStatus[] = [
  "ELABORAR ANTE-PROJETO",
  "ANTE-PROJETO ENVIADO",
  "ANTE-PROJETO APROVADO",
  "PROJETO APROVADO",
  "PROJETO FINAL ENVIADO",
  "REVISAO DE ESTUDO",
];

function iso(daysOffset: number): string {
  return formatISO(addDays(new Date(), daysOffset), { representation: "date" });
}

export function buildSeedProjects(): Project[] {
  const rows: Project[] = [];
  for (let i = 0; i < 24; i += 1) {
    const hasAlignment = i % 5 !== 0;
    const status = STATUSES[i % STATUSES.length];
    rows.push({
      id: `seed-${i + 1}`,
      construtora: ["Atlas", "Brisa", "Civis", "Delta"][i % 4],
      obra: `Obra ${String(i + 1).padStart(2, "0")}`,
      engenheiro_nome: i % 2 === 0 ? `Engenheiro ${i + 1}` : "",
      engenheiro_celular: i % 2 === 0 ? "11999999999" : "",
      equipamento: ["EK-15/26", "EK-20/30", "M-13/18", "SC-15/30"][i % 4],
      tipo_cabine: ["SIMPLES", "DUPLA", "ESPECIAL", "SIMPLES + C.O."][i % 4],
      codigo_projeto: `CRE-MOCK-${1500 + i}`,
      vendedor: ["LUCIANO", "ERICA", "MONICA", "RENATO", "SIMONE"][i % 5],
      proj_obra_recebido: i % 3 !== 0,
      local_cabine_definido: i % 4 !== 0,
      alinhamento: hasAlignment,
      data_lancamento: iso(-(50 + i)),
      data_alinhamento: hasAlignment ? iso(-(20 + i)) : null,
      status_atual: status,
      data_envio: statusOrder(status) >= 1 ? iso(-(12 + i)) : null,
      data_aprovacao: statusOrder(status) >= 2 ? iso(-(8 + i)) : null,
      urgente: i === 0 || i % 11 === 0,
      created_at: iso(-(50 + i)),
      updated_at: iso(-(1 + (i % 5))),
    });
  }

  return rows;
}

function statusOrder(status: ProjectStatus): number {
  return STATUSES.indexOf(status);
}
