"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ClipboardList, Plus, Zap } from "lucide-react";
import { ProjectsAlerts } from "./projects-alerts";
import { ProjectFormModal } from "./project-form-modal";
import { ProjectsKanban } from "./projects-kanban";
import { ProjectsKpiCards } from "./projects-kpi-cards";
import { ProjectsTable } from "./projects-table";
import { ProjectsToolbar } from "./projects-toolbar";
import { ProjectDetailsDrawer } from "./project-details-drawer";
import { ProjectsKpiDashboard } from "./projects-kpi-dashboard";
import { ProjectStatusChangeDialog } from "./project-status-change-dialog";
import { KpiDashboardErrorBoundary } from "./kpi-dashboard-error-boundary";
import { PageContainer } from "./page-container";
import { useProjectsStore } from "@/features/projects/state/projects-store";
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";
import { computePrazoBadge, computePrazoEntrega, todayIsoDate } from "@/features/projects/domain/project-rules";
import type { Project, ProjectStatus } from "@/features/projects/domain/project-types";
import { sendProjectNotification } from "@/features/projects/services/project-notification-service";

export function ProjectsPageShell() {
  const {
    projects: allProjects,
    activeView,
    setActiveView,
    filters,
    setFilters,
    filteredProjects,
    createProject,
    updateProject,
    deleteProject,
    toggleUrgente,
    moveStatus,
    statusHistory,
    getProjectStatusHistory,
    getProjectObservations,
    isCodigoProjetoDuplicado,
    addObservation,
  } = useProjectsStore();

  const { vendedores } = useMasterDataStore();

  /** Retorna e-mail do vendedor pelo nome cadastrado. */
  function getVendorEmail(vendedorName: string): string | undefined {
    const found = vendedores.find(
      (v) => v.name.toLowerCase().trim() === vendedorName.toLowerCase().trim() && v.active,
    );
    return found?.email?.trim() || undefined;
  }

  const [modalOpen, setModalOpen] = useState(false);
  const [quickCreate, setQuickCreate] = useState(false);
  const [drawerContext, setDrawerContext] = useState<{
    projectId: string;
    mode: "view" | "edit";
    section: "overview" | "history";
  } | null>(null);
  const [statusChangeProject, setStatusChangeProject] = useState<Project | undefined>(undefined);
  const [toast, setToast] = useState<string>("");
  const [tableState, setTableState] = useState<"loading" | "ready" | "error">("loading");
  const [kpiFilter, setKpiFilter] = useState<"all" | "total" | "andamento" | "atrasados" | "urgentes" | "finalizados">("all");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>("");
  const [newProjectDropOpen, setNewProjectDropOpen] = useState(false);

  const baseProjects = filteredProjects();
  const detailsProject = useMemo(
    () => (drawerContext ? allProjects.find((project) => project.id === drawerContext.projectId) : undefined),
    [drawerContext, allProjects],
  );

  const history = useMemo(
    () => (drawerContext ? getProjectStatusHistory(drawerContext.projectId) : []),
    [drawerContext, getProjectStatusHistory],
  );

  const observations = useMemo(
    () => (drawerContext ? getProjectObservations(drawerContext.projectId) : []),
    [drawerContext, getProjectObservations],
  );

  const kpis = useMemo(() => {
    const total = baseProjects.length;
    const atrasados = baseProjects.filter((project) => {
      const prazo = computePrazoEntrega(project.data_alinhamento, project.proj_obra_recebido && project.local_cabine_definido);
      return computePrazoBadge(todayIsoDate(), prazo) === "atrasado";
    }).length;
    const urgentes = baseProjects.filter((project) => project.urgente).length;
    const finalizados = baseProjects.filter((project) => project.status_atual === "PROJETO FINAL ENVIADO").length;
    const andamento = Math.max(total - finalizados, 0);

    return { total, atrasados, urgentes, finalizados, andamento };
  }, [baseProjects]);

  const projects = useMemo(() => {
    if (kpiFilter === "all" || kpiFilter === "total") return baseProjects;
    if (kpiFilter === "urgentes") return baseProjects.filter((project) => project.urgente);
    if (kpiFilter === "finalizados") return baseProjects.filter((project) => project.status_atual === "PROJETO FINAL ENVIADO");
    if (kpiFilter === "atrasados") {
      return baseProjects.filter((project) => {
        const prazo = computePrazoEntrega(project.data_alinhamento, project.proj_obra_recebido && project.local_cabine_definido);
        return computePrazoBadge(todayIsoDate(), prazo) === "atrasado";
      });
    }
    return baseProjects.filter((project) => project.status_atual !== "PROJETO FINAL ENVIADO");
  }, [baseProjects, kpiFilter]);

  const alerts = useMemo(
    () =>
      projects.filter((project) => {
        const prazo = computePrazoEntrega(project.data_alinhamento, project.proj_obra_recebido && project.local_cabine_definido);
        const badge = computePrazoBadge(todayIsoDate(), prazo);
        return project.urgente || badge === "atrasado" || badge === "atencao";
      }),
    [projects],
  );

  const tabCounts = useMemo(
    () => ({ table: projects.length, kanban: projects.length, kpis: allProjects.length, alerts: alerts.length }),
    [projects.length, allProjects.length, alerts.length],
  );

  useEffect(() => {
    setLastUpdatedAt(new Date().toLocaleString());
    const timer = window.setTimeout(() => setTableState("ready"), 420);
    return () => window.clearTimeout(timer);
  }, []);

  function touchLastUpdated() {
    setLastUpdatedAt(new Date().toLocaleString());
  }

  function handleFiltersChange(patch: Parameters<typeof setFilters>[0]) {
    setFilters(patch);
    touchLastUpdated();
  }

  function openCreate() {
    setDrawerContext(null);
    setQuickCreate(false);
    setModalOpen(true);
  }

  function openQuickCreate() {
    setDrawerContext(null);
    setQuickCreate(true);
    setModalOpen(true);
  }

  function openDrawer(project: Project, mode: "view" | "edit", section: "overview" | "history") {
    setDrawerContext({ projectId: project.id, mode, section });
  }

  function openDetails(project: Project) {
    openDrawer(project, "view", "overview");
  }

  function openEdit(project: Project) {
    openDrawer(project, "edit", "overview");
  }

  function openHistory(project: Project) {
    openDrawer(project, "view", "history");
  }

  function openStatusDialog(project: Project) {
    setStatusChangeProject(project);
  }

  function applyStatusChange(nextStatus: ProjectStatus, observation?: string) {
    const project = statusChangeProject;
    if (!project) return;

    const oldStatus = project.status_atual;
    const result = moveStatus(project.id, nextStatus, "acao-rapida");
    if (!result.ok) {
      notify(result.error ?? "Nao foi possivel alterar o status.");
      return;
    }

    if (observation?.trim()) {
      addObservation(
        project.id,
        `Mudanca de status via menu de acoes: ${oldStatus} -> ${nextStatus}. Observacao: ${observation.trim()}`,
        "usuario.local",
      );
    }

    setStatusChangeProject(undefined);
    touchLastUpdated();
    notify("Status atualizado com sucesso.");

    // Disparar e-mail ao vendedor (fire-and-forget)
    const sellerEmail = getVendorEmail(project.vendedor);
    if (sellerEmail) {
      const isFinished = nextStatus === "PROJETO FINAL ENVIADO";
      sendProjectNotification({
        projectId: project.id,
        projectCode: project.codigo_projeto,
        constructorName: project.construtora,
        workName: project.obra,
        sellerName: project.vendedor,
        sellerEmail,
        oldStatus,
        newStatus: nextStatus,
        eventType: isFinished ? "PROJECT_FINISHED" : "STATUS_CHANGED",
        changedBy: "usuario.local",
        changedAt: new Date().toISOString(),
        notes: observation?.trim() || undefined,
      }).then((emailResult) => {
        if (!emailResult.success) {
          addObservation(project.id, `Falha ao enviar e-mail para [${sellerEmail}].`, "sistema");
          notify("Status atualizado, mas não foi possível enviar o e-mail ao vendedor.");
        } else {
          addObservation(project.id, `E-mail enviado para [${sellerEmail}] sobre alteração de status.`, "sistema");
        }
      });
    } else if (project.vendedor && project.vendedor !== "SEM VENDEDOR") {
      addObservation(project.id, "E-mail não enviado: vendedor sem e-mail cadastrado.", "sistema");
    }
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }

  function markUrgentWithReason(payload: { projectId: string; urgencyReason: string; updatedAt: string; updatedBy: string }) {
    const target = baseProjects.find((project) => project.id === payload.projectId);
    if (!target || target.urgente) return;

    toggleUrgente(payload.projectId);

    const when = new Date(payload.updatedAt).toLocaleString();
    addObservation(
      payload.projectId,
      `Projeto marcado como urgente por ${payload.updatedBy} em ${when}. Justificativa: ${payload.urgencyReason}`,
      payload.updatedBy,
    );

    touchLastUpdated();
    notify("Projeto marcado como urgente.");

    // Disparar e-mail ao vendedor (fire-and-forget)
    const sellerEmail = getVendorEmail(target.vendedor);
    if (sellerEmail) {
      sendProjectNotification({
        projectId: target.id,
        projectCode: target.codigo_projeto,
        constructorName: target.construtora,
        workName: target.obra,
        sellerName: target.vendedor,
        sellerEmail,
        newStatus: target.status_atual,
        eventType: "MARKED_URGENT",
        changedBy: payload.updatedBy,
        changedAt: payload.updatedAt,
        urgencyReason: payload.urgencyReason,
      }).then((emailResult) => {
        if (!emailResult.success) {
          addObservation(target.id, `Falha ao enviar e-mail para [${sellerEmail}].`, "sistema");
        } else {
          addObservation(target.id, `E-mail enviado para [${sellerEmail}] sobre marcação de urgência.`, "sistema");
        }
      });
    } else if (target.vendedor && target.vendedor !== "SEM VENDEDOR") {
      addObservation(target.id, "E-mail não enviado: vendedor sem e-mail cadastrado.", "sistema");
    }
  }

  function removeUrgent(project: Project) {
    if (!project.urgente) return;

    toggleUrgente(project.id);
    const by = "usuario.local";
    const when = new Date().toLocaleString();
    addObservation(project.id, `Urgencia removida por ${by} em ${when}.`, by);

    touchLastUpdated();
    notify("Urgencia removida do projeto.");

    // Disparar e-mail ao vendedor (fire-and-forget)
    const sellerEmail = getVendorEmail(project.vendedor);
    if (sellerEmail) {
      sendProjectNotification({
        projectId: project.id,
        projectCode: project.codigo_projeto,
        constructorName: project.construtora,
        workName: project.obra,
        sellerName: project.vendedor,
        sellerEmail,
        newStatus: project.status_atual,
        eventType: "URGENCY_REMOVED",
        changedBy: by,
        changedAt: new Date().toISOString(),
      }).then((emailResult) => {
        if (!emailResult.success) {
          addObservation(project.id, `Falha ao enviar e-mail para [${sellerEmail}].`, "sistema");
        } else {
          addObservation(project.id, `E-mail enviado para [${sellerEmail}] sobre remoção de urgência.`, "sistema");
        }
      });
    }
  }

  function retryTableLoad() {
    setTableState("loading");
    window.setTimeout(() => {
      setTableState("ready");
      touchLastUpdated();
    }, 500);
  }

  function clearAllFilters() {
    setFilters({
      search: "",
      status: "all",
      construtora: "",
      obra: "",
      vendedor: "",
      equipamento: "",
      atrasadoOnly: false,
      urgenteOnly: false,
    });
    setKpiFilter("all");
    touchLastUpdated();
  }

  return (
    <main className="py-4 md:py-6">
      <PageContainer>
        {/* Header compacto */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[1.05rem] font-semibold tracking-tight text-zinc-900 dark:text-foreground">Projetos</h1>
            <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
              Controle operacional dos projetos de engenharia
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdatedAt && (
              <span className="hidden text-[11px] text-zinc-400 dark:text-zinc-500 sm:block">
                Atualizado: {lastUpdatedAt}
              </span>
            )}
            {/* Dropdown Novo Projeto */}
            <div
              className="relative"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setNewProjectDropOpen(false);
                }
              }}
            >
              <button
                type="button"
                onClick={() => setNewProjectDropOpen((o) => !o)}
                aria-label="Novo projeto"
                aria-expanded={newProjectDropOpen}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-dark"
              >
                <Plus size={14} />
                Novo projeto
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-150 ${newProjectDropOpen ? "rotate-180" : ""}`}
                />
              </button>
              {newProjectDropOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-zinc-200/70 dark:border-white/8 bg-white dark:bg-panel shadow-[0_8px_24px_-6px_rgba(0,0,0,0.14)]">
                  <button
                    type="button"
                    onClick={() => {
                      openQuickCreate();
                      setNewProjectDropOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/5"
                  >
                    <Zap size={13} className="text-amber-500" />
                    Cadastro rápido
                  </button>
                  <div className="mx-3 h-px bg-zinc-100 dark:bg-white/8" />
                  <button
                    type="button"
                    onClick={() => {
                      openCreate();
                      setNewProjectDropOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/5"
                  >
                    <ClipboardList size={13} className="text-brand" />
                    Cadastro completo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <ProjectsToolbar
          view={activeView}
          onViewChange={setActiveView}
          onClearFilters={clearAllFilters}
          tabCounts={tabCounts}
          filters={filters}
          onFiltersChange={handleFiltersChange}
        />

        <section className="mt-4">
          <ProjectsKpiCards
            total={kpis.total}
            andamento={kpis.andamento}
            atrasados={kpis.atrasados}
            urgentes={kpis.urgentes}
            finalizados={kpis.finalizados}
            active={kpiFilter}
            onSelect={(key) => {
              setKpiFilter(key === "total" ? "all" : key);
              touchLastUpdated();
            }}
          />
        </section>

        <section className="mt-4">
          {activeView === "table" && (
          <ProjectsTable
            projects={projects}
            onViewDetails={openDetails}
            onEditProject={openEdit}
            onChangeStatus={openStatusDialog}
            onViewHistory={openHistory}
            onMarkUrgente={markUrgentWithReason}
            onRemoveUrgente={removeUrgent}
            onClearFilters={clearAllFilters}
            state={tableState}
            onRetry={retryTableLoad}
          />
        )}
          {activeView === "kanban" && (
          <ProjectsKanban
            projects={projects}
            onOpen={openDetails}
            notify={notify}
            onMoveStatus={(projectId, status, observation) => {
              const current = projects.find((item) => item.id === projectId);
              const oldStatus = current?.status_atual;
              const result = moveStatus(projectId, status, "kanban");

              if (result.ok && current) {
                const message = observation?.trim()
                  ? `Mudanca de status via Kanban: ${oldStatus} -> ${status}. Observacao: ${observation.trim()}`
                  : `Mudanca de status via Kanban: ${oldStatus} -> ${status}.`;
                addObservation(projectId, message, "usuario.local");
                touchLastUpdated();

                // Disparar e-mail ao vendedor (fire-and-forget)
                const sellerEmail = getVendorEmail(current.vendedor);
                if (sellerEmail) {
                  const isFinished = status === "PROJETO FINAL ENVIADO";
                  sendProjectNotification({
                    projectId: current.id,
                    projectCode: current.codigo_projeto,
                    constructorName: current.construtora,
                    workName: current.obra,
                    sellerName: current.vendedor,
                    sellerEmail,
                    oldStatus,
                    newStatus: status,
                    eventType: isFinished ? "PROJECT_FINISHED" : "STATUS_CHANGED",
                    changedBy: "usuario.local",
                    changedAt: new Date().toISOString(),
                    notes: observation?.trim() || undefined,
                  }).then((emailResult) => {
                    if (!emailResult.success) {
                      addObservation(projectId, `Falha ao enviar e-mail para [${sellerEmail}].`, "sistema");
                    } else {
                      addObservation(projectId, `E-mail enviado para [${sellerEmail}] sobre alteração de status.`, "sistema");
                    }
                  });
                } else if (current.vendedor && current.vendedor !== "SEM VENDEDOR") {
                  addObservation(projectId, "E-mail não enviado: vendedor sem e-mail cadastrado.", "sistema");
                }
              }

              if (!result.ok) notify(result.error ?? "Falha na movimentacao");
              return result;
            }}
          />
        )}
          {activeView === "kpis" && (
            <KpiDashboardErrorBoundary>
              <ProjectsKpiDashboard
                projects={allProjects}
                statusHistory={statusHistory}
              />
            </KpiDashboardErrorBoundary>
          )}
          {activeView === "alerts" && <ProjectsAlerts projects={alerts} onOpen={openDetails} />}
        </section>

        {tableState === "error" && (
          <section className="mt-6 rounded-2xl border border-red-200 dark:border-red-700/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <p className="inline-flex items-center gap-2 font-semibold">
              <AlertTriangle size={16} />
              Erro ao sincronizar dados locais desta visualizacao.
            </p>
          </section>
        )}

        <ProjectFormModal
          open={modalOpen}
          mode="create"
          quickMode={quickCreate}
          statusHistory={[]}
          observations={[]}
          onClose={() => {
            setModalOpen(false);
          }}
          onCreate={(input) => createProject(input as Parameters<typeof createProject>[0])}
          onUpdate={updateProject}
          onDelete={deleteProject}
          onMoveStatus={(id, status) => moveStatus(id, status, "formulario")}
          isCodigoDuplicado={isCodigoProjetoDuplicado}
          onAddObservation={(id, text) => addObservation(id, text, "usuario.local")}
          notify={notify}
        />

        {detailsProject && (
          <ProjectDetailsDrawer
            key={`${drawerContext?.projectId}-${drawerContext?.mode}-${drawerContext?.section}`}
            open={true}
            project={detailsProject}
            initialMode={drawerContext?.mode}
            initialSection={drawerContext?.section}
            statusHistory={history}
            observations={observations}
            onClose={() => setDrawerContext(null)}
            onUpdate={updateProject}
            onAddObservation={(id, text) => addObservation(id, text, "usuario.local")}
            isCodigoDuplicado={isCodigoProjetoDuplicado}
            notify={notify}
          />
        )}

        {statusChangeProject && (
          <ProjectStatusChangeDialog
            key={statusChangeProject.id}
            open={true}
            project={statusChangeProject}
            onCancel={() => setStatusChangeProject(undefined)}
            onConfirm={applyStatusChange}
          />
        )}

        {toast && (
          <div className="fixed right-4 bottom-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>
        )}
      </PageContainer>
    </main>
  );
}
