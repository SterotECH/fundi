import { apiRequest, type PaginatedResponse, unwrapResults } from "@/api/client";
import type {
  Invoice,
  Milestone,
  Project,
  ProjectDetail,
  ProjectTimeLogsResponse,
  TimeLog,
} from "@/api/types";

export type ProjectListFilters = {
  status?: string;
  clientId?: string;
};

export type TimeLogListFilters = {
  projectId?: string;
  billable?: "true" | "false" | "";
  logDateGte?: string;
  logDateLte?: string;
};

export type TimeLogPayload = {
  project_id: string;
  log_date: string;
  hours: string;
  description: string;
  billable: boolean;
};

export type ProjectPayload = {
  client_id: string;
  proposal_id?: string | null;
  title: string;
  description: string;
  status: string;
  start_date: string;
  due_date: string;
  budget: string;
  milestones?: MilestonePayload[];
};

export type MilestonePayload = {
  title: string;
  description: string;
  due_date: string;
  completed?: boolean;
  order: number;
};

export async function listProjects(filters: ProjectListFilters = {}) {
  const params = new URLSearchParams();

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.clientId) {
    params.set("client_id", filters.clientId);
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiRequest<PaginatedResponse<Project>>(`/projects/${query}`);
  return unwrapResults(payload);
}

export function getProject(projectId: string) {
  return apiRequest<ProjectDetail>(`/projects/${projectId}/`);
}

export function createProject(data: ProjectPayload) {
  return apiRequest<ProjectDetail>("/projects/", {
    method: "POST",
    body: data,
  });
}

export function updateProject(projectId: string, data: Partial<ProjectPayload>) {
  return apiRequest<ProjectDetail>(`/projects/${projectId}/`, {
    method: "PATCH",
    body: data,
  });
}

export function listProjectMilestones(projectId: string) {
  return apiRequest<Milestone[]>(`/projects/${projectId}/milestones/`);
}

export function createProjectMilestone(projectId: string, data: MilestonePayload) {
  return apiRequest<Milestone>(`/projects/${projectId}/milestones/`, {
    method: "POST",
    body: data,
  });
}

export function updateProjectMilestone(
  projectId: string,
  milestoneId: string,
  data: Partial<MilestonePayload>,
) {
  return apiRequest<Milestone>(`/projects/${projectId}/milestones/${milestoneId}/`, {
    method: "PATCH",
    body: data,
  });
}

export function deleteProjectMilestone(projectId: string, milestoneId: string) {
  return apiRequest<void>(`/projects/${projectId}/milestones/${milestoneId}/`, {
    method: "DELETE",
  });
}

export async function listTimeLogs(filters: TimeLogListFilters = {}) {
  const params = new URLSearchParams();

  if (filters.projectId) {
    params.set("project_id", filters.projectId);
  }

  if (filters.billable) {
    params.set("billable", filters.billable);
  }

  if (filters.logDateGte) {
    params.set("log_date__gte", filters.logDateGte);
  }

  if (filters.logDateLte) {
    params.set("log_date__lte", filters.logDateLte);
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiRequest<PaginatedResponse<TimeLog>>(`/timelogs/${query}`);
  return unwrapResults(payload);
}

export function getProjectTimeLogs(projectId: string) {
  return apiRequest<ProjectTimeLogsResponse>(`/projects/${projectId}/timelogs/`);
}

export function listProjectInvoices(projectId: string) {
  return apiRequest<Invoice[]>(`/projects/${projectId}/invoices/`);
}

export function createTimeLog(data: TimeLogPayload) {
  return apiRequest<TimeLog>("/timelogs/", {
    method: "POST",
    body: data,
  });
}

export function updateTimeLog(timeLogId: string, data: TimeLogPayload) {
  return apiRequest<TimeLog>(`/timelogs/${timeLogId}/`, {
    method: "PATCH",
    body: data,
  });
}

export function deleteTimeLog(timeLogId: string) {
  return apiRequest<void>(`/timelogs/${timeLogId}/`, {
    method: "DELETE",
  });
}
