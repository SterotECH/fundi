import { apiRequest } from "@/api/client";
import type { AssistantBriefing, AssistantQueryResponse } from "@/api/types";

export function getAssistantBriefing() {
  return apiRequest<AssistantBriefing>("/assistant/briefing/");
}

export type AssistantQueryContext = {
  proposal_id?: string;
  invoice_id?: string;
  client_id?: string;
  project_id?: string;
};

export function queryAssistant(message: string, context?: AssistantQueryContext) {
  return apiRequest<AssistantQueryResponse>("/assistant/query/", {
    method: "POST",
    body: context ? { message, context } : { message },
  });
}
