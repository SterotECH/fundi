import { apiRequest, type PaginatedResponse, unwrapResults } from "@/api/client";
import type { Client, Project, Proposal } from "@/api/types";

export type ClientPayload = {
  type: string;
  name: string;
  email: string;
  contact_person: string;
  phone: string;
  address: string;
  region: string;
  notes: string;
};

export type ClientListFilters = {
  search?: string;
  isArchived?: "true" | "false" | "";
  type?: string;
};

export async function listClients(filters: ClientListFilters = {}) {
  const params = new URLSearchParams();

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.isArchived) {
    params.set("is_archived", filters.isArchived);
  }

  if (filters.type) {
    params.set("type", filters.type);
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiRequest<PaginatedResponse<Client>>(`/clients/${query}`);
  return unwrapResults(payload);
}

export function createClient(data: ClientPayload) {
  return apiRequest<Client>("/clients/", {
    method: "POST",
    body: data,
  });
}

export function updateClient(clientId: string, data: ClientPayload) {
  return apiRequest<Client>(`/clients/${clientId}/`, {
    method: "PATCH",
    body: data,
  });
}

export function archiveClient(clientId: string) {
  return apiRequest<void>(`/clients/${clientId}/`, {
    method: "DELETE",
  });
}

export function getClient(clientId: string) {
  return apiRequest<Client>(`/clients/${clientId}/`);
}

export function listClientProposals(clientId: string) {
  return apiRequest<Proposal[]>(`/clients/${clientId}/proposals/`);
}

export function listClientProjects(clientId: string) {
  return apiRequest<Project[]>(`/clients/${clientId}/projects/`);
}
