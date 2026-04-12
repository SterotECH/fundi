import { apiRequest, type PaginatedResponse, unwrapResults } from "@/api/client";
import type { Project, ProjectTimeLogsResponse, TimeLog } from "@/api/types";

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
