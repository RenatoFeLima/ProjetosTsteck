"use client";

import React from "react";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type KpiDashboardErrorBoundaryProps = {
  children: ReactNode;
};

type KpiDashboardErrorBoundaryState = {
  hasError: boolean;
};

export class KpiDashboardErrorBoundary extends React.Component<
  KpiDashboardErrorBoundaryProps,
  KpiDashboardErrorBoundaryState
> {
  constructor(props: KpiDashboardErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): KpiDashboardErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch() {
    // Keep UI available even if a KPI metric throws unexpectedly.
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="inline-flex items-center gap-2 font-semibold">
            <AlertTriangle size={16} />
            Metrica indisponivel por ausencia de dados validos.
          </p>
          <p className="mt-1 text-amber-700">Os demais dados da pagina continuam disponiveis.</p>
        </section>
      );
    }

    return this.props.children;
  }
}
