import { apiRequest, type PaginatedResponse, unwrapResults } from "@/api/client";
import type { Client, Lead } from "@/api/types";

export type LeadPayload = {
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  notes: string;
};

export type ConvertLeadPayload = {
  type: string;
  contact_person: string;
  phone: string;
  address: string;
  region: string;
  notes: string;
  email: string;
};

export type LeadListFilters = {
  search?: string;
  source?: string;
  status?: string;
};

export async function listLeads(filters: LeadListFilters = {}) {
  const params = new URLSearchParams();

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.source) {
    params.set("source", filters.source);
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiRequest<PaginatedResponse<Lead>>(`/leads/${query}`);
  return unwrapResults(payload);
}

export function createLead(data: LeadPayload) {
  return apiRequest<Lead>("/leads/", {
    method: "POST",
    body: data,
  });
}

export function updateLead(leadId: string, data: LeadPayload) {
  return apiRequest<Lead>(`/leads/${leadId}/`, {
    method: "PATCH",
    body: data,
  });
}

export function markLeadDead(leadId: string) {
  return apiRequest<Lead>(`/leads/${leadId}/mark-dead/`, {
    method: "POST",
  });
}

export function convertLeadToClient(leadId: string, data: ConvertLeadPayload) {
  return apiRequest<Client>(`/leads/${leadId}/convert/`, {
    method: "POST",
    body: data,
  });
}
