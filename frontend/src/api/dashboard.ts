import { apiRequest } from "@/api/client";
import type { DashboardSummary } from "@/api/types";

export function getDashboardSummary() {
  return apiRequest<DashboardSummary>("/dashboard/");
}
