"use client";

import { type ComponentType } from "react";
import { Info } from "lucide-react";

export type KpiCardVariant = "neutral" | "info" | "warning" | "danger" | "success" | "brand";

type KpiCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  variant?: KpiCardVariant;
  trend?: string;
  tooltip?: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
};

const VARIANT_STYLES: Record<KpiCardVariant, { stripe: string; icon: string; activeRing: string }> = {
  neutral: { stripe: "bg-zinc-400",      icon: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",       activeRing: "ring-zinc-400/30" },
  info:    { stripe: "bg-sky-500",       icon: "bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300",         activeRing: "ring-sky-400/30" },
  warning: { stripe: "bg-amber-500",    icon: "bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300", activeRing: "ring-amber-400/30" },
  danger:  { stripe: "bg-rose-500",     icon: "bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300",     activeRing: "ring-rose-400/30" },
  success: { stripe: "bg-emerald-500",  icon: "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300", activeRing: "ring-emerald-400/30" },
  brand:   { stripe: "bg-brand",        icon: "bg-brand/10 text-brand",                                               activeRing: "ring-brand/30" },
};

function CardShell({
  children,
  active,
  className,
  style,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const baseClassName = [
    "group relative overflow-hidden rounded-2xl border bg-white dark:bg-panel text-left transition-all duration-150",
    "shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)]",
    "hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25",
    active ? "border-brand/40 ring-2 ring-brand/10" : "border-zinc-200/70 dark:border-white/8",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (onClick) {
    return (
      <button type="button" aria-pressed={active} onClick={onClick} className={baseClassName} style={style}>
        {children}
      </button>
    );
  }

  return <article className={baseClassName} style={style}>{children}</article>;
}

export function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "neutral",
  trend,
  tooltip,
  active = false,
  onClick,
  className,
  style,
}: KpiCardProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <CardShell active={active} className={className} style={style} onClick={onClick}>
      {/* Faixa de acento colorida no topo */}
      <div className={`absolute inset-x-0 top-0 h-[3px] ${styles.stripe}`} />
      <div className="flex h-full min-h-[108px] flex-col p-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            <span className="truncate">{title}</span>
            {tooltip && (
              <span title={tooltip} className="shrink-0">
                <Info size={10} className="text-zinc-300" />
              </span>
            )}
          </p>
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${styles.icon}`}>
            <Icon size={14} />
          </span>
        </div>
        <p className="mt-1.5 font-display text-[1.9rem] font-bold leading-none tracking-tight text-zinc-900 dark:text-foreground">
          {value}
        </p>
        <div className="mt-auto pt-2">
          {description && <p className="text-[10px] leading-4 text-zinc-400 dark:text-zinc-500">{description}</p>}
          {trend && <p className="mt-0.5 text-[10px] font-semibold text-zinc-500 dark:text-muted">{trend}</p>}
        </div>
      </div>
    </CardShell>
  );
}
