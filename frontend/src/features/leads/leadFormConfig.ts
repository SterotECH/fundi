import type { ApiErrorPayload } from "@/api/client";
import type { ConvertLeadPayload, LeadPayload } from "@/api/leads";
import type { Lead } from "@/api/types";
import { z } from "zod";

export const leadSourceOptions = [
  { value: "referral", label: "Referral" },
  { value: "website", label: "Website" },
  { value: "event", label: "Event" },
  { value: "cold", label: "Cold" },
] as const;

export const leadStatusOptions = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "converted", label: "Converted" },
  { value: "dead", label: "Dead" },
] as const;

export const leadSchema = z.object({
  name: z.string().trim().min(1, "Lead name is required."),
  contact_person: z.string(),
  email: z
    .string()
    .trim()
    .refine((value) => value === "" || z.email().safeParse(value).success, {
      message: "Enter a valid email address.",
    }),
  phone: z.string(),
  source: z.enum(["referral", "website", "event", "cold"], {
    error: "Source is required.",
  }),
  status: z.enum(["new", "contacted", "qualified", "converted", "dead"], {
    error: "Status is required.",
  }),
  notes: z.string(),
});

export const convertLeadSchema = z.object({
  type: z.enum(["shs", "jhs", "intl", "uni"], {
    error: "Client type is required.",
  }),
  contact_person: z.string(),
  phone: z.string(),
  address: z.string(),
  region: z.string(),
  notes: z.string(),
  email: z
    .string()
    .trim()
    .refine((value) => value === "" || z.email().safeParse(value).success, {
      message: "Enter a valid email address.",
    }),
});

export type LeadFormValues = z.infer<typeof leadSchema>;
export type ConvertLeadFormValues = z.infer<typeof convertLeadSchema>;

export type LeadFormErrors = Partial<Record<keyof LeadPayload, string>> & {
  detail?: string;
};

export type ConvertLeadFormErrors = Partial<Record<keyof ConvertLeadPayload, string>> & {
  detail?: string;
};

export const initialLeadFormState: LeadFormValues = {
  name: "",
  contact_person: "",
  email: "",
  phone: "",
  source: "referral",
  status: "new",
  notes: "",
};

export function createLeadFormState(lead?: Lead | null): LeadFormValues {
  if (!lead) {
    return initialLeadFormState;
  }

  return {
    name: lead.name,
    contact_person: lead.contact_person ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    source: lead.source as LeadFormValues["source"],
    status: lead.status as LeadFormValues["status"],
    notes: lead.notes ?? "",
  };
}

export function createConvertLeadFormState(lead: Lead): ConvertLeadFormValues {
  return {
    type: "shs",
    contact_person: lead.contact_person ?? "",
    phone: lead.phone ?? "",
    address: "",
    region: "Greater Accra",
    notes: "",
    email: lead.email ?? "",
  };
}

export function normalizeLeadPayload(form: LeadFormValues): LeadPayload {
  return {
    name: form.name.trim(),
    contact_person: form.contact_person.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    source: form.source,
    status: form.status,
    notes: form.notes.trim(),
  };
}

export function normalizeConvertLeadPayload(
  form: ConvertLeadFormValues,
): ConvertLeadPayload {
  return {
    type: form.type,
    contact_person: form.contact_person.trim(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    region: form.region.trim(),
    notes: form.notes.trim(),
    email: form.email.trim(),
  };
}

export function mapLeadApiErrors(payload: ApiErrorPayload): LeadFormErrors {
  const errors: LeadFormErrors = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (key === "detail") {
      errors.detail = Array.isArray(value) ? String(value[0]) : String(value);
      return;
    }

    if (Array.isArray(value) && value.length) {
      errors[key as keyof LeadPayload] = String(value[0]);
      return;
    }

    if (typeof value === "string") {
      errors[key as keyof LeadPayload] = value;
    }
  });

  return errors;
}

export function mapConvertLeadApiErrors(
  payload: ApiErrorPayload,
): ConvertLeadFormErrors {
  const errors: ConvertLeadFormErrors = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (key === "detail") {
      errors.detail = Array.isArray(value) ? String(value[0]) : String(value);
      return;
    }

    if (Array.isArray(value) && value.length) {
      errors[key as keyof ConvertLeadPayload] = String(value[0]);
      return;
    }

    if (typeof value === "string") {
      errors[key as keyof ConvertLeadPayload] = value;
    }
  });

  return errors;
}
