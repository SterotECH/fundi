import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownUp, ChevronDown, FileText, Search } from "lucide-react";

import { listClients } from "@/api/clients";
import { listProjects, listTimeLogs, type ProjectListFilters } from "@/api/projects";
import type { Project } from "@/api/types";
import { EmptyState } from "@/components/status/EmptyState";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { FilterPill } from "@/components/ui/FilterPill";
import { StatCard } from "@/components/ui/StatCard";
import { ProjectDrawer } from "@/features/projects/ProjectDrawer";
import { formatCurrencyValue } from "@/utils/currency";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getProjectStatusClassName(status: string) {
  if (status === "active") return "project-status-chip project-status-active";
  if (status === "planning") return "project-status-chip project-status-planning";
  if (status === "hold") return "project-status-chip project-status-hold";
  return "project-status-chip project-status-done";
}

function getDueDateClassName(project: Project) {
  if (project.status === "done") return "project-due-date";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${project.due_date}T00:00:00`);
  const diffInDays = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);

  if (diffInDays < 0) return "project-due-date project-due-date-overdue";
  if (diffInDays <= 14) return "project-due-date project-due-date-soon";
  return "project-due-date";
}

function getBurnMetrics(project: Project, totalHours: number) {
  if (!project.budget) {
    return { label: "0% burned", tone: "project-burn-fill-ok", width: 0 };
  }

  const budget = Number.parseFloat(project.budget || "0");
  if (budget <= 0) {
    return { label: "0% burned", tone: "project-burn-fill-ok", width: 0 };
  }

  const roughSpend = totalHours * 100;
  const percent = Math.max(0, Math.min(100, Math.round((roughSpend / budget) * 100)));

  if (percent >= 90) {
    return { label: `${percent}% burned`, tone: "project-burn-fill-over", width: percent };
  }

  if (percent >= 60) {
    return { label: `${percent}% burned`, tone: "project-burn-fill-warn", width: percent };
  }

  return { label: `${percent}% burned`, tone: "project-burn-fill-ok", width: percent };
}

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Active", value: "active" },
  { label: "Planning", value: "planning" },
  { label: "On hold", value: "hold" },
  { label: "Done", value: "done" },
] as const;

export function ProjectsPage() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<ProjectListFilters>({});
  const [searchQuery, setSearchQuery] = useState("");

  const projectsQuery = useQuery({
    queryKey: ["projects", filters],
    queryFn: () => listProjects(filters),
  });
  const clientsQuery = useQuery({
    queryKey: ["project-filter-clients"],
    queryFn: () => listClients({ isArchived: "false" }),
  });
  const timeLogsQuery = useQuery({
    queryKey: ["project-list-timelogs"],
    queryFn: () => listTimeLogs(),
  });

  const timeSummaryByProject = useMemo(() => {
    const summary = new Map<string, { billableHours: number; totalHours: number }>();

    for (const log of timeLogsQuery.data ?? []) {
      const current = summary.get(log.project) ?? { billableHours: 0, totalHours: 0 };
      const hours = Number.parseFloat(log.hours || "0");
      current.totalHours += hours;
      if (log.billable) {
        current.billableHours += hours;
      }
      summary.set(log.project, current);
    }

    return summary;
  }, [timeLogsQuery.data]);

  const rows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = (projectsQuery.data ?? []).filter((project) => {
      if (!query) {
        return true;
      }

      return [project.title, project.client_name, project.proposal_title, project.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    return [...filtered].sort(
      (left, right) =>
        new Date(left.due_date).getTime() - new Date(right.due_date).getTime(),
    );
  }, [projectsQuery.data, searchQuery]);

  const metrics = useMemo(() => {
    const projects = projectsQuery.data ?? [];
    const clients = new Set(projects.map((project) => project.client).filter(Boolean));
    const activeProjects = projects.filter((project) => project.status === "active");

    return {
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      dueThisMonth: activeProjects.filter((project) => {
        const dueDate = new Date(`${project.due_date}T00:00:00`);
        const today = new Date();
        return (
          dueDate.getMonth() === today.getMonth() &&
          dueDate.getFullYear() === today.getFullYear()
        );
      }).length,
      totalBudget: activeProjects.reduce(
        (total, project) => total + Number.parseFloat(project.budget || "0"),
        0,
      ),
      totalHours: projects.reduce(
        (total, project) => total + (timeSummaryByProject.get(project.id)?.totalHours ?? 0),
        0,
      ),
      billableHours: projects.reduce(
        (total, project) => total + (timeSummaryByProject.get(project.id)?.billableHours ?? 0),
        0,
      ),
      clientCount: clients.size,
    };
  }, [projectsQuery.data, timeSummaryByProject]);

  const currentSortLabel = "Sort by due date";

  const columns = useMemo<DataTableColumn<Project>[]>(
    () => [
      {
        key: "project",
        header: "Project",
        width: "28%",
        cell: (project) => (
          <div className="project-title-cell">
            <p className="project-title-text">{project.title}</p>
            <div className="project-proposal-ref">
              <FileText className="h-3 w-3" />
              <span>
                {project.proposal_title
                  ? `From proposal · ${formatCurrencyValue(project.budget)}`
                  : "Manual project"}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: "client",
        header: "Client",
        width: "18%",
        cell: (project) => (
          <div className="project-client-cell">
            <span className="list-avatar list-avatar-sm">
              {getInitials(project.client_name || "Client")}
            </span>
            <span className="project-client-name">{project.client_name}</span>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: "14%",
        cell: (project) => (
          <span className={getProjectStatusClassName(project.status)}>
            <span className="project-status-dot" />
            <span>{project.status === "hold" ? "On hold" : project.status}</span>
          </span>
        ),
      },
      {
        key: "due_date",
        header: "Due date",
        width: "14%",
        cell: (project) => (
          <span className={getDueDateClassName(project)}>{formatDate(project.due_date)}</span>
        ),
      },
      {
        key: "budget",
        header: "Budget",
        width: "14%",
        cell: (project) => {
          const burnMetrics = getBurnMetrics(
            project,
            timeSummaryByProject.get(project.id)?.totalHours ?? 0,
          );

          return (
            <div>
              <p className="project-budget-value">{formatCurrencyValue(project.budget)}</p>
              <div className="project-burn-wrap">
                <span className="project-burn-track">
                  <span
                    className={`project-burn-fill ${burnMetrics.tone}`}
                    style={{ display: "block", width: `${burnMetrics.width}%` }}
                  />
                </span>
                <span className="project-burn-label">{burnMetrics.label}</span>
              </div>
            </div>
          );
        },
      },
      {
        key: "hours",
        header: "Hours",
        width: "12%",
        className: "project-hours-cell",
        cell: (project) => (
          <div className="project-hours-cell">
            <p className="project-hours-value">
              {(timeSummaryByProject.get(project.id)?.totalHours ?? 0).toFixed(1)}h
            </p>
            <p className="project-hours-sub">
              {(timeSummaryByProject.get(project.id)?.billableHours ?? 0).toFixed(1)}h billable
            </p>
          </div>
        ),
      },
    ],
    [timeSummaryByProject],
  );

  return (
    <section className="space-y-6">
      <ProjectDrawer onClose={() => setIsDrawerOpen(false)} open={isDrawerOpen} />

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="mt-1 text-sm text-text-secondary">
            All client projects — active, planning, on hold, and completed
          </p>
        </div>
        <Button onClick={() => setIsDrawerOpen(true)}>New Project</Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          color="primary"
          description={`across ${metrics.clientCount} clients`}
          label="Total projects"
          size="sm"
          value={metrics.totalProjects}
        />
        <StatCard
          color="forest"
          description={`${metrics.dueThisMonth} due this month`}
          label="Active"
          size="sm"
          value={metrics.activeProjects}
        />
        <StatCard
          color="ocean"
          description="across active projects"
          label="Total budget"
          size="sm"
          value={formatCurrencyValue(metrics.totalBudget)}
        />
        <StatCard
          color="sunset"
          description={
            metrics.totalHours > 0
              ? `${Math.round((metrics.billableHours / metrics.totalHours) * 100)}% billable`
              : "No time logged yet"
          }
          label="Hours logged"
          size="sm"
          value={`${metrics.totalHours.toFixed(1)}h`}
        />
      </div>

      <div className="project-toolbar">
        <div className="project-search-wrap">
          <Search className="h-4 w-4" />
          <input
            className="project-search-input"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search projects..."
            type="search"
            value={searchQuery}
          />
        </div>

        <div className="project-filter-group">
          {STATUS_OPTIONS.map((option) => (
            <FilterPill
              active={(filters.status ?? "") === option.value}
              activeClassName="project-filter-chip-active"
              className="project-filter-chip"
              key={option.value || "all"}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  status: option.value || undefined,
                }))
              }
            >
              {option.label}
            </FilterPill>
          ))}
        </div>

        <div className="project-client-filter-wrap">
          <select
            className="project-client-filter"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                clientId: event.target.value || undefined,
              }))
            }
            value={filters.clientId ?? ""}
          >
            <option value="">All clients</option>
            {(clientsQuery.data ?? []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <ChevronDown className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="project-panel">
        <div className="project-panel-header">
          <span className="project-panel-count">{rows.length} projects</span>
          <span className="project-panel-sort">
            <ArrowDownUp className="h-3.5 w-3.5" />
            {currentSortLabel}
          </span>
        </div>

        <DataTable
          columns={columns}
          emptyState={
            projectsQuery.isError ? (
              <EmptyState
                tone="error"
                title="Projects could not load"
                description="Refresh the page or sign in again if the session expired."
              />
            ) : (
              <EmptyState
                action={<Button onClick={() => setIsDrawerOpen(true)}>New Project</Button>}
                title="No projects yet"
                description="Projects appear here after manual creation or proposal conversion."
              />
            )
          }
          enableColumnToggle={false}
          getRowHref={(project) => `/projects/${project.id}`}
          loading={projectsQuery.isLoading || timeLogsQuery.isLoading}
          mobileCard={(project) => (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="project-title-text">{project.title}</p>
                  <p className="project-proposal-ref">
                    {project.proposal_title
                      ? `From proposal · ${formatCurrencyValue(project.budget)}`
                      : "Manual project"}
                  </p>
                </div>
                <span className={getProjectStatusClassName(project.status)}>
                  <span className="project-status-dot" />
                  <span>{project.status === "hold" ? "On hold" : project.status}</span>
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="data-table-mobile-label">Client</p>
                  <p className="mt-1 project-client-name">{project.client_name}</p>
                </div>
                <div>
                  <p className="data-table-mobile-label">Due date</p>
                  <p className={`mt-1 ${getDueDateClassName(project)}`}>{formatDate(project.due_date)}</p>
                </div>
                <div>
                  <p className="data-table-mobile-label">Budget</p>
                  <p className="mt-1 project-budget-value">{formatCurrencyValue(project.budget)}</p>
                </div>
                <div>
                  <p className="data-table-mobile-label">Hours</p>
                  <p className="mt-1 project-hours-value">
                    {(timeSummaryByProject.get(project.id)?.totalHours ?? 0).toFixed(1)}h
                  </p>
                </div>
              </div>
            </div>
          )}
          rowKey={(project) => project.id}
          rows={rows}
          shellClassName="border-0 bg-transparent shadow-none"
          variant="list"
        />
      </div>
    </section>
  );
}
