import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CreditCard,
  Pencil,
  Printer,
  Send,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

import {
  deleteInvoice,
  deletePayment,
  getInvoice,
  listInvoicePayments,
  sendInvoice,
} from "@/api/invoices";
import type { Payment } from "@/api/types";
import { queryClient } from "@/app/queryClient";
import { EmptyState } from "@/components/status/EmptyState";
import { LoadingState } from "@/components/status/LoadingState";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/authContext";
import { InvoiceDrawer } from "@/features/invoices/InvoiceDrawer";
import { PaymentDialog } from "@/features/invoices/PaymentDialog";
import { formatCurrencyValue } from "@/utils/currency";

function formatCompactDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function getInvoiceChipClassName(status: string) {
  const styles: Record<string, string> = {
    draft: "invoice-status-chip invoice-status-chip-draft",
    sent: "invoice-status-chip invoice-status-chip-sent",
    partial: "invoice-status-chip invoice-status-chip-partial",
    paid: "invoice-status-chip invoice-status-chip-paid",
    overdue: "invoice-status-chip invoice-status-chip-overdue",
  };

  return styles[status] || "invoice-status-chip invoice-status-chip-draft";
}

function getInvoiceChipLabel(status: string) {
  if (status === "partial") {
    return "Partial payment";
  }

  return status.replaceAll("_", " ");
}

export function InvoiceDetailPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { invoiceId = "" } = useParams();
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);

  const invoiceQuery = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => getInvoice(invoiceId),
    enabled: Boolean(invoiceId),
  });
  const paymentsQuery = useQuery({
    queryKey: ["invoice", invoiceId, "payments"],
    queryFn: () => listInvoicePayments(invoiceId),
    enabled: Boolean(invoiceId),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendInvoice(invoiceId),
    onSuccess: async (invoice) => {
      await queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({
        queryKey: ["client", invoice.client, "invoices"],
      });
      setIsSendDialogOpen(false);
    },
  });
  const deleteInvoiceMutation = useMutation({
    mutationFn: () => deleteInvoice(invoiceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate("/invoices");
    },
  });
  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: string) => deletePayment(invoiceId, paymentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      await queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId, "payments"] });
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setPaymentToDelete(null);
    },
  });

  if (invoiceQuery.isLoading) {
    return <LoadingState label="Loading invoice..." />;
  }

  if (invoiceQuery.isError || !invoiceQuery.data) {
    return (
      <EmptyState
        tone="error"
        title="Invoice not found"
        description="This invoice does not exist in your organisation."
      />
    );
  }

  const invoice = invoiceQuery.data;
  const payments = paymentsQuery.data ?? invoice.payments;
  const canEditDraft = invoice.status === "draft";
  const canRecordPayment = invoice.status !== "draft" && invoice.status !== "paid";
  const organisationName = user?.organisation_name?.trim() || "Organisation";

  return (
    <section>
      <InvoiceDrawer
        invoice={invoice}
        key={`${invoice.id}-${isInvoiceDrawerOpen ? "open" : "closed"}`}
        onClose={() => setIsInvoiceDrawerOpen(false)}
        open={isInvoiceDrawerOpen}
      />
      <PaymentDialog
        invoiceId={invoice.id}
        key={`${invoice.id}-${isPaymentDialogOpen ? "payment-open" : "payment-closed"}`}
        onClose={() => setIsPaymentDialogOpen(false)}
        open={isPaymentDialogOpen}
        remainingAmount={invoice.amount_remaining}
      />

      <AlertDialog
        confirmLabel="Send invoice"
        confirmLoading={sendMutation.isPending}
        description="The backend will assign the invoice number, set the issue date, and move this invoice to sent."
        onCancel={() => {
          if (!sendMutation.isPending) {
            setIsSendDialogOpen(false);
          }
        }}
        onConfirm={() => sendMutation.mutate()}
        open={isSendDialogOpen}
        title="Send invoice"
      />
      <AlertDialog
        confirmLabel="Delete draft"
        confirmLoading={deleteInvoiceMutation.isPending}
        description="Delete this draft invoice and its line items. Sent or paid invoices cannot be deleted."
        onCancel={() => {
          if (!deleteInvoiceMutation.isPending) {
            setIsDeleteDialogOpen(false);
          }
        }}
        onConfirm={() => deleteInvoiceMutation.mutate()}
        open={isDeleteDialogOpen}
        title="Delete draft invoice"
        tone="danger"
      />
      <AlertDialog
        confirmLabel="Delete payment"
        confirmLoading={deletePaymentMutation.isPending}
        description="Remove this payment record and recalculate the invoice status."
        onCancel={() => {
          if (!deletePaymentMutation.isPending) {
            setPaymentToDelete(null);
          }
        }}
        onConfirm={() => {
          if (paymentToDelete) {
            deletePaymentMutation.mutate(paymentToDelete.id);
          }
        }}
        open={Boolean(paymentToDelete)}
        title="Delete payment"
        tone="danger"
      />

      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
        to="/invoices"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to invoices
      </Link>

      <header className="invoice-action-bar mt-4 rounded-lg border border-border bg-card px-5 py-5 md:px-6">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
          <div className="min-w-0">
            <p className="page-eyebrow">Invoice</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="page-title font-mono">
                {invoice.invoice_number || "Draft invoice"}
              </h1>
            </div>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              {invoice.client_name}
              {invoice.project_title ? ` · ${invoice.project_title}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canEditDraft ? (
              <Button
                leadingIcon={<Pencil className="h-4 w-4" />}
                onClick={() => setIsInvoiceDrawerOpen(true)}
                variant="secondary"
              >
                Edit
              </Button>
            ) : null}
            {canEditDraft ? (
              <Button
                leadingIcon={<Send className="h-4 w-4" />}
                onClick={() => setIsSendDialogOpen(true)}
              >
                Send
              </Button>
            ) : null}
            {canRecordPayment ? (
              <Button
                leadingIcon={<CreditCard className="h-4 w-4" />}
                onClick={() => setIsPaymentDialogOpen(true)}
                variant="success"
              >
                Record Payment
              </Button>
            ) : null}
            {canEditDraft ? (
              <Button
                className="text-error-hover"
                leadingIcon={<Trash2 className="h-4 w-4" />}
                onClick={() => setIsDeleteDialogOpen(true)}
                variant="secondary"
              >
                Delete
              </Button>
            ) : null}
            <Button
              leadingIcon={<Printer className="h-4 w-4" />}
              onClick={() => window.print()}
              variant="secondary"
            >
              Print
            </Button>
          </div>
        </div>
      </header>

      <section className="invoice-document-shell mt-6">
        <div className="invoice-document">
          <div className="invoice-document-top">
            <div className="invoice-document-brand">
              <div className="invoice-document-logo">ST</div>
              <div>
                <div className="invoice-document-company">{organisationName}</div>
              </div>
            </div>

            <div className="invoice-document-meta">
              <div className="invoice-document-number">
                {invoice.invoice_number || "Draft invoice"}
              </div>
              <div className="invoice-document-dates">
                Issued: {formatCompactDate(invoice.issue_date)} · Due:{" "}
                {formatCompactDate(invoice.due_date)}
              </div>
              <div className="mt-2">
                <span className={getInvoiceChipClassName(invoice.status)}>
                  {getInvoiceChipLabel(invoice.status)}
                </span>
              </div>
            </div>
          </div>

          <div className="invoice-document-grid">
            <div className="invoice-document-block">
              <div className="invoice-document-label">Bill to</div>
              <div className="invoice-document-name">{invoice.client_name}</div>
              <div className="invoice-document-sub">Client account</div>
            </div>
            <div className="invoice-document-block">
              <div className="invoice-document-label">Project</div>
              <div className="invoice-document-name">
                {invoice.project_title || "Unlinked"}
              </div>
              <div className="invoice-document-sub">
                {invoice.project ? "Linked delivery work" : "No project selected"}
              </div>
              {invoice.project ? <div className="invoice-project-track" /> : null}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="invoice-line-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="text-center">Qty</th>
                  <th className="text-right">Unit price</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.line_items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.description}</td>
                    <td className="text-center">{item.quantity}</td>
                    <td className="text-right">
                      {formatCurrencyValue(item.unit_price)}
                    </td>
                    <td className="text-right font-semibold">
                      {formatCurrencyValue(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="invoice-total-box">
            <div className="invoice-total-row">
              <span>Subtotal</span>
              <span>{formatCurrencyValue(invoice.subtotal)}</span>
            </div>
            <div className="invoice-total-row">
              <span>VAT (0%)</span>
              <span>{formatCurrencyValue(invoice.tax)}</span>
            </div>
            <div className="invoice-total-row invoice-total-grand">
              <span>Total due</span>
              <span>{formatCurrencyValue(invoice.total)}</span>
            </div>
          </div>

          <div className="invoice-payment-history">
            <div className="invoice-document-label">Payment history</div>
            <div className="invoice-payment-progress">
              <div className="invoice-payment-progress-track">
                <div
                  className="invoice-payment-progress-fill"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        (Number.parseFloat(invoice.amount_paid || "0") /
                          Math.max(Number.parseFloat(invoice.total || "0"), 1)) *
                          100,
                      ),
                    )}%`,
                  }}
                />
              </div>
              <span className="invoice-payment-progress-label">
                {formatCurrencyValue(invoice.amount_paid)} of{" "}
                {formatCurrencyValue(invoice.total)} collected
              </span>
            </div>

            {payments.length ? (
              <div className="mt-3">
                {payments.map((payment) => (
                  <div
                    className="invoice-payment-row"
                    key={payment.id}
                  >
                    <span className="invoice-payment-date">
                      {formatCompactDate(payment.payment_date)}
                    </span>
                    <div className="invoice-payment-info">
                      <p className="invoice-payment-name">
                        {payment.method_display || payment.method}
                      </p>
                      {payment.provider_reference ? (
                        <p className="invoice-payment-reference">
                          {payment.provider_reference}
                        </p>
                      ) : null}
                    </div>
                    <span className="invoice-payment-amount">
                      +{formatCurrencyValue(payment.amount)}
                    </span>
                    <Button
                      aria-label="Delete payment"
                      className="invoice-action-bar invoice-payment-delete"
                      leadingIcon={<Trash2 className="h-4 w-4" />}
                      onClick={() => setPaymentToDelete(payment)}
                      title="Delete payment"
                      variant="secondary"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-border bg-background-secondary p-4 text-center text-sm text-text-secondary">
                {invoice.status === "draft"
                  ? "Send the invoice before recording payments."
                  : "Record the first payment when money comes in."}
              </div>
            )}
          </div>

          {invoice.notes ? (
            <div className="invoice-internal-note">
              <div className="invoice-document-label">Internal note</div>
              <p className="invoice-document-sub mt-2">{invoice.notes}</p>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
