import { apiRequest, type PaginatedResponse, unwrapResults } from "@/api/client";
import type { Invoice, InvoiceDetail, Payment } from "@/api/types";

export type InvoiceListFilters = {
  status?: string;
  clientId?: string;
  projectId?: string;
};

export type InvoiceLineItemPayload = {
  description: string;
  quantity: string;
  unit_price: string;
};

export type InvoicePayload = {
  client_id: string;
  project_id?: string | null;
  due_date: string;
  notes: string;
  line_items: InvoiceLineItemPayload[];
};

export type PaymentPayload = {
  amount: string;
  method: string;
  provider_reference: string;
  notes: string;
  payment_date: string;
};

export async function listInvoices(filters: InvoiceListFilters = {}) {
  const params = new URLSearchParams();

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.clientId) {
    params.set("client_id", filters.clientId);
  }

  if (filters.projectId) {
    params.set("project_id", filters.projectId);
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiRequest<PaginatedResponse<Invoice>>(`/invoices/${query}`);
  return unwrapResults(payload);
}

export function getInvoice(invoiceId: string) {
  return apiRequest<InvoiceDetail>(`/invoices/${invoiceId}/`);
}

export function createInvoice(data: InvoicePayload) {
  return apiRequest<InvoiceDetail>("/invoices/", {
    method: "POST",
    body: data,
  });
}

export function updateInvoice(invoiceId: string, data: InvoicePayload) {
  return apiRequest<InvoiceDetail>(`/invoices/${invoiceId}/`, {
    method: "PATCH",
    body: data,
  });
}

export function deleteInvoice(invoiceId: string) {
  return apiRequest<void>(`/invoices/${invoiceId}/`, {
    method: "DELETE",
  });
}

export function sendInvoice(invoiceId: string) {
  return apiRequest<InvoiceDetail>(`/invoices/${invoiceId}/send/`, {
    method: "POST",
    body: {},
  });
}

export async function listInvoicePayments(invoiceId: string) {
  const payload = await apiRequest<Payment[] | PaginatedResponse<Payment>>(
    `/invoices/${invoiceId}/payments/`,
  );
  return unwrapResults(payload);
}

export function recordPayment(invoiceId: string, data: PaymentPayload) {
  return apiRequest<Payment>(`/invoices/${invoiceId}/payments/`, {
    method: "POST",
    body: data,
  });
}

export function deletePayment(invoiceId: string, paymentId: string) {
  return apiRequest<void>(`/invoices/${invoiceId}/payments/${paymentId}/`, {
    method: "DELETE",
  });
}
