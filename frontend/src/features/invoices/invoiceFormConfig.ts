import type { ApiErrorPayload } from "@/api/client";
import type { InvoicePayload, PaymentPayload } from "@/api/invoices";
import type { InvoiceDetail } from "@/api/types";
import { z } from "zod";

export const invoiceStatuses = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
] as const;

export const paymentMethodOptions = [
  { value: "mtn_momo", label: "MTN MoMo" },
  { value: "telecel", label: "Telecel Cash" },
  { value: "airtel_tigo", label: "AirtelTigo Money" },
  { value: "bank", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
] as const;

const positiveMoneyString = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine((value) => {
      const numericValue = Number.parseFloat(value);
      return !Number.isNaN(numericValue) && numericValue > 0;
    }, `${label} must be positive.`);

export const invoiceLineItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required."),
  quantity: positiveMoneyString("Quantity"),
  unit_price: positiveMoneyString("Unit price"),
});

export const invoiceSchema = z.object({
  client_id: z.string().trim().min(1, "Client is required."),
  project_id: z.string().optional(),
  due_date: z.string().min(1, "Due date is required."),
  notes: z.string(),
  line_items: z
    .array(invoiceLineItemSchema)
    .min(1, "At least one line item is required."),
});

export const paymentSchema = z.object({
  amount: positiveMoneyString("Amount"),
  method: z.string().trim().min(1, "Payment method is required."),
  provider_reference: z.string(),
  notes: z.string(),
  payment_date: z.string().min(1, "Payment date is required."),
}).superRefine((value, context) => {
  if (value.method !== "cash" && !value.provider_reference.trim()) {
    context.addIssue({
      code: "custom",
      message: "Provider reference is required unless the method is cash.",
      path: ["provider_reference"],
    });
  }

  if (value.payment_date > new Date().toISOString().slice(0, 10)) {
    context.addIssue({
      code: "custom",
      message: "Payment date cannot be in the future.",
      path: ["payment_date"],
    });
  }
});

export type InvoiceFormValues = z.infer<typeof invoiceSchema>;
export type PaymentFormValues = z.infer<typeof paymentSchema>;

export type InvoiceFormErrors = Partial<Record<keyof InvoicePayload, string>> & {
  detail?: string;
};

export type PaymentFormErrors = Partial<Record<keyof PaymentPayload, string>> & {
  detail?: string;
};

export const emptyInvoiceLineItem = {
  description: "",
  quantity: "1",
  unit_price: "",
};

export const emptyInvoiceFormState: InvoiceFormValues = {
  client_id: "",
  project_id: "",
  due_date: "",
  notes: "",
  line_items: [emptyInvoiceLineItem],
};

export function createInvoiceFormState(
  invoice?: InvoiceDetail | null,
  clientId?: string,
  projectId?: string,
): InvoiceFormValues {
  if (!invoice) {
    return {
      ...emptyInvoiceFormState,
      client_id: clientId ?? "",
      project_id: projectId ?? "",
      line_items: [{ ...emptyInvoiceLineItem }],
    };
  }

  return {
    client_id: invoice.client,
    project_id: invoice.project ?? "",
    due_date: invoice.due_date ?? "",
    notes: invoice.notes ?? "",
    line_items: invoice.line_items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })),
  };
}

export function normalizeInvoicePayload(form: InvoiceFormValues): InvoicePayload {
  return {
    client_id: form.client_id.trim(),
    project_id: form.project_id?.trim() || null,
    due_date: form.due_date,
    notes: form.notes.trim(),
    line_items: form.line_items.map((item) => ({
      description: item.description.trim(),
      quantity: item.quantity.trim(),
      unit_price: item.unit_price.trim(),
    })),
  };
}

export function createPaymentFormState(): PaymentFormValues {
  return {
    amount: "",
    method: "mtn_momo",
    provider_reference: "",
    notes: "",
    payment_date: new Date().toISOString().slice(0, 10),
  };
}

export function normalizePaymentPayload(form: PaymentFormValues): PaymentPayload {
  return {
    amount: form.amount.trim(),
    method: form.method.trim(),
    provider_reference: form.provider_reference.trim(),
    notes: form.notes.trim(),
    payment_date: form.payment_date,
  };
}

export function mapApiErrors<T extends Record<string, string>>(
  payload: ApiErrorPayload,
): Partial<T> & { detail?: string } {
  const errors: Partial<T> & { detail?: string } = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (key === "detail") {
      errors.detail = Array.isArray(value) ? String(value[0]) : String(value);
      return;
    }

    if (Array.isArray(value) && value.length) {
      errors[key as keyof T] = String(value[0]) as T[keyof T];
      return;
    }

    if (typeof value === "string") {
      errors[key as keyof T] = value as T[keyof T];
    }
  });

  return errors;
}
