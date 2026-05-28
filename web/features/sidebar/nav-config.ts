import {
  BarChart3,
  Bell,
  Box,
  Building2,
  GraduationCap,
  HardHat,
  Kanban,
  LayoutDashboard,
  ScrollText,
  SlidersHorizontal,
  UserRound,
  Wrench,
} from "lucide-react";

import type { ProjectsView } from "@/features/projects/state/projects-store";

export type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  /** Se definido, este item troca a view interna do shell em vez de navegar para uma rota separada */
  view?: ProjectsView;
};

export type NavGroup = {
  title?: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Projetos", href: "/", icon: LayoutDashboard, view: "table" },
      { label: "Kanban", href: "/", icon: Kanban, view: "kanban" },
      { label: "KPIs", href: "/", icon: BarChart3, view: "kpis" },
      { label: "Alertas", href: "/", icon: Bell, view: "alerts" },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { label: "Construtoras", href: "/cadastros/construtoras", icon: Building2 },
      { label: "Obras", href: "/cadastros/obras", icon: HardHat },
      { label: "Equipamentos", href: "/cadastros/equipamentos", icon: Wrench },
      { label: "Tipos de Cabine", href: "/cadastros/tipos-cabine", icon: Box },
      { label: "Vendedores", href: "/cadastros/vendedores", icon: UserRound },
      { label: "Engenheiros", href: "/cadastros/engenheiros", icon: GraduationCap },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Configurações", href: "/configuracoes", icon: SlidersHorizontal },
      { label: "Auditoria", href: "/auditoria", icon: ScrollText },
    ],
  },
];
