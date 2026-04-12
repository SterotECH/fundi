import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { listClients } from "@/api/clients";
import { listInvoices } from "@/api/invoices";
import { listProjects } from "@/api/projects";
import type { Invoice } from "@/api/types";
import { EmptyState } from "@/components/status/EmptyState";
import { StatusBadge } from "@/components/status/StatusBadge";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { InvoiceDrawer } from "@/features/invoices/InvoiceDrawer";
import { invoiceStatuses } from "@/features/invoices/invoiceFormConfig";
import { formatCurrencyValue } from "@/utils/currency";

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function getDueState(invoice: Invoice) {
  if (invoice.status === "draft") {
    return {
      label: "Not yet sent",
      tone: "text-text-tertiary",
    };
  }

  if (invoice.status === "paid") {
    return {
      label: "Paid in full",
      tone: "text-success-hover",
    };
  }

  if (invoice.status === "partial") {
    return {
      label: `${formatCurrencyValue(invoice.amount_paid)} paid`,
      tone: "text-warning-hover",
    };
  }

  if (invoice.status === "overdue") {
    if (!invoice.due_date) {
      return {
        label: "Overdue",
        tone: "text-error-hover",
      };
    }

    const dueDate = new Date(`${invoice.due_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffInDays = Math.max(
      0,
      Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000),
    );

    return {
      label: `${diffInDays} day${diffInDays === 1 ? "" : "s"} overdue`,
      tone: "text-error-hover",
    };
  }

  if (invoice.due_date) {
    const dueDate = new Date(`${invoice.due_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffInDays = Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000);

    if (diffInDays > 0) {
      return {
        label: `Due in ${diffInDays} day${diffInDays === 1 ? "" : "s"}`,
        tone: "text-text-secondary",
      };
    }
  }

  return {
    label: formatDate(invoice.due_date),
    tone: "text-text-secondary",
  };
}

const columns: DataTableColumn<Invoice>[] = [
  {
    key: "status",
    header: "Status",
    width: "14%",
    cell: (invoice) => <StatusBadge status={invoice.status} />,
  },
  {
    key: "invoice",
    header: "Invoice",
    width: "18%",
    cell: (invoice) => (
      <span className="font-mono text-sm font-semibold text-text-primary">
        {invoice.invoice_number || "—"}
      </span>
    ),
  },
  {
    key: "client",
    header: "Client",
    width: "28%",
    cell: (invoice) => (
      <div>
        <p className="text-sm font-medium text-text-primary">{invoice.client_name}</p>
        {invoice.project_title ? (
          <p className="mt-1 text-xs text-text-tertiary">{invoice.project_title}</p>
        ) : null}
      </div>
    ),
  },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    className: "text-right",
    width: "18%",
    cell: (invoice) => (
      <span className="text-sm font-semibold text-text-primary">
        {formatCurrencyValue(invoice.total)}
      </span>
    ),
  },
  {
    key: "due_state",
    header: "Due / Overdue",
    width: "22%",
    cell: (invoice) => (
      <div>
        <p className={`text-sm font-medium ${getDueState(invoice).tone}`}>
          {getDueState(invoice).label}
        </p>
        {invoice.status !== "draft" ? (
          <p className="mt-1 text-xs text-text-tertiary">
            Due {formatDate(invoice.due_date)}
          </p>
        ) : null}
      </div>
    ),
  },
];

export function InvoicesPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState(false);

  const filterCount =
    Number(statusFilter !== "") +
    Number(clientFilter !== "") +
    Number(projectFilter !== "");
  const hasActiveFilters = filterCount > 0;

  const invoicesQuery = useQuery({
    queryKey: ["invoices", { statusFilter, clientFilter, projectFilter }],
    queryFn: () =>
      listInvoices({
        status: statusFilter,
        clientId: clientFilter,
        projectId: projectFilter,
      }),
  });
  const clientsQuery = useQuery({
    queryKey: ["clients", { invoiceFilterOptions: true }],
    queryFn: () => listClients({ isArchived: "false" }),
  });
  const projectsQuery = useQuery({
    queryKey: ["projects", { clientFilter }],
    queryFn: () => listProjects({ clientId: clientFilter }),
  });

  const rows = useMemo(() => invoicesQuery.data ?? [], [invoicesQuery.data]);
  const totals = useMemo(
    () =>
      rows.reduce(
        (summary, invoice) => ({
          remaining:
            summary.remaining + Number.parseFloat(invoice.amount_remaining || "0"),
          total: summary.total + Number.parseFloat(invoice.total || "0"),
        }),
        { remaining: 0, total: 0 },
      ),
    [rows],
  );

  const clearFilters = () => {
    setStatusFilter("");
    setClientFilter("");
    setProjectFilter("");
  };

  return (
    <section>
      <InvoiceDrawer
        key={isInvoiceDrawerOpen ? "invoice-create-open" : "invoice-create-closed"}
        onClose={() => setIsInvoiceDrawerOpen(false)}
        open={isInvoiceDrawerOpen}
      />

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="page-eyebrow">Money layer</p>
          <h1 className="mt-2 page-title">Invoices</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
            Track invoice status, outstanding balances, and client payment exposure.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-auto">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs font-semibold uppercase text-text-tertiary">
              Total
            </p>
            <p className="mt-1 text-sm font-semibold text-text-primary">
              {formatCurrencyValue(totals.total)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs font-semibold uppercase text-text-tertiary">
              Remaining
            </p>
            <p className="mt-1 text-sm font-semibold text-error-hover">
              {formatCurrencyValue(totals.remaining)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <DataTable
          columns={columns}
          emptyState={
            invoicesQuery.isError ? (
              <EmptyState
                tone="error"
                title="Invoices could not load"
                description="The request failed. Refresh the page or sign in again."
              />
            ) : (
              <EmptyState
                action={
                  hasActiveFilters ? (
                    <Button onClick={clearFilters} variant="secondary">
                      Clear filters
                    </Button>
                  ) : (
                    <Button
                      leadingIcon={<Plus className="h-4 w-4" />}
                      onClick={() => setIsInvoiceDrawerOpen(true)}
                    >
                      New Invoice
                    </Button>
                  )
                }
                title={
                  hasActiveFilters
                    ? "No invoices match the current filters"
                    : "No invoices yet"
                }
                description={
                  hasActiveFilters
                    ? "Try changing the status, client, or project filter."
                    : "Create the first draft invoice for a client."
                }
              />
            )
          }
          filterCount={filterCount}
          filterContent={
            <div className="grid gap-3">
              <label className="block">
                <span className="field-label">Status</span>
                <select
                  className="field-input min-w-56"
                  onChange={(event) => setStatusFilter(event.target.value)}
                  value={statusFilter}
                >
                  <option value="">All statuses</option>
                  {invoiceStatuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="field-label">Client</span>
                <select
                  className="field-input min-w-56"
                  disabled={clientsQuery.isLoading}
                  onChange={(event) => {
                    setClientFilter(event.target.value);
                    setProjectFilter("");
                  }}
                  value={clientFilter}
                >
                  <option value="">All clients</option>
                  {(clientsQuery.data ?? []).map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="field-label">Project</span>
                <select
                  className="field-input min-w-56"
                  disabled={projectsQuery.isLoading}
                  onChange={(event) => setProjectFilter(event.target.value)}
                  value={projectFilter}
                >
                  <option value="">All projects</option>
                  {(projectsQuery.data ?? []).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </label>
              {hasActiveFilters ? (
                <Button onClick={clearFilters} variant="secondary">
                  Clear filters
                </Button>
              ) : null}
            </div>
          }
          getRowHref={(invoice) => `/invoices/${invoice.id}`}
          loading={invoicesQuery.isLoading}
          mobileCard={(invoice) => (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-text-primary">
                    {invoice.invoice_number || "—"}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {invoice.client_name}
                  </p>
                </div>
                <StatusBadge status={invoice.status} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="data-table-mobile-label">Due / Overdue</p>
                  <p className={`mt-1 text-sm font-medium ${getDueState(invoice).tone}`}>
                    {getDueState(invoice).label}
                  </p>
                </div>
                <div>
                  <p className="data-table-mobile-label">Amount</p>
                  <p className="mt-1 text-sm text-text-primary">
                    {formatCurrencyValue(invoice.total)}
                  </p>
                </div>
                <div>
                  <p className="data-table-mobile-label">Project</p>
                  <p className="mt-1 text-sm text-text-primary">
                    {invoice.project_title || "Unlinked"}
                  </p>
                </div>
              </div>
            </div>
          )}
          rowKey={(invoice) => invoice.id}
          rows={rows}
          toolbarActions={
            <Button
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={() => setIsInvoiceDrawerOpen(true)}
            >
              New Invoice
            </Button>
          }
        />
      </div>
    </section>
  );
}
