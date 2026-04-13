import { apiRequest, type PaginatedResponse, unwrapResults } from "@/api/client";
import type { Project, Proposal } from "@/api/types";

export type ProposalPayload = {
  client_id: string;
  title: string;
  description: string;
  deadline: string;
  amount: string;
  notes: string;
};

export type ProposalListFilters = {
  search?: string;
  status?: string;
  ordering?: "deadline" | "-deadline" | "";
  clientId?: string;
};

export async function listProposals(filters: ProposalListFilters = {}) {
  const params = new URLSearchParams();

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.ordering) {
    params.set("ordering", filters.ordering);
  }

  if (filters.clientId) {
    params.set("client_id", filters.clientId);
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiRequest<PaginatedResponse<Proposal>>(`/proposals/${query}`);
  return unwrapResults(payload);
}

export function getProposal(proposalId: string) {
  return apiRequest<Proposal>(`/proposals/${proposalId}/`);
}

export function createProposal(data: ProposalPayload) {
  return apiRequest<Proposal>("/proposals/", {
    method: "POST",
    body: data,
  });
}

export function updateProposal(proposalId: string, data: ProposalPayload) {
  return apiRequest<Proposal>(`/proposals/${proposalId}/`, {
    method: "PATCH",
    body: data,
  });
}

export function transitionProposal(proposalId: string, status: string) {
  return apiRequest<Proposal>(`/proposals/${proposalId}/transition/`, {
    method: "POST",
    body: { status },
  });
}

export type ProposalConvertPayload = {
  title?: string;
  start_date: string;
  due_date: string;
};

export function convertProposalToProject(
  proposalId: string,
  data: ProposalConvertPayload,
) {
  return apiRequest<Project>(`/proposals/${proposalId}/convert/`, {
    method: "POST",
    body: data,
  });
}

export function deleteProposal(proposalId: string) {
  return apiRequest<void>(`/proposals/${proposalId}/`, {
    method: "DELETE",
  });
}
