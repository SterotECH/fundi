import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  ArrowUpRight,
  Circle,
  Clock3,
  CreditCard,
  FileText,
  FolderKanban,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ReceiptText,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

import { getClientProfitability } from "@/api/analytics";
import { listInvoicePayments } from "@/api/invoices";
import { getProjectTimeLogs } from "@/api/projects";
import type { Payment, Project, Proposal, TimeLog } from "@/api/types";
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
import { StatCard } from "@/components/ui/StatCard";
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

function formatShortDate(value: string | null) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatClientTypeLabel(value: string) {
  return value
    .split(/[_-]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function getProposalDot(status: string) {
  if (status === "won") return "bg-success";
  if (status === "sent") return "bg-info";
  if (status === "negotiating") return "bg-warning";
  if (status === "lost") return "bg-error";
  return "bg-muted";
}

function getProjectProgress(project: Project) {
  if (project.status === "done") return 100;
  if (project.status === "active") return 65;
  if (project.status === "hold") return 35;
  return 15;
}

function getPaymentMethodTone(method: string) {
  if (method === "momo") return "bg-warning-light text-warning-hover";
  if (method === "bank_transfer") return "bg-info-light text-info-hover";
  return "bg-muted-background text-muted-foreground";
}

function SectionShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
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
  const profitabilityQuery = useQuery({
    queryKey: ["analytics", "clients", "revenue"],
    queryFn: () => getClientProfitability("revenue"),
    enabled: Boolean(clientId),
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
  const wonProposals = proposals.filter((proposal) => proposal.status === "won");
  const lostProposals = proposals.filter((proposal) => proposal.status === "lost");
  const decidedProposalCount = wonProposals.length + lostProposals.length;
  const winRate = decidedProposalCount ? Math.round((wonProposals.length / decidedProposalCount) * 100) : 0;
  const activeProject = projects.find((project) => project.status !== "done") ?? projects[0] ?? null;
  const invoiceTotals = invoices.reduce(
    (summary, invoice) => ({
      collected: summary.collected + Number.parseFloat(invoice.amount_paid || "0"),
      outstanding: summary.outstanding + Number.parseFloat(invoice.amount_remaining || "0"),
      total: summary.total + Number.parseFloat(invoice.total || "0"),
    }),
    { collected: 0, outstanding: 0, total: 0 },
  );
  const profitabilityRow =
    (profitabilityQuery.data ?? []).find(
      (row) => String(row.client_id) === String(client.id),
    ) ?? null;
  const clientCollected = profitabilityRow
    ? Number.parseFloat(profitabilityRow.collected_ghs || "0")
    : invoiceTotals.collected;
  const clientOutstanding = profitabilityRow
    ? Number.parseFloat(profitabilityRow.outstanding_ghs || "0")
    : invoiceTotals.outstanding;
  const clientEffectiveRate = profitabilityRow
    ? Number.parseFloat(profitabilityRow.effective_rate_ghs || "0")
    : timeSummary.effectiveRate;
  const clientOpenProposals = profitabilityRow ? profitabilityRow.open_proposals : proposals.filter((proposal) => !["won", "lost"].includes(proposal.status)).length;
  const clientBillableHours = profitabilityRow
    ? profitabilityRow.billable_hours
    : timeSummary.billableHours;
  const tabCounts: Record<ClientTab, number> = {
    proposals: proposals.length,
    projects: projects.length,
    invoices: invoices.length,
    payments: payments.length,
    time: timeSummary.logs.length,
  };
  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Button
        className="text-error-hover"
        leadingIcon={<Archive className="h-4 w-4" />}
        loading={archiveMutation.isPending}
        onClick={() => setIsArchiveDialogOpen(true)}
        type="button"
        variant="secondary"
      >
        {client.is_archived ? "Archived" : "Archive"}
      </Button>
      <Button
        leadingIcon={<Pencil className="h-4 w-4" />}
        onClick={() => navigate(`/clients/${client.id}/edit`)}
        type="button"
        variant="secondary"
      >
        Edit
      </Button>
      <Button
        leadingIcon={<FileText className="h-4 w-4" />}
        onClick={() => {
          setSelectedProposal(null);
          setIsProposalDrawerOpen(true);
        }}
        type="button"
      >
        New Proposal
      </Button>
    </div>
  );

  return (
    <section className="space-y-4">
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
        className="inline-flex items-center gap-2 text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary"
        to="/clients"
      >
        <ArrowLeft className="h-4 w-4" />
        Clients
      </Link>

      <header className="flex flex-wrap items-start gap-4 rounded-2xl border border-border bg-card px-6 py-5">
        <div className="grid h-14 w-14 place-items-center rounded-xl bg-primary-light text-lg font-semibold text-primary">
          {getInitials(client.name)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold leading-tight text-text-primary">{client.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
            <StatusBadge status={client.type} />
            {client.is_archived ? <StatusBadge status="archived" /> : null}
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-4 w-4" />
              {client.contact_person}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-4 w-4" />
              {client.phone}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-4 w-4" />
              {client.email}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {client.region}
            </span>
          </div>
          <p className="mt-3 text-sm text-text-tertiary">
            {formatClientTypeLabel(client.type)} client
            {client.address ? ` · ${client.address}` : ""}
          </p>
        </div>
        {headerActions}
      </header>

      <div className="grid gap-3 md:grid-cols-5">
        <StatCard
          color="primary"
          description={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`}
          icon={ReceiptText}
          label="Total invoiced"
          size="sm"
          value={formatCurrencyValue(invoiceTotals.total.toFixed(2))}
        />
        <StatCard
          color="success"
          description={invoiceTotals.total > 0 ? `${Math.round((invoiceTotals.collected / invoiceTotals.total) * 100)}% paid` : "No payments yet"}
          icon={CreditCard}
          label="Collected"
          size="sm"
          value={formatCurrencyValue(invoiceTotals.collected.toFixed(2))}
        />
        <StatCard
          color={invoiceTotals.outstanding > 0 ? "warning" : "neutral"}
          description={invoiceTotals.outstanding > 0 ? `${invoices.filter((invoice) => Number.parseFloat(invoice.amount_remaining || "0") > 0).length} open invoice${invoices.filter((invoice) => Number.parseFloat(invoice.amount_remaining || "0") > 0).length === 1 ? "" : "s"}` : "Fully settled"}
          icon={ReceiptText}
          label="Outstanding"
          size="sm"
          value={formatCurrencyValue(invoiceTotals.outstanding.toFixed(2))}
        />
        <StatCard
          color="info"
          description={`${timeSummary.billableHours.toFixed(1)}h billable`}
          icon={Clock3}
          label="Hours logged"
          size="sm"
          value={`${timeSummary.totalHours.toFixed(1)}h`}
        />
        <StatCard
          color={winRate > 0 ? "success" : "neutral"}
          description={`${wonProposals.length} of ${decidedProposalCount || proposals.length || 1} won`}
          icon={Sparkles}
          label="Win rate"
          size="sm"
          value={`${winRate}%`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_304px]">
        <div className="space-y-4">
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-2">
              <div className="flex flex-wrap gap-1">
                {tabMeta.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      className={cn(
                        "inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors",
                        isActive
                          ? "border-primary text-primary"
                          : "border-transparent text-text-secondary hover:text-text-primary",
                      )}
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      type="button"
                    >
                      <span>{tab.label}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          isActive ? "bg-primary-light text-primary" : "bg-background-secondary text-text-tertiary",
                        )}
                      >
                        {tabCounts[tab.id]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeTab === "proposals" ? (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <p className="text-xs text-text-tertiary">
                    {proposals.length} proposals · {wonProposals.length} won · {lostProposals.length} lost
                  </p>
                  <button
                    className="text-xs font-medium text-primary transition-colors hover:text-primary-hover"
                    onClick={() => {
                      setSelectedProposal(null);
                      setIsProposalDrawerOpen(true);
                    }}
                    type="button"
                  >
                    + New proposal
                  </button>
                </div>

                {proposals.length ? (
                  <div>
                    {proposals.map((proposal) => (
                      <button
                        className="flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-background-secondary"
                        key={proposal.id}
                        onClick={() => {
                          setSelectedProposal(proposal);
                          setIsProposalDrawerOpen(true);
                        }}
                        type="button"
                      >
                        <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", getProposalDot(proposal.status))} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">{proposal.title}</p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-text-tertiary">
                            <span>{formatCurrencyValue(proposal.amount)}</span>
                            {proposal.decision_date ? <span>{formatDate(proposal.decision_date)}</span> : null}
                            {proposal.sent_date ? <span>Sent {formatDate(proposal.sent_date)}</span> : null}
                            {proposal.status === "won" ? <span>converted to project</span> : null}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-medium text-text-primary">{formatCurrencyValue(proposal.amount)}</p>
                          <div className="mt-1 flex justify-end">
                            <StatusBadge status={proposal.status} />
                          </div>
                        </div>
                      </button>
                    ))}

                    <div className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted-background">
                          <div
                            className="h-full rounded-full bg-success"
                            style={{ width: `${proposals.length ? Math.round((wonProposals.length / proposals.length) * 100) : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-tertiary">
                          Pipeline: {formatCurrencyValue(
                            proposals
                              .filter((proposal) => !["won", "lost"].includes(proposal.status))
                              .reduce((sum, proposal) => sum + Number.parseFloat(proposal.amount || "0"), 0)
                              .toFixed(2),
                          )} open · {formatCurrencyValue(
                            wonProposals.reduce((sum, proposal) => sum + Number.parseFloat(proposal.amount || "0"), 0).toFixed(2),
                          )} won lifetime
                        </span>
                      </div>
                    </div>

                    {activeProject ? (
                      <>
                        <div className="border-t border-border px-4 py-3">
                          <p className="mb-3 text-xs font-medium text-text-secondary">Active project</p>
                          <Link className="flex items-start gap-3" to={`/projects/${activeProject.id}`}>
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-primary">
                              <FolderKanban className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-text-primary">{activeProject.title}</p>
                              <p className="mt-1 text-xs text-text-tertiary">
                                {activeProject.status} · Due {formatDate(activeProject.due_date)}
                              </p>
                              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted-background">
                                <div
                                  className="h-full rounded-full bg-success"
                                  style={{ width: `${getProjectProgress(activeProject)}%` }}
                                />
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <StatusBadge status={activeProject.status} />
                              <p className="mt-1 text-xs text-text-tertiary">{getProjectProgress(activeProject)}% complete</p>
                            </div>
                          </Link>
                        </div>
                      </>
                    ) : null}

                    {invoices.length ? (
                      <>
                        <div className="border-t border-border px-4 py-3">
                          <p className="mb-3 text-xs font-medium text-text-secondary">Invoices</p>
                          {invoices.slice(0, 1).map((invoice) => (
                            <Link className="flex items-center gap-3" key={invoice.id} to={`/invoices/${invoice.id}`}>
                              <span className="w-28 shrink-0 font-mono text-[11px] text-text-tertiary">
                                {invoice.invoice_number || "Draft"}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                                {invoice.notes || invoice.project_title || "Invoice"}
                              </span>
                              <span className="shrink-0 text-sm font-medium text-text-primary">
                                {formatCurrencyValue(invoice.total)}
                              </span>
                              <div className="shrink-0 text-right">
                                <StatusBadge status={invoice.status} />
                                <p className="mt-1 text-[11px] text-text-tertiary">
                                  {formatCurrencyValue(invoice.amount_paid)} paid
                                </p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </>
                    ) : null}

                    {payments.length ? (
                      <div className="border-t border-border px-4 py-3">
                        <p className="mb-3 text-xs font-medium text-text-secondary">Payment history</p>
                        <div className="space-y-2">
                          {payments.slice(0, 3).map((payment) => (
                            <Link
                              className="flex items-center gap-3"
                              key={payment.id}
                              to={`/invoices/${payment.invoice_id}`}
                            >
                              <span className={cn("rounded-md px-2 py-1 text-[10px] font-semibold", getPaymentMethodTone(payment.method))}>
                                {payment.method_display || payment.method}
                              </span>
                              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-text-tertiary">
                                {payment.provider_reference || "Cash payment"}
                              </span>
                              <span className="w-14 shrink-0 text-right text-[11px] text-text-tertiary">
                                {formatShortDate(payment.payment_date)}
                              </span>
                              <span className="w-20 shrink-0 text-right text-sm font-medium text-success-hover">
                                +{formatCurrencyValue(payment.amount)}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="p-6">
                    <EmptyState
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
                      title="No proposals yet"
                      description="Create the first proposal to start the client pipeline."
                    />
                  </div>
                )}
              </>
            ) : null}

            {activeTab === "projects" ? (
              projects.length ? (
                <div>
                  {projects.map((project) => (
                    <Link
                      className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-background-secondary"
                      key={project.id}
                      to={`/projects/${project.id}`}
                    >
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-primary">
                        <FolderKanban className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary">{project.title}</p>
                        <p className="mt-1 text-xs text-text-tertiary">
                          {project.status} · Due {formatDate(project.due_date)}
                        </p>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted-background max-w-[200px]">
                          <div
                            className="h-full rounded-full bg-success"
                            style={{ width: `${getProjectProgress(project)}%` }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <StatusBadge status={project.status} />
                        <p className="mt-1 text-xs text-text-tertiary">{getProjectProgress(project)}% complete</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-6">
                  <EmptyState
                    title="No projects yet"
                    description="A project appears here after a proposal is converted and delivery starts."
                  />
                </div>
              )
            ) : null}

            {activeTab === "invoices" ? (
              invoices.length ? (
                <div>
                  {invoices.map((invoice) => (
                    <Link
                      className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-background-secondary"
                      key={invoice.id}
                      to={`/invoices/${invoice.id}`}
                    >
                      <span className="w-28 shrink-0 font-mono text-[11px] text-text-tertiary">
                        {invoice.invoice_number || "Draft"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                        {invoice.project_title || "Unlinked invoice"}
                      </span>
                      <span className="shrink-0 text-sm font-medium text-text-primary">
                        {formatCurrencyValue(invoice.total)}
                      </span>
                      <div className="shrink-0 text-right">
                        <StatusBadge status={invoice.status} />
                        <p className="mt-1 text-[11px] text-text-tertiary">
                          {formatCurrencyValue(invoice.amount_remaining)} left
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-6">
                  <EmptyState
                    action={<Button onClick={() => setIsInvoiceDrawerOpen(true)}>New Invoice</Button>}
                    title="No invoices yet"
                    description="Create a draft invoice for this client when billing starts."
                  />
                </div>
              )
            ) : null}

            {activeTab === "payments" ? (
              payments.length ? (
                <div>
                  {payments.map((payment) => (
                    <Link
                      className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-background-secondary"
                      key={payment.id}
                      to={`/invoices/${payment.invoice_id}`}
                    >
                      <span className={cn("min-w-[76px] rounded-md px-2 py-1 text-[10px] font-semibold text-center", getPaymentMethodTone(payment.method))}>
                        {payment.method_display || payment.method}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-text-tertiary">
                        {payment.provider_reference || "Cash payment"}
                      </span>
                      <span className="w-16 shrink-0 text-right text-[11px] text-text-tertiary">
                        {formatShortDate(payment.payment_date)}
                      </span>
                      <span className="w-24 shrink-0 text-right text-sm font-medium text-success-hover">
                        +{formatCurrencyValue(payment.amount)}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-6">
                  <EmptyState
                    icon={CreditCard}
                    title="No payments yet"
                    description="Payments appear here after money is recorded against this client's invoices."
                  />
                </div>
              )
            ) : null}

            {activeTab === "time" ? (
              <>
                <div className="grid gap-3 border-b border-border px-4 py-4 md:grid-cols-4">
                  <StatCard
                    color="info"
                    description="Across this client"
                    icon={Clock3}
                    label="Total hours"
                    size="sm"
                    value={`${timeSummary.totalHours.toFixed(1)}h`}
                  />
                  <StatCard
                    color="success"
                    description={
                      timeSummary.totalHours > 0
                        ? `${Math.round((timeSummary.billableHours / timeSummary.totalHours) * 100)}% billable`
                        : "No billable time yet"
                    }
                    icon={Sparkles}
                    label="Billable hours"
                    size="sm"
                    value={`${timeSummary.billableHours.toFixed(1)}h`}
                  />
                  <StatCard
                    color="primary"
                    description="Per billable hour"
                    icon={CreditCard}
                    label="Effective rate"
                    size="sm"
                    value={formatCurrencyValue(timeSummary.effectiveRate.toFixed(2))}
                  />
                  <StatCard
                    color="neutral"
                    description="Internal time"
                    icon={Clock3}
                    label="Non-billable"
                    size="sm"
                    value={`${timeSummary.nonBillableHours.toFixed(1)}h`}
                  />
                </div>

                {timeSummary.logs.length ? (
                  <div>
                    {timeSummary.logs.map((timeLog) => (
                      <button
                        className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-background-secondary"
                        key={timeLog.id}
                        onClick={() => {
                          setSelectedTimeLog(timeLog);
                          setIsTimeLogDrawerOpen(true);
                        }}
                        type="button"
                      >
                        <Circle
                          className={cn(
                            "h-3 w-3 shrink-0",
                            timeLog.billable ? "fill-success text-success" : "fill-muted text-muted",
                          )}
                        />
                        <span className="w-14 shrink-0 font-mono text-[11px] text-text-tertiary">
                          {formatShortDate(timeLog.log_date)}
                        </span>
                        <span className="w-28 shrink-0 truncate text-[11px] text-primary">
                          {timeLog.project_title}
                        </span>
                        <span className="min-w-0 flex-1 text-sm text-text-primary">{timeLog.description}</span>
                        <span className="shrink-0 text-sm font-medium text-primary">{timeLog.hours}h</span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            timeLog.billable
                              ? "bg-success-light text-success-hover"
                              : "bg-muted-background text-muted-foreground",
                          )}
                        >
                          {timeLog.billable ? "billable" : "non-billable"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6">
                    <EmptyState
                      action={
                        projects.length ? (
                          <Button
                            onClick={() => {
                              setSelectedTimeLog(null);
                              setIsTimeLogDrawerOpen(true);
                            }}
                          >
                            Log Time
                          </Button>
                        ) : undefined
                      }
                      icon={Clock3}
                      title={projects.length ? "No time logs yet" : "No projects available"}
                      description={
                        projects.length
                          ? "Log delivery work against one of this client's projects."
                          : "A project needs to exist before time can be logged for this client."
                      }
                    />
                  </div>
                )}
              </>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4">
          <SectionShell title="Client info">
            <div className="space-y-3 p-4">
              <div className="rounded-xl bg-background-secondary px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Contact</p>
                <p className="mt-1 text-sm font-medium text-text-primary">{client.contact_person}</p>
                <p className="mt-1 text-xs text-text-tertiary">{client.email}</p>
              </div>
              <div className="rounded-xl bg-background-secondary px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Region</p>
                <p className="mt-1 text-sm text-text-primary">{client.region}</p>
              </div>
              {client.address ? (
                <div className="rounded-xl bg-background-secondary px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Address</p>
                  <p className="mt-1 text-sm text-text-primary">{client.address}</p>
                </div>
              ) : null}
              {client.notes ? (
                <div className="rounded-xl bg-background-secondary px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Notes</p>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">{client.notes}</p>
                </div>
              ) : null}
            </div>
          </SectionShell>

          <SectionShell title="Revenue snapshot">
            <div className="p-4">
              <div className="rounded-xl bg-primary-light px-4 py-4">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <ReceiptText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-primary-dark">
                      {formatCurrencyValue(clientCollected.toFixed(2))} collected ·{" "}
                      {formatCurrencyValue(clientOutstanding.toFixed(2))} outstanding
                    </p>
                    <p className="mt-1 text-xs text-primary">
                      {clientOpenProposals} open proposal(s) · {clientBillableHours.toFixed(1)}h billable ·{" "}
                      {formatCurrencyValue(clientEffectiveRate.toFixed(2))}/h effective rate
                    </p>
                    <div className="mt-3 space-y-2">
                      <button
                        className="flex items-center gap-1 text-xs font-medium text-primary"
                        onClick={() => navigate("/analytics")}
                        type="button"
                      >
                        View analytics
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="flex items-center gap-1 text-xs font-medium text-primary"
                        onClick={() => setActiveTab("payments")}
                        type="button"
                      >
                        Review payment history
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SectionShell>

          <SectionShell title="Quick actions">
            <div className="space-y-2 p-4">
              <button
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm font-medium text-text-primary transition-colors hover:bg-background-secondary"
                onClick={() => {
                  setSelectedProposal(null);
                  setIsProposalDrawerOpen(true);
                }}
                type="button"
              >
                <FileText className="h-4 w-4 text-text-tertiary" />
                New proposal
                <ArrowUpRight className="ml-auto h-4 w-4 text-text-tertiary" />
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm font-medium text-text-primary transition-colors hover:bg-background-secondary"
                onClick={() => setIsInvoiceDrawerOpen(true)}
                type="button"
              >
                <ReceiptText className="h-4 w-4 text-text-tertiary" />
                New invoice
                <ArrowUpRight className="ml-auto h-4 w-4 text-text-tertiary" />
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm font-medium text-text-primary transition-colors hover:bg-background-secondary"
                onClick={() => {
                  setSelectedTimeLog(null);
                  setIsTimeLogDrawerOpen(true);
                }}
                type="button"
              >
                <Clock3 className="h-4 w-4 text-text-tertiary" />
                Log time
                <ArrowUpRight className="ml-auto h-4 w-4 text-text-tertiary" />
              </button>
            </div>
          </SectionShell>
        </aside>
      </div>
    </section>
  );
}
