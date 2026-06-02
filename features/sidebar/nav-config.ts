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
import type { UserPermissions } from "@/features/auth/lib/auth-types";

export type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  /** Se definido, este item troca a view interna do shell em vez de navegar para uma rota separada */
  view?: ProjectsView;
  /** Permissão necessária para ver o item. Se ausente, é sempre visível. */
  permission?: (p: UserPermissions) => boolean;
};

export type NavGroup = {
  title?: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Projetos", href: "/", icon: LayoutDashboard, view: "table", permission: (p) => p.projects.view },
      { label: "Kanban", href: "/", icon: Kanban, view: "kanban", permission: (p) => p.kanban.view },
      { label: "KPIs", href: "/", icon: BarChart3, view: "kpis", permission: (p) => p.kpis.view },
      { label: "Alertas", href: "/", icon: Bell, view: "alerts", permission: (p) => p.alerts.view },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { label: "Construtoras", href: "/cadastros/construtoras", icon: Building2, permission: (p) => p.masterData.view },
      { label: "Obras", href: "/cadastros/obras", icon: HardHat, permission: (p) => p.masterData.view },
      { label: "Equipamentos", href: "/cadastros/equipamentos", icon: Wrench, permission: (p) => p.masterData.view },
      { label: "Tipos de Cabine", href: "/cadastros/tipos-cabine", icon: Box, permission: (p) => p.masterData.view },
      { label: "Vendedores", href: "/cadastros/vendedores", icon: UserRound, permission: (p) => p.masterData.view },
      { label: "Engenheiros", href: "/cadastros/engenheiros", icon: GraduationCap, permission: (p) => p.masterData.view },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Configurações", href: "/configuracoes", icon: SlidersHorizontal, permission: (p) => p.settings.view },
      { label: "Auditoria", href: "/auditoria", icon: ScrollText, permission: (p) => p.audit.view },
    ],
  },
];
