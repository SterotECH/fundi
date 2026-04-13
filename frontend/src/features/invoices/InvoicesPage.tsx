import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownUp,
  ChevronDown,
  CreditCard,
  FileText,
  Plus,
  ReceiptText,
  Search,
  TriangleAlert,
} from "lucide-react";

import { listClients } from "@/api/clients";
import { listInvoices } from "@/api/invoices";
import { listProjects } from "@/api/projects";
import type { Invoice } from "@/api/types";
import { EmptyState } from "@/components/status/EmptyState";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { FilterPill } from "@/components/ui/FilterPill";
import { StatCard } from "@/components/ui/StatCard";
import { InvoiceDrawer } from "@/features/invoices/InvoiceDrawer";
import { formatCurrencyValue } from "@/utils/currency";

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Partial", value: "partial" },
  { label: "Paid", value: "paid" },
  { label: "Overdue", value: "overdue" },
] as const;

const SORT_OPTIONS = [
  { label: "Due date ↑", value: "due_asc" },
  { label: "Due date ↓", value: "due_desc" },
  { label: "Amount ↓", value: "amount_desc" },
  { label: "Amount ↑", value: "amount_asc" },
  { label: "Newest first", value: "issue_desc" },
  { label: "Oldest first", value: "issue_asc" },
] as const;

const CLIENT_TYPE_LABELS: Record<string, string> = {
  intl: "International School",
  jhs: "Junior High School",
  shs: "Senior High School",
  uni: "University",
};

function parseMoney(value: string | null | undefined) {
  return Number.parseFloat(value || "0");
}

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

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getClientTypeLabel(value: string | null | undefined) {
  if (!value) return "Client";
  return CLIENT_TYPE_LABELS[value] ?? value.replaceAll("_", " ");
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
  if (status === "partial") return "Partial";
  return status.replaceAll("_", " ");
}

function getDueState(invoice: Invoice) {
  if (invoice.status === "draft") {
    return {
      label: "Not yet sent",
      sublabel: "Draft invoice",
      toneClassName: "invoice-due-chip invoice-due-chip-muted",
    };
  }

  if (invoice.status === "paid") {
    return {
      label: "Paid in full",
      sublabel: `Due ${formatDate(invoice.due_date)}`,
      toneClassName: "invoice-due-chip invoice-due-chip-paid",
    };
  }

  if (!invoice.due_date) {
    return {
      label: "No due date",
      sublabel: "Date not set",
      toneClassName: "invoice-due-chip invoice-due-chip-muted",
    };
  }

  const dueDate = new Date(`${invoice.due_date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffInDays = Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000);

  if (diffInDays < 0 || invoice.status === "overdue") {
    const overdueDays = Math.max(1, Math.abs(diffInDays));
    return {
      label: `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`,
      sublabel: `Due ${formatDate(invoice.due_date)}`,
      toneClassName: "invoice-due-chip invoice-due-chip-overdue",
    };
  }

  if (diffInDays <= 7) {
    return {
      label: `Due in ${diffInDays} day${diffInDays === 1 ? "" : "s"}`,
      sublabel: formatDate(invoice.due_date),
      toneClassName: "invoice-due-chip invoice-due-chip-soon",
    };
  }

  return {
    label: formatDate(invoice.due_date),
    sublabel: "On schedule",
    toneClassName: "invoice-due-chip invoice-due-chip-default",
  };
}

function getInvoiceProgressPercent(invoice: Invoice) {
  const total = Math.max(parseMoney(invoice.total), 0);
  const paid = Math.max(parseMoney(invoice.amount_paid), 0);
  if (total <= 0) return 0;
  return Math.min(100, Math.round((paid / total) * 100));
}

function getProgressToneClassName(invoice: Invoice) {
  if (invoice.status === "paid") return "invoice-progress-fill-paid";
  if (invoice.status === "partial") return "invoice-progress-fill-partial";
  if (invoice.status === "overdue") return "invoice-progress-fill-overdue";
  return "invoice-progress-fill-default";
}

function getInvoiceRowClassName(invoice: Invoice) {
  if (invoice.status === "overdue") return "invoice-list-row invoice-list-row-overdue";
  if (invoice.status === "partial") return "invoice-list-row invoice-list-row-partial";
  if (invoice.status === "paid") return "invoice-list-row invoice-list-row-paid";
  return "invoice-list-row";
}

function getDateValue(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  return new Date(`${value}T00:00:00`).getTime();
}

export function InvoicesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]["value"]>("due_asc");
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState(false);

  const invoicesQuery = useQuery({
    queryKey: ["invoices"],
    queryFn: () => listInvoices(),
  });
  const clientsQuery = useQuery({
    queryKey: ["clients", { invoiceFilterOptions: true }],
    queryFn: () => listClients({ isArchived: "false" }),
  });
  const projectsQuery = useQuery({
    queryKey: ["projects", { invoiceClientFilter: clientFilter }],
    queryFn: () => listProjects(clientFilter ? { clientId: clientFilter } : {}),
  });

  const allInvoices = useMemo(() => invoicesQuery.data ?? [], [invoicesQuery.data]);

  const clientMetaById = useMemo(
    () =>
      new Map(
        (clientsQuery.data ?? []).map((client) => [
          client.id,
          {
            name: client.name,
            type: client.type,
          },
        ]),
      ),
    [clientsQuery.data],
  );

  const rows = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const filteredRows = allInvoices.filter((invoice) => {
      if (statusFilter && invoice.status !== statusFilter) return false;
      if (clientFilter && invoice.client !== clientFilter) return false;
      if (projectFilter && invoice.project !== projectFilter) return false;

      if (!normalizedSearch) return true;

      const haystack = [
        invoice.invoice_number ?? "",
        invoice.client_name ?? "",
        invoice.project_title ?? "",
        invoice.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });

    return [...filteredRows].sort((left, right) => {
      if (sortBy === "due_asc") {
        return getDateValue(left.due_date) - getDateValue(right.due_date);
      }

      if (sortBy === "due_desc") {
        return getDateValue(right.due_date) - getDateValue(left.due_date);
      }

      if (sortBy === "amount_desc") {
        return parseMoney(right.total) - parseMoney(left.total);
      }

      if (sortBy === "amount_asc") {
        return parseMoney(left.total) - parseMoney(right.total);
      }

      if (sortBy === "issue_asc") {
        return getDateValue(left.issue_date) - getDateValue(right.issue_date);
      }

      return getDateValue(right.issue_date) - getDateValue(left.issue_date);
    });
  }, [allInvoices, clientFilter, projectFilter, searchQuery, sortBy, statusFilter]);

  const summary = useMemo(() => {
    const totalInvoiced = allInvoices.reduce((sum, invoice) => sum + parseMoney(invoice.total), 0);
    const collected = allInvoices.reduce((sum, invoice) => sum + parseMoney(invoice.amount_paid), 0);
    const outstanding = allInvoices.reduce(
      (sum, invoice) => sum + parseMoney(invoice.amount_remaining),
      0,
    );
    const overdueInvoices = allInvoices.filter((invoice) => invoice.status === "overdue");
    const overdueAmount = overdueInvoices.reduce(
      (sum, invoice) => sum + parseMoney(invoice.amount_remaining),
      0,
    );
    const draftCount = allInvoices.filter((invoice) => invoice.status === "draft").length;
    const unpaidCount = allInvoices.filter((invoice) => parseMoney(invoice.amount_remaining) > 0).length;
    const collectionRate = totalInvoiced <= 0 ? 0 : Math.round((collected / totalInvoiced) * 100);

    return {
      collected,
      collectionRate,
      draftCount,
      overdueAmount,
      overdueCount: overdueInvoices.length,
      outstanding,
      totalCount: allInvoices.length,
      totalInvoiced,
      unpaidCount,
    };
  }, [allInvoices]);

  const columns: DataTableColumn<Invoice>[] = [
    {
      key: "invoice",
      header: "Invoice",
      width: "18%",
      cell: (invoice) => (
        <div className="invoice-number-cell">
          <div className="invoice-number">{invoice.invoice_number || "Draft invoice"}</div>
          <span className={getInvoiceChipClassName(invoice.status)}>
            {getInvoiceChipLabel(invoice.status)}
          </span>
        </div>
      ),
    },
    {
      key: "client",
      header: "Client",
      width: "20%",
      cell: (invoice) => {
        const clientMeta = clientMetaById.get(invoice.client);
        const clientName = invoice.client_name || clientMeta?.name || "Client";

        return (
          <div className="invoice-client-cell">
            <div className="invoice-client-avatar">{getInitials(clientName)}</div>
            <div>
              <div className="invoice-client-name">{clientName}</div>
              <div className="invoice-client-type">
                {getClientTypeLabel(clientMeta?.type)}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: "project",
      header: "Project",
      width: "14%",
      cell: (invoice) =>
        invoice.project_title ? (
          <span className="invoice-project-pill">{invoice.project_title}</span>
        ) : (
          <span className="invoice-project-empty">No project</span>
        ),
    },
    {
      key: "amount",
      header: "Amount",
      width: "18%",
      cell: (invoice) => {
        const paid = parseMoney(invoice.amount_paid);
        const progress = getInvoiceProgressPercent(invoice);

        return (
          <div className="invoice-amount-cell">
            <div className="invoice-amount-total">{formatCurrencyValue(invoice.total)}</div>
            <div className="invoice-amount-meta">
              {paid > 0 ? (
                <span className="invoice-amount-paid">{formatCurrencyValue(invoice.amount_paid)} paid</span>
              ) : (
                <span className="invoice-amount-waiting">Awaiting payment</span>
              )}
              <span className="invoice-amount-sep">·</span>
              <span className="invoice-amount-remaining">
                {formatCurrencyValue(invoice.amount_remaining)} left
              </span>
            </div>
            <div className="invoice-progress-track">
              <div
                className={`invoice-progress-fill ${getProgressToneClassName(invoice)}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: "paid_remaining",
      header: "Paid / Remaining",
      align: "right",
      className: "text-right",
      width: "10%",
      cell: (invoice) => (
        <div className="invoice-balance-cell">
          <div className="invoice-balance-paid">{formatCurrencyValue(invoice.amount_paid)}</div>
          <div className="invoice-balance-remaining">
            {formatCurrencyValue(invoice.amount_remaining)}
          </div>
        </div>
      ),
    },
    {
      key: "issue_date",
      header: "Issue date",
      width: "10%",
      cell: (invoice) => <span className="invoice-date-text">{formatDate(invoice.issue_date)}</span>,
    },
    {
      key: "due_date",
      header: "Due date",
      width: "22%",
      cell: (invoice) => {
        const dueState = getDueState(invoice);
        return (
          <div className="invoice-due-cell">
            <span className={dueState.toneClassName}>{dueState.label}</span>
            <span className="invoice-due-subtext">{dueState.sublabel}</span>
          </div>
        );
      },
    },
  ];

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setClientFilter("");
    setProjectFilter("");
    setSortBy("due_asc");
  };

  const activeFilterCount =
    Number(Boolean(searchQuery.trim())) +
    Number(Boolean(statusFilter)) +
    Number(Boolean(clientFilter)) +
    Number(Boolean(projectFilter)) +
    Number(sortBy !== "due_asc");

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
            All invoices, payments, and collection status.
          </p>
        </div>
        <Button
          leadingIcon={<Plus className="h-4 w-4" />}
          onClick={() => setIsInvoiceDrawerOpen(true)}
        >
          New Invoice
        </Button>
      </div>

      <div className="invoice-stats-grid mt-6">
        <StatCard
          color="primary"
          description={`${summary.totalCount} invoice${summary.totalCount === 1 ? "" : "s"}`}
          icon={ReceiptText}
          label="Total invoiced"
          size="sm"
          value={formatCurrencyValue(summary.totalInvoiced)}
        />
        <StatCard
          color="ocean"
          description={`${summary.collectionRate}% of total`}
          icon={CreditCard}
          label="Collected"
          size="sm"
          value={formatCurrencyValue(summary.collected)}
        />
        <StatCard
          color="flamingo"
          description={`${summary.unpaidCount} invoice${summary.unpaidCount === 1 ? "" : "s"} unpaid`}
          icon={ReceiptText}
          label="Outstanding"
          size="sm"
          value={formatCurrencyValue(summary.outstanding)}
        />
        <StatCard
          color="danger"
          description={`${summary.overdueCount} invoice${summary.overdueCount === 1 ? "" : "s"} past due`}
          icon={TriangleAlert}
          label="Overdue"
          size="sm"
          value={formatCurrencyValue(summary.overdueAmount)}
        />
        <StatCard
          color="neutral"
          description="Not yet sent"
          icon={FileText}
          label="Draft"
          size="sm"
          value={summary.draftCount}
        />
      </div>

      <div className="mt-6">
        <DataTable
          className="space-y-4"
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
                  activeFilterCount ? (
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
                title={activeFilterCount ? "No invoices match the current filters" : "No invoices yet"}
                description={
                  activeFilterCount
                    ? "Try changing the status, client, project, or search filters."
                    : "Create the first draft invoice for a client."
                }
              />
            )
          }
          enableColumnToggle={false}
          getRowClassName={(invoice) => getInvoiceRowClassName(invoice)}
          getRowHref={(invoice) => `/invoices/${invoice.id}`}
          loading={invoicesQuery.isLoading}
          mobileCard={(invoice) => {
            const dueState = getDueState(invoice);

            return (
              <div className="invoice-mobile-card">
                <div className="invoice-mobile-top">
                  <div>
                    <div className="invoice-number">{invoice.invoice_number || "Draft invoice"}</div>
                    <div className="invoice-mobile-client">{invoice.client_name}</div>
                  </div>
                  <span className={getInvoiceChipClassName(invoice.status)}>
                    {getInvoiceChipLabel(invoice.status)}
                  </span>
                </div>

                <div className="invoice-mobile-grid">
                  <div>
                    <p className="data-table-mobile-label">Project</p>
                    <p className="mt-1 text-sm text-text-primary">
                      {invoice.project_title || "No project"}
                    </p>
                  </div>
                  <div>
                    <p className="data-table-mobile-label">Amount</p>
                    <p className="mt-1 text-sm font-semibold text-text-primary">
                      {formatCurrencyValue(invoice.total)}
                    </p>
                  </div>
                  <div>
                    <p className="data-table-mobile-label">Paid / Remaining</p>
                    <p className="mt-1 text-sm text-text-primary">
                      {formatCurrencyValue(invoice.amount_paid)} /{" "}
                      {formatCurrencyValue(invoice.amount_remaining)}
                    </p>
                  </div>
                  <div>
                    <p className="data-table-mobile-label">Due</p>
                    <div className="mt-1 flex flex-col gap-1">
                      <span className={dueState.toneClassName}>{dueState.label}</span>
                      <span className="text-xs text-text-tertiary">{dueState.sublabel}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }}
          rowKey={(invoice) => invoice.id}
          rows={rows}
          shellClassName="invoice-table-shell"
          toolbar={
            <div className="invoice-filter-bar">
              <div className="invoice-search-wrap">
                <Search className="h-4 w-4" />
                <input
                  className="invoice-search-input"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Invoice # or client..."
                  type="search"
                  value={searchQuery}
                />
              </div>

              <div className="invoice-toolbar-divider max-xl:hidden" />

              <div className="invoice-pill-group">
                {STATUS_OPTIONS.map((option) => (
                  <FilterPill
                    active={statusFilter === option.value}
                    activeClassName="invoice-filter-pill-active"
                    className="invoice-filter-pill"
                    key={option.label}
                    onClick={() => setStatusFilter(option.value)}
                  >
                    {option.label}
                  </FilterPill>
                ))}
              </div>

              <div className="invoice-toolbar-divider max-xl:hidden" />

              <div className="invoice-filter-select-wrap">
                <select
                  className="invoice-filter-select"
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
                <ChevronDown className="h-3.5 w-3.5" />
              </div>

              <div className="invoice-filter-select-wrap">
                <select
                  className="invoice-filter-select"
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
                <ChevronDown className="h-3.5 w-3.5" />
              </div>

              <div className="invoice-toolbar-divider max-xl:hidden" />

              <div className="invoice-sort-wrap">
                <span className="invoice-sort-label">Sort</span>
                <div className="invoice-filter-select-wrap invoice-sort-select-wrap">
                  <select
                    className="invoice-filter-select"
                    onChange={(event) =>
                      setSortBy(event.target.value as (typeof SORT_OPTIONS)[number]["value"])
                    }
                    value={sortBy}
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-3.5 w-3.5" />
                </div>
                <ArrowDownUp className="invoice-sort-icon h-3.5 w-3.5" />
              </div>

              <span className="invoice-filter-count">
                Showing {rows.length} of {allInvoices.length} invoice{allInvoices.length === 1 ? "" : "s"}
              </span>
            </div>
          }
          variant="list"
        />
      </div>
    </section>
  );
}
