import type { ApiErrorPayload } from "@/api/client";
import type { ProposalPayload } from "@/api/proposals";
import type { Proposal } from "@/api/types";
import { z } from "zod";

export const proposalStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "negotiating", label: "Negotiating" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
] as const;

export type ProposalFormErrors = Partial<Record<keyof ProposalPayload, string>> & {
  detail?: string;
  convert?: string;
  start_date?: string;
  due_date?: string;
};

export const initialProposalFormState: ProposalPayload = {
  client_id: "",
  title: "",
  description: "",
  deadline: "",
  amount: "",
  notes: "",
};

export function normalizeProposalPayload(form: ProposalPayload): ProposalPayload {
  return {
    client_id: form.client_id.trim(),
    title: form.title.trim(),
    description: form.description.trim(),
    deadline: form.deadline,
    amount: form.amount.trim(),
    notes: form.notes.trim(),
  };
}

export function createProposalSchema(mode: "create" | "edit") {
  return z.object({
    client_id: z.string().trim().min(1, "Client is required."),
    title: z.string().trim().min(1, "Title is required."),
    description: z.string().trim().min(1, "Description is required."),
    deadline: z
      .string()
      .min(1, "Deadline is required.")
      .refine(
        (value) =>
          mode === "edit" || value >= new Date().toISOString().slice(0, 10),
        "Deadline cannot be in the past.",
      ),
    amount: z
      .string()
      .trim()
      .min(1, "Amount is required.")
      .refine(
        (value) => {
          const numericValue = Number.parseFloat(value);
          return !Number.isNaN(numericValue) && numericValue > 0;
        },
        "Amount must be positive.",
      ),
    notes: z.string(),
  });
}

export type ProposalFormValues = z.infer<ReturnType<typeof createProposalSchema>>;

export function createProposalFormState(
  proposal?: Proposal | null,
  clientId?: string,
): ProposalFormValues {
  if (!proposal) {
    return {
      ...initialProposalFormState,
      client_id: clientId ?? "",
    };
  }

  return {
    client_id: proposal.client,
    title: proposal.title,
    description: proposal.description,
    deadline: proposal.deadline,
    amount: proposal.amount,
    notes: proposal.notes ?? "",
  };
}

export function mapProposalApiErrors(payload: ApiErrorPayload): ProposalFormErrors {
  const errors: ProposalFormErrors = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (key === "detail") {
      errors.detail = Array.isArray(value) ? String(value[0]) : String(value);
      return;
    }

    if (Array.isArray(value) && value.length) {
      errors[key as keyof ProposalFormErrors] = String(value[0]);
      return;
    }

    if (typeof value === "string") {
      errors[key as keyof ProposalFormErrors] = value;
    }
  });

  return errors;
}
