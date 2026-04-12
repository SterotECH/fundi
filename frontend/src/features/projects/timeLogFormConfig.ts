import type { ApiErrorPayload } from "@/api/client";
import type { TimeLogPayload } from "@/api/projects";
import type { TimeLog } from "@/api/types";
import { z } from "zod";

const today = () => new Date().toISOString().slice(0, 10);

const hoursString = z
  .string()
  .trim()
  .min(1, "Hours are required.")
  .refine((value) => {
    const numericValue = Number.parseFloat(value);
    return !Number.isNaN(numericValue) && numericValue >= 0.5 && numericValue <= 24;
  }, "Hours must be between 0.5 and 24.");

export const timeLogSchema = z.object({
  project_id: z.string().trim().min(1, "Project is required."),
  log_date: z
    .string()
    .min(1, "Date is required.")
    .refine((value) => value <= today(), "Date cannot be in the future."),
  hours: hoursString,
  description: z.string().trim().min(1, "Description is required."),
  billable: z.boolean(),
});

export type TimeLogFormValues = z.infer<typeof timeLogSchema>;
export type TimeLogFormErrors = Partial<Record<keyof TimeLogPayload, string>> & {
  detail?: string;
};

export function createTimeLogFormState(
  timeLog?: TimeLog | null,
  initialProjectId?: string,
): TimeLogFormValues {
  if (!timeLog) {
    return {
      project_id: initialProjectId ?? "",
      log_date: today(),
      hours: "1",
      description: "",
      billable: true,
    };
  }

  return {
    project_id: timeLog.project,
    log_date: timeLog.log_date,
    hours: timeLog.hours,
    description: timeLog.description,
    billable: timeLog.billable,
  };
}

export function normalizeTimeLogPayload(form: TimeLogFormValues): TimeLogPayload {
  return {
    project_id: form.project_id.trim(),
    log_date: form.log_date,
    hours: form.hours.trim(),
    description: form.description.trim(),
    billable: form.billable,
  };
}

export function mapTimeLogApiErrors(
  payload: ApiErrorPayload,
): TimeLogFormErrors {
  const errors: TimeLogFormErrors = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (key === "detail") {
      errors.detail = Array.isArray(value) ? String(value[0]) : String(value);
      return;
    }

    if (Array.isArray(value) && value.length) {
      errors[key as keyof TimeLogPayload] = String(value[0]);
      return;
    }

    if (typeof value === "string") {
      errors[key as keyof TimeLogPayload] = value;
    }
  });

  return errors;
}
