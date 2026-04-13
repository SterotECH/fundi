import { apiRequest } from "@/api/client";
import type {
  ClientProfitabilityRow,
  Insight,
  PipelineMetrics,
  ProjectBudgetBurnRow,
  RevenueSeries,
  RevenueSummary,
} from "@/api/types";

export function getRevenueSeries(months = 12) {
  return apiRequest<RevenueSeries>(`/analytics/revenue/?months=${months}`);
}

export function getRevenueSummary() {
  return apiRequest<RevenueSummary>("/analytics/revenue/summary/");
}

export function getPipelineMetrics() {
  return apiRequest<PipelineMetrics>("/analytics/pipeline/");
}

export function getClientProfitability(sortBy: "revenue" | "hours" | "rate" = "revenue") {
  return apiRequest<ClientProfitabilityRow[]>(`/analytics/clients/?sort_by=${sortBy}`);
}

export function getProjectBudgetBurn() {
  return apiRequest<ProjectBudgetBurnRow[]>("/analytics/projects/");
}

export function getInsights() {
  return apiRequest<Insight[]>("/analytics/insights/");
}
