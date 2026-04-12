import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  Circle,
  Clock3,
  CreditCard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  UserRound,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

import { listInvoicePayments } from "@/api/invoices";
import { getProjectTimeLogs } from "@/api/projects";
import type { Invoice, Payment, Project, Proposal, TimeLog } from "@/api/types";
import {
  archiveClient,
  getClient,
  listClientInvoices,
  listClientProjects,
  listClientProposals,
} from "@/api/clients";
import { cn } from "@/app/cn";
import { queryClient } from "@/app/queryClient";
import { EmptyState } from "@/components/status/EmptyState";
import { LoadingState } from "@/components/status/LoadingState";
import { StatusBadge } from "@/components/status/StatusBadge";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { InvoiceDrawer } from "@/features/invoices/InvoiceDrawer";
import { TimeLogDrawer } from "@/features/projects/TimeLogDrawer";
import { ProposalDrawer } from "@/features/proposals/ProposalDrawer";
import { formatCurrencyValue } from "@/utils/currency";

type ClientTab = "proposals" | "projects" | "invoices" | "payments" | "time";
type ClientPaymentRow = Payment & {
  invoice_id: string;
  invoice_number: string | null;
  invoice_total: string;
  amount_remaining: string;
  project_title?: string | null;
};
type ClientTimeRow = TimeLog & {
  effective_rate: string;
};

const tabMeta: Array<{ id: ClientTab; label: string }> = [
  { id: "proposals", label: "Proposals" },
  { id: "projects", label: "Projects" },
  { id: "invoices", label: "Invoices" },
  { id: "payments", label: "Payments" },
  { id: "time", label: "Time" },
];

function SummaryMetric({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-text-tertiary">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold leading-tight text-text-primary">{value}</p>
      {meta ? <p className="mt-1 text-xs text-text-secondary">{meta}</p> : null}
    </div>
  );
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

export function ClientDetailPage() {
  const navigate = useNavigate();
  const { clientId = "" } = useParams();
  const [activeTab, setActiveTab] = useState<ClientTab>("proposals");
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isProposalDrawerOpen, setIsProposalDrawerOpen] = useState(false);
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState(false);
  const [isTimeLogDrawerOpen, setIsTimeLogDrawerOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [selectedTimeLog, setSelectedTimeLog] = useState<TimeLog | null>(null);

  const clientQuery = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClient(clientId),
    enabled: Boolean(clientId),
  });
  const proposalsQuery = useQuery({
    queryKey: ["client", clientId, "proposals"],
    queryFn: () => listClientProposals(clientId),
    enabled: Boolean(clientId),
  });
  const projectsQuery = useQuery({
    queryKey: ["client", clientId, "projects"],
    queryFn: () => listClientProjects(clientId),
    enabled: Boolean(clientId),
  });
  const invoicesQuery = useQuery({
    queryKey: ["client", clientId, "invoices"],
    queryFn: () => listClientInvoices(clientId),
    enabled: Boolean(clientId),
  });
  const paymentsQuery = useQuery({
    queryKey: ["client", clientId, "payments", ...(invoicesQuery.data ?? []).map((invoice) => invoice.id)],
    queryFn: async () => {
      const invoices = invoicesQuery.data ?? [];
      const paymentGroups = await Promise.all(
        invoices.map(async (invoice) => {
          const payments = await listInvoicePayments(invoice.id);
          return payments.map<ClientPaymentRow>((payment) => ({
            ...payment,
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            invoice_total: invoice.total,
            amount_remaining: invoice.amount_remaining,
            project_title: invoice.project_title,
          }));
        }),
      );

      return paymentGroups
        .flat()
        .sort((left, right) =>
          `${right.payment_date}${right.created_at}`.localeCompare(
            `${left.payment_date}${left.created_at}`,
          ),
        );
    },
    enabled: Boolean(clientId) && !invoicesQuery.isLoading,
  });
  const timeQuery = useQuery({
    queryKey: ["client", clientId, "time", ...(projectsQuery.data ?? []).map((project) => project.id)],
    queryFn: async () => {
      const projects = projectsQuery.data ?? [];
      const responses = await Promise.all(
        projects.map(async (project) => ({
          project,
          payload: await getProjectTimeLogs(project.id),
        })),
      );

      const logs = responses
        .flatMap(({ payload }) =>
          payload.results.map<ClientTimeRow>((log) => ({
            ...log,
            effective_rate: payload.effective_rate,
          })),
        )
        .sort((left, right) =>
          `${right.log_date}${right.created_at}`.localeCompare(
            `${left.log_date}${left.created_at}`,
          ),
        );

      const totalHours = responses.reduce(
        (sum, item) => sum + Number.parseFloat(item.payload.total_hours || "0"),
        0,
      );
      const billableHours = responses.reduce(
        (sum, item) => sum + Number.parseFloat(item.payload.billable_hours || "0"),
        0,
      );
      const nonBillableHours = responses.reduce(
        (sum, item) => sum + Number.parseFloat(item.payload.non_billable_hours || "0"),
        0,
      );
      const totalBudget = responses.reduce(
        (sum, item) => sum + Number.parseFloat(item.project.budget || "0"),
        0,
      );
      const effectiveRate = billableHours > 0 ? totalBudget / billableHours : 0;

      return {
        logs,
        projectCount: responses.length,
        totalHours,
        billableHours,
        nonBillableHours,
        effectiveRate,
      };
    },
    enabled: Boolean(clientId) && !projectsQuery.isLoading,
  });
  const archiveMutation = useMutation({
    mutationFn: () => archiveClient(clientId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      navigate("/clients");
    },
  });

  const proposalColumns = useMemo<DataTableColumn<Proposal>[]>(
    () => [
      {
        key: "proposal",
        header: "Proposal",
        width: "42%",
        cell: (proposal) => (
          <div>
            <p className="font-medium text-text-primary">{proposal.title}</p>
            <p className="mt-1 text-sm text-text-secondary">
              {proposal.client_name || proposal.client}
            </p>
          </div>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        width: "20%",
        cell: (proposal) => (
          <span className="text-sm text-text-primary">
            {formatCurrencyValue(proposal.amount)}
          </span>
        ),
      },
      {
        key: "deadline",
        header: "Deadline",
        width: "20%",
        cell: (proposal) => (
          <span className="text-sm text-text-secondary">{proposal.deadline}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        align: "right",
        width: "18%",
        className: "text-right",
        cell: (proposal) => <StatusBadge status={proposal.status} />,
      },
    ],
    [],
  );

  const projectColumns = useMemo<DataTableColumn<Project>[]>(
    () => [
      {
        key: "project",
        header: "Project",
        width: "46%",
        cell: (project) => (
          <div>
            <p className="font-medium text-text-primary">{project.title}</p>
            <p className="mt-1 text-sm text-text-secondary">{project.client_name}</p>
          </div>
        ),
      },
      {
        key: "budget",
        header: "Budget",
        width: "18%",
        cell: (project) => (
          <span className="text-sm text-text-primary">
            {formatCurrencyValue(project.budget)}
          </span>
        ),
      },
      {
        key: "due_date",
        header: "Due date",
        width: "18%",
        cell: (project) => (
          <span className="text-sm text-text-secondary">{project.due_date}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        align: "right",
        width: "18%",
        className: "text-right",
        cell: (project) => <StatusBadge status={project.status} />,
      },
    ],
    [],
  );

  const invoiceColumns = useMemo<DataTableColumn<Invoice>[]>(
    () => [
      {
        key: "invoice",
        header: "Invoice",
        width: "34%",
        cell: (invoice) => (
          <div>
            <p className="font-mono text-sm font-semibold text-text-primary">
              {invoice.invoice_number || "Draft"}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              {invoice.project_title || "Unlinked"}
            </p>
          </div>
        ),
      },
      {
        key: "due_date",
        header: "Due date",
        width: "18%",
        cell: (invoice) => (
          <span className="text-sm text-text-secondary">
            {formatDate(invoice.due_date)}
          </span>
        ),
      },
      {
        key: "total",
        header: "Total",
        width: "16%",
        cell: (invoice) => (
          <span className="text-sm font-semibold text-text-primary">
            {formatCurrencyValue(invoice.total)}
          </span>
        ),
      },
      {
        key: "remaining",
        header: "Remaining",
        width: "16%",
        cell: (invoice) => (
          <span className="text-sm text-text-primary">
            {formatCurrencyValue(invoice.amount_remaining)}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        align: "right",
        width: "16%",
        className: "text-right",
        cell: (invoice) => <StatusBadge status={invoice.status} />,
      },
    ],
    [],
  );
  const paymentColumns = useMemo<DataTableColumn<ClientPaymentRow>[]>(
    () => [
      {
        key: "payment",
        header: "Payment",
        width: "36%",
        cell: (payment) => (
          <div>
            <p className="font-medium text-text-primary">
              {payment.method_display || payment.method}
            </p>
            <p className="mt-1 font-mono text-xs text-text-tertiary">
              {payment.provider_reference || "Cash payment"}
            </p>
          </div>
        ),
      },
      {
        key: "invoice",
        header: "Invoice",
        width: "24%",
        cell: (payment) => (
          <div>
            <p className="font-mono text-sm font-semibold text-text-primary">
              {payment.invoice_number || "Draft"}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              {payment.project_title || "Unlinked"}
            </p>
          </div>
        ),
      },
      {
        key: "date",
        header: "Date",
        width: "14%",
        cell: (payment) => (
          <span className="text-sm text-text-secondary">
            {formatDate(payment.payment_date)}
          </span>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        width: "14%",
        cell: (payment) => (
          <span className="text-sm font-semibold text-success-hover">
            +{formatCurrencyValue(payment.amount)}
          </span>
        ),
      },
      {
        key: "balance",
        header: "Balance after",
        align: "right",
        width: "12%",
        className: "text-right",
        cell: (payment) => (
          <span className="text-sm text-text-primary">
            {formatCurrencyValue(payment.running_balance)}
          </span>
        ),
      },
    ],
    [],
  );
  const timeColumns = useMemo<DataTableColumn<ClientTimeRow>[]>(
    () => [
      {
        key: "entry",
        header: "Entry",
        width: "48%",
        cell: (timeLog) => (
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                timeLog.billable ? "bg-success" : "bg-muted",
              )}
            />
            <div>
              <p className="font-medium text-text-primary">{timeLog.description}</p>
              <p className="mt-1 text-sm text-text-secondary">{timeLog.project_title}</p>
            </div>
          </div>
        ),
      },
      {
        key: "date",
        header: "Date",
        width: "16%",
        cell: (timeLog) => (
          <span className="text-sm text-text-secondary">
            {formatDate(timeLog.log_date)}
          </span>
        ),
      },
      {
        key: "hours",
        header: "Hours",
        width: "12%",
        cell: (timeLog) => (
          <span className="text-sm font-semibold text-primary-dark">
            {timeLog.hours}h
          </span>
        ),
      },
      {
        key: "rate",
        header: "Rate",
        width: "12%",
        cell: (timeLog) => (
          <span className="text-sm text-text-secondary">
            {formatCurrencyValue(timeLog.effective_rate)}
          </span>
        ),
      },
      {
        key: "billable",
        header: "Billable",
        align: "right",
        width: "12%",
        className: "text-right",
        cell: (timeLog) => (
          <StatusBadge status={timeLog.billable ? "paid" : "draft"} />
        ),
      },
    ],
    [],
  );

  if (clientQuery.isLoading) {
    return <LoadingState label="Loading client..." />;
  }

  if (clientQuery.isError || !clientQuery.data) {
    return (
      <EmptyState
        tone="error"
        title="Client not found"
        description="This client does not exist in your organisation."
      />
    );
  }

  const client = clientQuery.data;
  const proposals = proposalsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];
  const timeSummary = timeQuery.data ?? {
    logs: [],
    projectCount: 0,
    totalHours: 0,
    billableHours: 0,
    nonBillableHours: 0,
    effectiveRate: 0,
  };
  const openProposalCount = proposals.filter(
    (proposal) => !["won", "lost"].includes(proposal.status),
  ).length;
  const activeProjectCount = projects.filter((project) => project.status !== "done").length;
  const invoiceTotals = invoices.reduce(
    (summary, invoice) => ({
      collected: summary.collected + Number.parseFloat(invoice.amount_paid || "0"),
      outstanding:
        summary.outstanding + Number.parseFloat(invoice.amount_remaining || "0"),
      total: summary.total + Number.parseFloat(invoice.total || "0"),
    }),
    { collected: 0, outstanding: 0, total: 0 },
  );

  const tabCounts: Record<ClientTab, number> = {
    proposals: proposals.length,
    projects: projects.length,
    invoices: invoices.length,
    payments: payments.length,
    time: timeSummary.logs.length,
  };

  const currentTabLabel =
    tabMeta.find((tab) => tab.id === activeTab)?.label ?? "Proposals";

  const summaryMetrics = [
    { label: "Total Invoiced", value: formatCurrencyValue(invoiceTotals.total) },
    { label: "Total Collected", value: formatCurrencyValue(invoiceTotals.collected) },
    { label: "Outstanding", value: formatCurrencyValue(invoiceTotals.outstanding) },
    { label: "Open Proposals", value: String(openProposalCount) },
    { label: "Active Projects", value: String(activeProjectCount) },
    {
      label: "Total Hours",
      value: `${timeSummary.totalHours.toFixed(1)}h`,
      meta: timeSummary.projectCount
        ? `${timeSummary.projectCount} tracked project${timeSummary.projectCount === 1 ? "" : "s"}`
        : "No time logged yet",
    },
  ];

  const handleArchive = () => {
    if (client.is_archived || archiveMutation.isPending) {
      return;
    }
    setIsArchiveDialogOpen(true);
  };

  return (
    <section>
      <ProposalDrawer
        initialClientId={client.id}
        key={`${selectedProposal?.id ?? client.id}-proposal-${isProposalDrawerOpen ? "open" : "closed"}`}
        onClose={() => {
          setIsProposalDrawerOpen(false);
          setSelectedProposal(null);
        }}
        open={isProposalDrawerOpen}
        proposal={selectedProposal}
      />
      <InvoiceDrawer
        initialClientId={client.id}
        key={`${client.id}-invoice-${isInvoiceDrawerOpen ? "open" : "closed"}`}
        onClose={() => setIsInvoiceDrawerOpen(false)}
        open={isInvoiceDrawerOpen}
      />
      <TimeLogDrawer
        clientId={client.id}
        onClose={() => {
          setIsTimeLogDrawerOpen(false);
          setSelectedTimeLog(null);
        }}
        open={isTimeLogDrawerOpen}
        projects={projects}
        timeLog={selectedTimeLog}
      />

      <AlertDialog
        confirmLabel="Archive client"
        confirmLoading={archiveMutation.isPending}
        description={`Archive ${client.name}. This keeps the history but removes it from the active client list.`}
        onCancel={() => {
          if (!archiveMutation.isPending) {
            setIsArchiveDialogOpen(false);
          }
        }}
        onConfirm={() => archiveMutation.mutate()}
        open={isArchiveDialogOpen}
        title="Archive client"
        tone="danger"
      />

      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
        to="/clients"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to clients
      </Link>

      <header className="mt-4 rounded-lg border border-border bg-card px-5 py-5 md:px-6">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="page-title">{client.name}</h1>
              <StatusBadge status={client.type} />
              {client.is_archived ? <StatusBadge status="archived" /> : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
                <UserRound className="h-4 w-4 text-icon-active" />
                <span>{client.contact_person}</span>
              </div>
              <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
                <Phone className="h-4 w-4 text-icon-active" />
                <span>{client.phone}</span>
              </div>
              <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
                <Mail className="h-4 w-4 text-icon-active" />
                <span>{client.email}</span>
              </div>
              <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
                <MapPin className="h-4 w-4 text-icon-active" />
                <span>{client.region}</span>
              </div>
            </div>

            {client.notes ? (
              <p className="max-w-3xl text-sm leading-6 text-text-secondary">
                {client.notes}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              leadingIcon={<Pencil className="h-4 w-4" />}
              onClick={() => navigate(`/clients/${client.id}/edit`)}
              variant="secondary"
            >
              Edit
            </Button>
            <Button
              className="text-error-hover"
              leadingIcon={<Archive className="h-4 w-4" />}
              loading={archiveMutation.isPending}
              onClick={handleArchive}
              variant="secondary"
            >
              {client.is_archived ? "Archived" : "Archive"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mt-4 grid gap-3 xl:hidden">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {summaryMetrics.map((metric) => (
            <SummaryMetric
              key={metric.label}
              label={metric.label}
              meta={metric.meta}
              value={metric.value}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-divider pb-1">
            {tabMeta.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "border-primary bg-primary-light text-primary-dark"
                      : "border-transparent bg-background-secondary text-text-secondary hover:border-border hover:bg-card hover:text-text-primary",
                  )}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-semibold",
                      isActive
                        ? "bg-card text-primary-dark"
                        : "bg-card text-text-secondary",
                    )}
                  >
                    {tabCounts[tab.id]}
                  </span>
                </button>
              );
            })}
          </div>

          <section className="space-y-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="page-eyebrow">Relationship View</p>
                <h2 className="mt-2 section-title">{currentTabLabel}</h2>
              </div>
              {activeTab === "proposals" ? (
                <Button
                  onClick={() => {
                    setSelectedProposal(null);
                    setIsProposalDrawerOpen(true);
                  }}
                >
                  New Proposal
                </Button>
              ) : null}
              {activeTab === "invoices" ? (
                <Button onClick={() => setIsInvoiceDrawerOpen(true)}>
                  New Invoice
                </Button>
              ) : null}
              {activeTab === "time" ? (
                <Button
                  disabled={!projects.length}
                  onClick={() => {
                    setSelectedTimeLog(null);
                    setIsTimeLogDrawerOpen(true);
                  }}
                >
                  Log Time
                </Button>
              ) : null}
            </div>

            {activeTab === "proposals" ? (
              <DataTable
                columns={proposalColumns}
                emptyState={
                  proposalsQuery.isError ? (
                    <EmptyState
                      tone="error"
                      title="Proposals could not load"
                      description="The request failed. Refresh the page or sign in again."
                    />
                  ) : (
                    <EmptyState
                      title="No proposals yet"
                      description="Create the first proposal to start the client pipeline."
                      action={
                        <Button
                          onClick={() => {
                            setSelectedProposal(null);
                            setIsProposalDrawerOpen(true);
                          }}
                        >
                          New Proposal
                        </Button>
                      }
                    />
                  )
                }
                loading={proposalsQuery.isLoading}
                mobileCard={(proposal) => (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-text-primary">{proposal.title}</p>
                        <p className="mt-1 text-sm text-text-secondary">
                          {formatCurrencyValue(proposal.amount)}
                        </p>
                      </div>
                      <StatusBadge status={proposal.status} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="data-table-mobile-label">Deadline</p>
                        <p className="mt-1 text-sm text-text-primary">{proposal.deadline}</p>
                      </div>
                      <div>
                        <p className="data-table-mobile-label">Decision</p>
                        <p className="mt-1 text-sm text-text-primary">
                          {proposal.decision_date || "Pending"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                onRowClick={(proposal) => {
                  setSelectedProposal(proposal);
                  setIsProposalDrawerOpen(true);
                }}
                rowKey={(proposal) => proposal.id}
                rows={proposals}
              />
            ) : null}

            {activeTab === "projects" ? (
              <DataTable
                columns={projectColumns}
                emptyState={
                  projectsQuery.isError ? (
                    <EmptyState
                      tone="error"
                      title="Projects could not load"
                      description="The request failed. Refresh the page or sign in again."
                    />
                  ) : (
                    <EmptyState
                      title="No projects yet"
                      description="A project appears here after a proposal is converted and delivery starts."
                    />
                  )
                }
                loading={projectsQuery.isLoading}
                mobileCard={(project) => (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-text-primary">{project.title}</p>
                        <p className="mt-1 text-sm text-text-secondary">
                          {formatCurrencyValue(project.budget)}
                        </p>
                      </div>
                      <StatusBadge status={project.status} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="data-table-mobile-label">Start date</p>
                        <p className="mt-1 text-sm text-text-primary">{project.start_date}</p>
                      </div>
                      <div>
                        <p className="data-table-mobile-label">Due date</p>
                        <p className="mt-1 text-sm text-text-primary">{project.due_date}</p>
                      </div>
                    </div>
                  </div>
                )}
                rowKey={(project) => project.id}
                rows={projects}
              />
            ) : null}

            {activeTab === "invoices" ? (
              <DataTable
                columns={invoiceColumns}
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
                        <Button onClick={() => setIsInvoiceDrawerOpen(true)}>
                          New Invoice
                        </Button>
                      }
                      title="No invoices yet"
                      description="Create a draft invoice for this client when billing starts."
                    />
                  )
                }
                getRowHref={(invoice) => `/invoices/${invoice.id}`}
                loading={invoicesQuery.isLoading}
                mobileCard={(invoice) => (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-text-primary">
                          {invoice.invoice_number || "Draft"}
                        </p>
                        <p className="mt-1 text-sm text-text-secondary">
                          {formatCurrencyValue(invoice.total)}
                        </p>
                      </div>
                      <StatusBadge status={invoice.status} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="data-table-mobile-label">Due date</p>
                        <p className="mt-1 text-sm text-text-primary">
                          {formatDate(invoice.due_date)}
                        </p>
                      </div>
                      <div>
                        <p className="data-table-mobile-label">Remaining</p>
                        <p className="mt-1 text-sm text-text-primary">
                          {formatCurrencyValue(invoice.amount_remaining)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                rowKey={(invoice) => invoice.id}
                rows={invoices}
              />
            ) : null}

            {activeTab === "payments" ? (
              <DataTable
                columns={paymentColumns}
                emptyState={
                  paymentsQuery.isError ? (
                    <EmptyState
                      tone="error"
                      title="Payments could not load"
                      description="The request failed. Refresh the page or sign in again."
                    />
                  ) : (
                    <EmptyState
                      icon={CreditCard}
                      title="No payments yet"
                      description="Payments appear here after money is recorded against this client's invoices."
                    />
                  )
                }
                getRowHref={(payment) => `/invoices/${payment.invoice_id}`}
                loading={paymentsQuery.isLoading || invoicesQuery.isLoading}
                mobileCard={(payment) => (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-text-primary">
                          {payment.method_display || payment.method}
                        </p>
                        <p className="mt-1 font-mono text-xs text-text-tertiary">
                          {payment.provider_reference || "Cash payment"}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-success-hover">
                        +{formatCurrencyValue(payment.amount)}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="data-table-mobile-label">Invoice</p>
                        <p className="mt-1 font-mono text-sm text-text-primary">
                          {payment.invoice_number || "Draft"}
                        </p>
                      </div>
                      <div>
                        <p className="data-table-mobile-label">Date</p>
                        <p className="mt-1 text-sm text-text-primary">
                          {formatDate(payment.payment_date)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                rowKey={(payment) => payment.id}
                rows={payments}
              />
            ) : null}

            {activeTab === "time" ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryMetric
                    label="Total Hours"
                    meta="Across this client"
                    value={`${timeSummary.totalHours.toFixed(1)}h`}
                  />
                  <SummaryMetric
                    label="Billable Hours"
                    meta={
                      timeSummary.totalHours > 0
                        ? `${Math.round((timeSummary.billableHours / timeSummary.totalHours) * 100)}% billable`
                        : "No billable time yet"
                    }
                    value={`${timeSummary.billableHours.toFixed(1)}h`}
                  />
                  <SummaryMetric
                    label="Effective Rate"
                    meta="Per billable hour"
                    value={formatCurrencyValue(timeSummary.effectiveRate.toFixed(2))}
                  />
                  <SummaryMetric
                    label="Non-Billable"
                    meta="Internal time"
                    value={`${timeSummary.nonBillableHours.toFixed(1)}h`}
                  />
                </div>

                <DataTable
                  columns={timeColumns}
                  emptyState={
                    timeQuery.isError ? (
                      <EmptyState
                        tone="error"
                        title="Time logs could not load"
                        description="The request failed. Refresh the page or sign in again."
                      />
                    ) : projects.length ? (
                      <EmptyState
                        action={
                          <Button
                            onClick={() => {
                              setSelectedTimeLog(null);
                              setIsTimeLogDrawerOpen(true);
                            }}
                          >
                            Log Time
                          </Button>
                        }
                        icon={Clock3}
                        title="No time logs yet"
                        description="Log delivery work against one of this client's projects."
                      />
                    ) : (
                      <EmptyState
                        icon={Clock3}
                        title="No projects available"
                        description="A project needs to exist before time can be logged for this client."
                      />
                    )
                  }
                  loading={timeQuery.isLoading || projectsQuery.isLoading}
                  mobileCard={(timeLog) => (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <Circle
                            className={cn(
                              "mt-1 h-3 w-3 shrink-0",
                              timeLog.billable ? "fill-success text-success" : "fill-muted text-muted",
                            )}
                          />
                          <div>
                            <p className="font-medium text-text-primary">
                              {timeLog.description}
                            </p>
                            <p className="mt-1 text-sm text-text-secondary">
                              {timeLog.project_title}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={timeLog.billable ? "paid" : "draft"} />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="data-table-mobile-label">Date</p>
                          <p className="mt-1 text-sm text-text-primary">
                            {formatDate(timeLog.log_date)}
                          </p>
                        </div>
                        <div>
                          <p className="data-table-mobile-label">Hours</p>
                          <p className="mt-1 text-sm font-semibold text-text-primary">
                            {timeLog.hours}h
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  onRowClick={(timeLog) => {
                    setSelectedTimeLog(timeLog);
                    setIsTimeLogDrawerOpen(true);
                  }}
                  rowKey={(timeLog) => timeLog.id}
                  rows={timeSummary.logs}
                />
              </div>
            ) : null}
          </section>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-4 rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="page-eyebrow">Summary</p>
                <h2 className="mt-2 section-title">Relationship Snapshot</h2>
              </div>
              <Button
                className="shrink-0"
                onClick={
                  activeTab === "invoices"
                    ? () => setIsInvoiceDrawerOpen(true)
                    : activeTab === "time"
                      ? () => {
                          setSelectedTimeLog(null);
                          setIsTimeLogDrawerOpen(true);
                        }
                      : () => {
                        setSelectedProposal(null);
                        setIsProposalDrawerOpen(true);
                      }
                }
                variant="secondary"
              >
                {activeTab === "invoices"
                  ? "New Invoice"
                  : activeTab === "time"
                    ? "Log Time"
                    : "New Proposal"}
              </Button>
            </div>

            <div className="grid gap-3">
              {summaryMetrics.map((metric) => (
                <SummaryMetric
                  key={metric.label}
                  label={metric.label}
                  meta={metric.meta}
                  value={metric.value}
                />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
