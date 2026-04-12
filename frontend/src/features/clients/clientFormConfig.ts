import type { ApiErrorPayload } from "@/api/client";
import type { ClientPayload } from "@/api/clients";
import { z } from "zod";

export const clientTypeOptions = [
  { value: "shs", label: "SHS" },
  { value: "jhs", label: "JHS" },
  { value: "intl", label: "International" },
  { value: "uni", label: "University" },
] as const;

export type ClientFormErrors = Partial<Record<keyof ClientPayload, string>> & {
  detail?: string;
};

export const clientSchema = z.object({
  type: z.enum(["shs", "jhs", "intl", "uni"], {
    error: "Client type is required.",
  }),
  name: z.string().trim().min(1, "Client name is required."),
  email: z
    .string()
    .trim()
    .refine((value) => value === "" || z.email().safeParse(value).success, {
      message: "Enter a valid email address.",
    }),
  contact_person: z.string(),
  phone: z.string(),
  address: z.string(),
  region: z.string(),
  notes: z.string(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

export const initialClientFormState: ClientFormValues = {
  type: "shs",
  name: "",
  email: "",
  contact_person: "",
  phone: "",
  address: "",
  region: "Greater Accra",
  notes: "",
};

export function normalizeClientPayload(form: ClientFormValues): ClientPayload {
  return {
    ...form,
    name: form.name.trim(),
    email: form.email.trim(),
    contact_person: form.contact_person.trim(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    region: form.region.trim(),
    notes: form.notes.trim(),
  };
}

export function mapClientApiErrors(payload: ApiErrorPayload): ClientFormErrors {
  const errors: ClientFormErrors = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (key === "detail") {
      errors.detail = Array.isArray(value) ? String(value[0]) : String(value);
      return;
    }

    if (Array.isArray(value) && value.length) {
      errors[key as keyof ClientPayload] = String(value[0]);
      return;
    }

    if (typeof value === "string") {
      errors[key as keyof ClientPayload] = value;
    }
  });

  return errors;
}
