import { Activity, AlertOctagon, CheckCircle2, Clock4, FolderKanban } from "lucide-react";
import { KpiCard } from "./kpi-card";

type ProjectsKpiCardsProps = {
  total: number;
  andamento: number;
  atrasados: number;
  urgentes: number;
  finalizados: number;
  active?: "all" | KpiKey;
  onSelect?: (key: "all" | "total" | "andamento" | "atrasados" | "urgentes" | "finalizados") => void;
};

type KpiKey = "total" | "andamento" | "atrasados" | "urgentes" | "finalizados";

const KPI_META: Array<{
  key: KpiKey;
  label: string;
  helper: string;
  icon: typeof FolderKanban;
  accent: string;
}> = [
  { key: "total", label: "Total de Projetos", helper: "Projetos cadastrados", icon: FolderKanban, accent: "from-zinc-200/60 to-zinc-100" },
  { key: "andamento", label: "Em Andamento", helper: "Dentro do fluxo", icon: Activity, accent: "from-sky-200/60 to-sky-100" },
  { key: "atrasados", label: "Atrasados", helper: "Fora do prazo", icon: Clock4, accent: "from-rose-200/70 to-rose-100" },
  { key: "urgentes", label: "Urgentes", helper: "Com prioridade", icon: AlertOctagon, accent: "from-red-200/70 to-red-100" },
  { key: "finalizados", label: "Finalizados", helper: "Concluidos", icon: CheckCircle2, accent: "from-emerald-200/70 to-emerald-100" },
];

export function ProjectsKpiCards({ total, andamento, atrasados, urgentes, finalizados, active = "all", onSelect }: ProjectsKpiCardsProps) {
  const values: Record<KpiKey, number> = { total, andamento, atrasados, urgentes, finalizados };

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {KPI_META.map((item, index) => {
        return (
          <KpiCard
            key={item.key}
            title={item.label}
            value={String(values[item.key])}
            description={item.helper}
            icon={item.icon}
            variant={item.key === "atrasados" ? "danger" : item.key === "urgentes" ? "brand" : item.key === "finalizados" ? "success" : item.key === "andamento" ? "info" : "neutral"}
            active={active === item.key}
            onClick={() => onSelect?.(item.key)}
            className="animate-[fadeScaleIn_220ms_ease-out]"
            style={{ animationDelay: `${index * 60}ms` }}
          />
        );
      })}
    </section>
  );
}
