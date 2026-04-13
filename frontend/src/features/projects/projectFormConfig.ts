import type { ApiErrorPayload } from "@/api/client";
import type { MilestonePayload, ProjectPayload } from "@/api/projects";
import type { Milestone, ProjectDetail } from "@/api/types";
import { z } from "zod";

export const projectStatusOptions = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "hold", label: "Hold" },
  { value: "done", label: "Done" },
] as const;

const positiveMoneyString = z
  .string()
  .trim()
  .min(1, "Budget is required.")
  .refine((value) => {
    const numericValue = Number.parseFloat(value);
    return !Number.isNaN(numericValue) && numericValue > 0;
  }, "Budget must be positive.");

export const projectSchema = z
  .object({
    client_id: z.string().trim().min(1, "Client is required."),
    proposal_id: z.string(),
    title: z.string().trim().min(1, "Project title is required."),
    description: z.string(),
    status: z.enum(["planning", "active", "hold", "done"], {
      message: "Status is required.",
    }),
    start_date: z.string().min(1, "Start date is required."),
    due_date: z.string().min(1, "Due date is required."),
    budget: positiveMoneyString,
  })
  .refine((value) => value.due_date >= value.start_date, {
    message: "Due date cannot be before start date.",
    path: ["due_date"],
  });

export type ProjectFormValues = z.infer<typeof projectSchema>;
export type ProjectFormErrors = Partial<Record<keyof ProjectPayload, string>> & {
  detail?: string;
};

export const milestoneSchema = z.object({
  title: z.string().trim().min(1, "Milestone title is required."),
  description: z.string(),
  due_date: z.string().min(1, "Due date is required."),
  completed: z.boolean(),
  order: z
    .number()
    .int()
    .min(0, "Order must be zero or greater."),
});

export type MilestoneFormValues = z.infer<typeof milestoneSchema>;
export type MilestoneFormErrors = Partial<Record<keyof MilestonePayload, string>> & {
  detail?: string;
};

export function createProjectFormState(
  project?: ProjectDetail | null,
  clientId?: string,
): ProjectFormValues {
  if (!project) {
    const today = new Date().toISOString().slice(0, 10);
    return {
      client_id: clientId ?? "",
      proposal_id: "",
      title: "",
      description: "",
      status: "planning",
      start_date: today,
      due_date: today,
      budget: "",
    };
  }

  return {
    client_id: project.client,
    proposal_id: project.proposal ?? "",
    title: project.title,
    description: project.description ?? "",
    status: project.status as ProjectFormValues["status"],
    start_date: project.start_date,
    due_date: project.due_date,
    budget: project.budget,
  };
}

export function normalizeProjectPayload(form: ProjectFormValues): ProjectPayload {
  return {
    client_id: form.client_id.trim(),
    proposal_id: form.proposal_id.trim() || null,
    title: form.title.trim(),
    description: form.description.trim(),
    status: form.status,
    start_date: form.start_date,
    due_date: form.due_date,
    budget: form.budget.trim(),
  };
}

export function createMilestoneFormState(
  milestone?: Milestone | null,
  nextOrder = 0,
): MilestoneFormValues {
  return {
    title: milestone?.title ?? "",
    description: milestone?.description ?? "",
    due_date: milestone?.due_date ?? "",
    completed: milestone?.completed ?? false,
    order: milestone?.order ?? nextOrder,
  };
}

export function normalizeMilestonePayload(
  form: MilestoneFormValues,
): MilestonePayload {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    due_date: form.due_date,
    completed: form.completed,
    order: form.order,
  };
}

function mapErrors<T extends string>(
  payload: ApiErrorPayload,
): Partial<Record<T, string>> & { detail?: string } {
  const errors: Partial<Record<T, string>> & { detail?: string } = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (key === "detail") {
      errors.detail = Array.isArray(value) ? String(value[0]) : String(value);
      return;
    }

    if (Array.isArray(value) && value.length) {
      errors[key as T] = String(value[0]) as (typeof errors)[T];
      return;
    }

    if (typeof value === "string") {
      errors[key as T] = value as (typeof errors)[T];
    }
  });

  return errors;
}

export function mapProjectApiErrors(payload: ApiErrorPayload) {
  return mapErrors<Extract<keyof ProjectPayload, string>>(payload);
}

export function mapMilestoneApiErrors(payload: ApiErrorPayload) {
  return mapErrors<Extract<keyof MilestonePayload, string>>(payload);
}
