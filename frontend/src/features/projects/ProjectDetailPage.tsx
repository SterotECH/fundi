import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock3,
  FileText,
  Layers3,
  Pencil,
  ReceiptText,
  Send,
  Sparkles,
  Target,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

import { getClient } from "@/api/clients";
import { getProject, getProjectTimeLogs, listProjectInvoices } from "@/api/projects";
import { getProposal, transitionProposal } from "@/api/proposals";
import type { Client, Invoice, Milestone, Proposal, TimeLog } from "@/api/types";
import { EmptyState } from "@/components/status/EmptyState";
import { LoadingState } from "@/components/status/LoadingState";
import { StatusBadge } from "@/components/status/StatusBadge";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { InvoiceDrawer } from "@/features/invoices/InvoiceDrawer";
import { MilestoneDrawer } from "@/features/projects/MilestoneDrawer";
import { ProjectDrawer } from "@/features/projects/ProjectDrawer";
import { TimeLogDrawer } from "@/features/projects/TimeLogDrawer";
import { formatCurrencyValue } from "@/utils/currency";

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const parsedDate = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate);
}

function formatShortDate(value: string | null) {
  if (!value) {
    return "No date";
  }

  const parsedDate = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
  }).format(parsedDate);
}

function formatCompactHours(value: string) {
  return `${Number.parseFloat(value || "0").toFixed(1)}h`;
}

function sumCurrency(items: Invoice[], field: "total" | "amount_paid" | "amount_remaining") {
  return items.reduce((total, item) => total + Number.parseFloat(item[field] || "0"), 0);
}

function getRelativeDueLabel(value: string | null) {
  if (!value) {
    return "No due date";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${value}T00:00:00`);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) {
    return "Today";
  }

  if (diffDays < 0) {
    return `${Math.abs(diffDays)}d overdue`;
  }

  return `${diffDays}d left`;
}

function Panel({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-white/60 bg-card/80 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] font-medium text-text-primary">
          {icon}
          <span>{title}</span>
        </div>
        {action}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

export function ProjectDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projectId = "" } = useParams();
  const [isProjectDrawerOpen, setIsProjectDrawerOpen] = useState(false);
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState(false);
  const [isTimeLogDrawerOpen, setIsTimeLogDrawerOpen] = useState(false);
  const [isMilestoneDrawerOpen, setIsMilestoneDrawerOpen] = useState(false);
  const [selectedTimeLog, setSelectedTimeLog] = useState<TimeLog | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  });
  const invoicesQuery = useQuery({
    queryKey: ["project", projectId, "invoices"],
    queryFn: () => listProjectInvoices(projectId),
    enabled: Boolean(projectId),
  });
  const timeQuery = useQuery({
    queryKey: ["project", projectId, "timelogs"],
    queryFn: () => getProjectTimeLogs(projectId),
    enabled: Boolean(projectId),
  });
  const clientQuery = useQuery({
    queryKey: ["project", projectId, "client"],
    queryFn: () => getClient(projectQuery.data!.client),
    enabled: Boolean(projectQuery.data?.client),
  });
  const proposalQuery = useQuery({
    queryKey: ["project", projectId, "proposal"],
    queryFn: () => getProposal(projectQuery.data!.proposal!),
    enabled: Boolean(projectQuery.data?.proposal),
  });
  const sendProposalMutation = useMutation({
    mutationFn: (proposalId: string) => transitionProposal(proposalId, "sent"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["proposals"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["project", projectId, "proposal"] });
    },
  });

  if (projectQuery.isLoading) {
    return <LoadingState label="Loading project..." />;
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <EmptyState
        tone="error"
        title="Project not found"
        description="This project does not exist in your organisation."
      />
    );
  }

  const project = projectQuery.data;
  const client = clientQuery.data as Client | undefined;
  const sourceProposal = proposalQuery.data as Proposal | null | undefined;
  const canSendSourceProposal = sourceProposal?.status === "draft";
  const invoices = invoicesQuery.data ?? [];
  const milestones = project.milestones ?? [];
  const timeSummary = timeQuery.data ?? project.time_summary ?? {
    total_hours: "0.00",
    billable_hours: "0.00",
    non_billable_hours: "0.00",
    effective_rate: "0.00",
  };
  const timeResults = timeQuery.data?.results ?? [];

  const completedMilestones = milestones.filter((item) => item.completed).length;
  const progressPercent = milestones.length
    ? Math.round((completedMilestones / milestones.length) * 100)
    : project.status === "done"
      ? 100
      : 0;
  const totalBudget = Number.parseFloat(project.budget || "0");
  const totalBillableHours = Number.parseFloat(timeSummary.billable_hours || "0");
  const effectiveRate = Number.parseFloat(timeSummary.effective_rate || "0");
  const burnAmount = totalBillableHours * effectiveRate;
  const burnPercent = totalBudget > 0 ? Math.min(100, Math.round((burnAmount / totalBudget) * 100)) : 0;
  const invoicedTotal = sumCurrency(invoices, "total");
  const collectedTotal = sumCurrency(invoices, "amount_paid");
  const outstandingTotal = sumCurrency(invoices, "amount_remaining");
  const latestTimeLogs = [...timeResults]
    .sort((left, right) => `${right.log_date}${right.created_at}`.localeCompare(`${left.log_date}${left.created_at}`))
    .slice(0, 5);
  const latestInvoice = invoices[0] ?? null;
  const budgetRemaining = Math.max(totalBudget - burnAmount, 0);
  const isBudgetWarning = burnPercent >= 70 && completedMilestones < milestones.length;
  const askFundiForProject = () => {
    window.dispatchEvent(
      new CustomEvent("fundi:assistant-open", {
        detail: {
          prompt:
            "Analyze this project, summarize risk, and draft a follow-up email if the project looks stale.",
          context: { project_id: project.id },
          autoSubmit: true,
        },
      }),
    );
  };

  return (
    <section className="space-y-4">
      <ProjectDrawer
        onClose={() => setIsProjectDrawerOpen(false)}
        open={isProjectDrawerOpen}
        project={project}
      />
      <InvoiceDrawer
        initialClientId={project.client}
        initialProjectId={project.id}
        onClose={() => setIsInvoiceDrawerOpen(false)}
        open={isInvoiceDrawerOpen}
      />
      <TimeLogDrawer
        initialProjectId={project.id}
        onClose={() => {
          setIsTimeLogDrawerOpen(false);
          setSelectedTimeLog(null);
        }}
        open={isTimeLogDrawerOpen}
        projects={[project]}
        timeLog={selectedTimeLog}
      />
      <MilestoneDrawer
        milestone={selectedMilestone}
        nextOrder={milestones.length}
        onClose={() => {
          setIsMilestoneDrawerOpen(false);
          setSelectedMilestone(null);
        }}
        open={isMilestoneDrawerOpen}
        projectId={project.id}
      />

      <Link
        className="inline-flex items-center gap-2 text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary"
        to="/projects"
      >
        <ArrowLeft className="h-4 w-4" />
        Projects
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/60 bg-card/80 px-4 py-4 backdrop-blur-xl sm:px-6 sm:py-5">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2 text-[11px] text-text-tertiary">
            <span>{project.client_name}</span>
            <span>·</span>
            <span>{project.title}</span>
          </div>
          <h1 className="text-xl font-semibold leading-tight text-text-primary sm:text-2xl">{project.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span>{project.client_name}</span>
            {client?.contact_person ? (
              <>
                <span className="text-border">·</span>
                <span>{client.contact_person}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              className="max-sm:w-full"
              leadingIcon={<Sparkles className="h-4 w-4" />}
              onClick={askFundiForProject}
              type="button"
              variant="secondary"
            >
              Ask Fundi
            </Button>
            <Button
              className="max-sm:w-full"
              leadingIcon={<Pencil className="h-4 w-4" />}
              onClick={() => setIsProjectDrawerOpen(true)}
              type="button"
              variant="secondary"
            >
              Edit
            </Button>
            <Button className="max-sm:w-full" leadingIcon={<Clock3 className="h-4 w-4" />} onClick={() => setIsTimeLogDrawerOpen(true)}>
              Log Time
            </Button>
          </div>
          <div className="sm:self-auto">
            <StatusBadge status={project.status} />
          </div>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-5">
        <StatCard
          color="primary"
          description="Project budget"
          icon={Layers3}
          label="Budget"
          size="sm"
          value={formatCurrencyValue(project.budget)}
        />
        <StatCard
          color="info"
          description={`${Math.round((totalBillableHours / Math.max(Number.parseFloat(timeSummary.total_hours || "0"), 1)) * 100) || 0}% billable`}
          icon={Clock3}
          label="Total hours"
          size="sm"
          value={formatCompactHours(timeSummary.total_hours)}
        />
        <StatCard
          color="success"
          description="per billable hour"
          icon={Sparkles}
          label="Effective rate"
          size="sm"
          value={formatCurrencyValue(timeSummary.effective_rate)}
        />
        <StatCard
          color={getRelativeDueLabel(project.due_date).includes("overdue") ? "error" : "warning"}
          description={getRelativeDueLabel(project.due_date)}
          icon={Target}
          label="Due date"
          size="sm"
          value={formatDate(project.due_date)}
        />
        <StatCard
          color="secondary"
          description={`${formatCurrencyValue(collectedTotal.toFixed(2))} collected`}
          icon={ReceiptText}
          label="Invoiced"
          size="sm"
          value={formatCurrencyValue(invoicedTotal.toFixed(2))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted-background">
          <div
            className="h-full rounded-full bg-success transition-[width]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-sm font-medium text-success-hover">{progressPercent}% complete</span>
        <span className="text-sm text-text-tertiary max-sm:w-full">Start: {formatDate(project.start_date)}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Panel
            action={
              <button
                className="text-xs font-medium text-primary transition-colors hover:text-primary-hover"
                onClick={() => setIsMilestoneDrawerOpen(true)}
                type="button"
              >
                + Add milestone
              </button>
            }
            icon={<Target className="h-4 w-4 text-text-tertiary" />}
            title="Milestones"
          >
            {milestones.length ? (
              <>
                <div className="divide-y divide-border/80">
                  {milestones
                    .slice()
                    .sort((left, right) => left.order - right.order)
                    .map((milestone) => (
                      <button
                        className="flex w-full items-start gap-3 py-3 text-left"
                        key={milestone.id}
                        onClick={() => {
                          setSelectedMilestone(milestone);
                          setIsMilestoneDrawerOpen(true);
                        }}
                        type="button"
                      >
                        <span
                          className={`mt-0.5 inline-flex h-[17px] w-[17px] items-center justify-center rounded-[5px] border ${
                            milestone.completed
                              ? "border-success bg-success text-success-foreground"
                              : "border-border bg-card text-transparent"
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm ${
                              milestone.completed ? "text-text-tertiary line-through" : "text-text-primary"
                            }`}
                          >
                            {milestone.title}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
                            <span className={!milestone.completed && getRelativeDueLabel(milestone.due_date).includes("overdue") ? "text-error-hover" : ""}>
                              {milestone.completed && milestone.completed_at
                                ? `Completed ${formatShortDate(milestone.completed_at)}`
                                : `Due ${formatShortDate(milestone.due_date)}`}
                            </span>
                            <span className="rounded-full bg-primary-light px-2 py-0.5 text-primary">
                              #{milestone.order}
                            </span>
                          </span>
                        </span>
                      </button>
                    ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/80 pt-3">
                  <span className="text-[11px] text-text-tertiary">
                    {completedMilestones} of {milestones.length} completed
                  </span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted-background">
                    <div className="h-full rounded-full bg-success" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <span className="text-[11px] font-medium text-success-hover">{progressPercent}%</span>
                </div>
              </>
            ) : (
              <EmptyState
                description="Break the work into visible delivery steps."
                icon={Target}
                title="No milestones yet"
              />
            )}
          </Panel>

          <Panel
            action={
              <button
                className="text-xs font-medium text-primary transition-colors hover:text-primary-hover"
                onClick={() => setIsTimeLogDrawerOpen(true)}
                type="button"
              >
                + Log time
              </button>
            }
            icon={<Clock3 className="h-4 w-4 text-text-tertiary" />}
            title={`Time logs · ${formatCompactHours(timeSummary.total_hours)} total`}
          >
            <div className="grid gap-2 sm:grid-cols-4">
              <StatCard
                color="neutral"
                icon={Clock3}
                label="Total"
                size="sm"
                value={formatCompactHours(timeSummary.total_hours)}
              />
              <StatCard
                color="success"
                description={`${Math.round((totalBillableHours / Math.max(Number.parseFloat(timeSummary.total_hours || "0"), 1)) * 100) || 0}%`}
                icon={Check}
                label="Billable"
                size="sm"
                value={formatCompactHours(timeSummary.billable_hours)}
              />
              <StatCard
                color="info"
                description="/hr"
                icon={Sparkles}
                label="Rate"
                size="sm"
                value={formatCurrencyValue(timeSummary.effective_rate)}
              />
              <StatCard
                color={burnPercent >= 70 ? "warning" : "success"}
                description={`${formatCurrencyValue(burnAmount.toFixed(2))} / ${formatCurrencyValue(project.budget)}`}
                icon={Layers3}
                label="Burn"
                size="sm"
                value={`${burnPercent}%`}
              />
            </div>

            <div className="mt-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-tertiary">
                <span>Budget burn</span>
                <span>{formatCurrencyValue(burnAmount.toFixed(2))} of {formatCurrencyValue(project.budget)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted-background">
                <div
                  className={`h-full rounded-full ${burnPercent >= 90 ? "bg-error" : burnPercent >= 70 ? "bg-warning" : "bg-success"}`}
                  style={{ width: `${Math.min(burnPercent, 100)}%` }}
                />
              </div>
            </div>

            <div className="mt-4 divide-y divide-border/80">
              {latestTimeLogs.length ? (
                latestTimeLogs.map((timeLog) => (
                  <button
                    className="flex w-full items-center gap-3 py-2 text-left max-sm:flex-wrap"
                    key={timeLog.id}
                    onClick={() => {
                      setSelectedTimeLog(timeLog);
                      setIsTimeLogDrawerOpen(true);
                    }}
                    type="button"
                  >
                    <span className={`h-2 w-2 rounded-full ${timeLog.billable ? "bg-success" : "bg-muted"}`} />
                    <span className="w-12 shrink-0 font-mono text-[11px] text-text-tertiary max-sm:w-full">
                      {formatShortDate(timeLog.log_date)}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-text-primary">{timeLog.description}</span>
                    <span className="shrink-0 text-sm font-medium text-primary max-sm:ml-auto">{timeLog.hours}h</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        timeLog.billable
                          ? "bg-success-light text-success-hover"
                          : "bg-muted-background text-muted-foreground"
                      }`}
                    >
                      {timeLog.billable ? "billable" : "non-billable"}
                    </span>
                  </button>
                ))
              ) : (
                <EmptyState
                  description="Log delivery work against this project."
                  icon={Clock3}
                  title="No time entries yet"
                />
              )}
            </div>
          </Panel>

          <Panel
            action={
              <button
                className="text-xs font-medium text-primary transition-colors hover:text-primary-hover"
                onClick={() => setIsInvoiceDrawerOpen(true)}
                type="button"
              >
                + New invoice
              </button>
            }
            icon={<ReceiptText className="h-4 w-4 text-text-tertiary" />}
            title="Invoices"
          >
            {invoices.length ? (
              <>
                <div className="divide-y divide-border/80">
                  {invoices.slice(0, 4).map((invoice) => (
                    <Link
                      className="flex items-center gap-3 py-3 max-sm:flex-wrap"
                      key={invoice.id}
                      to={`/invoices/${invoice.id}`}
                    >
                      <span className="w-28 shrink-0 font-mono text-[11px] text-text-tertiary max-sm:w-full">
                        {invoice.invoice_number || "Draft"}
                      </span>
                      <span className="min-w-0 flex-1 text-sm text-text-primary">
                        {invoice.notes || project.title}
                      </span>
                      <span className="shrink-0 text-sm font-medium text-text-primary">
                        {formatCurrencyValue(invoice.total)}
                      </span>
                      <div className="flex min-w-[92px] flex-col items-end gap-1 max-sm:ml-auto">
                        <StatusBadge status={invoice.status} />
                        <span className="text-[11px] text-text-tertiary">
                          {formatCurrencyValue(invoice.amount_paid)} paid
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="border-t border-border/80 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted-background">
                      <div
                        className="h-full rounded-full bg-success"
                        style={{
                          width: `${invoicedTotal > 0 ? Math.round((collectedTotal / invoicedTotal) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-text-tertiary">
                      {formatCurrencyValue(outstandingTotal.toFixed(2))} outstanding
                    </span>
                  </div>
                </div>

                <div className="text-xs text-text-tertiary">
                  {invoices.length} invoice{invoices.length === 1 ? "" : "s"} linked
                  {latestInvoice ? ` · Last due ${formatShortDate(latestInvoice.due_date)}` : ""}
                </div>
              </>
            ) : (
              <EmptyState
                action={<Button onClick={() => setIsInvoiceDrawerOpen(true)}>New Invoice</Button>}
                description="Create the first invoice for this delivery project."
                icon={ReceiptText}
                title="No invoices yet"
              />
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            action={
              <button
                className="text-xs font-medium text-primary transition-colors hover:text-primary-hover"
                onClick={() => setIsProjectDrawerOpen(true)}
                type="button"
              >
                Edit
              </button>
            }
            title="Project info"
          >
            {sourceProposal ? (
              <div className="mb-3 flex items-start gap-3 rounded-[10px] bg-primary-light px-3 py-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] bg-primary text-primary-foreground">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-primary-dark">Converted from proposal</p>
                  <p className="mt-1 text-xs text-primary">
                    {formatCurrencyValue(sourceProposal.amount)} · {sourceProposal.status}
                    {sourceProposal.decision_date ? ` ${formatDate(sourceProposal.decision_date)}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      className="max-sm:w-full"
                      onClick={() => navigate(`/proposals/${sourceProposal.id}`)}
                      type="button"
                      variant="secondary"
                    >
                      Open proposal
                    </Button>
                    {canSendSourceProposal ? (
                      <Button
                        className="max-sm:w-full"
                        loading={sendProposalMutation.isPending}
                        onClick={() => sendProposalMutation.mutate(sourceProposal.id)}
                        type="button"
                        variant="secondary"
                      >
                        Send proposal
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="rounded-[10px] bg-background-secondary px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Client</p>
                <p className="mt-1 text-sm font-medium text-text-primary">{project.client_name}</p>
                {client?.contact_person ? (
                  <p className="mt-1 text-xs text-text-tertiary">{client.contact_person}</p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-[10px] bg-background-secondary px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Start date</p>
                  <p className="mt-1 text-sm text-text-primary">{formatDate(project.start_date)}</p>
                </div>
                <div className="rounded-[10px] bg-background-secondary px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Due date</p>
                  <p className={`mt-1 text-sm ${getRelativeDueLabel(project.due_date).includes("overdue") ? "text-error-hover" : "text-text-primary"}`}>
                    {formatDate(project.due_date)}
                  </p>
                </div>
              </div>

              <div className="rounded-[10px] bg-background-secondary px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Budget</p>
                <p className="mt-1 text-sm font-medium text-text-primary">{formatCurrencyValue(project.budget)}</p>
                <p className="mt-1 text-xs text-text-tertiary">
                  {formatCurrencyValue(burnAmount.toFixed(2))} burned ({burnPercent}%)
                </p>
              </div>

              <div className="rounded-[10px] bg-background-secondary px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Description</p>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  {project.description || "No project description added yet."}
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="Quick actions">
            <div className="space-y-2">
              {sourceProposal ? (
                <button
                  className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm font-medium text-text-primary transition-colors hover:bg-background-secondary"
                  onClick={() => navigate(`/proposals/${sourceProposal.id}`)}
                  type="button"
                >
                  <FileText className="h-4 w-4 text-text-tertiary" />
                  Open linked proposal
                  <ArrowUpRight className="ml-auto h-4 w-4 text-text-tertiary" />
                </button>
              ) : null}
              {canSendSourceProposal ? (
                <button
                  className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm font-medium text-text-primary transition-colors hover:bg-background-secondary"
                  onClick={() => sendProposalMutation.mutate(sourceProposal.id)}
                  type="button"
                >
                  <Send className="h-4 w-4 text-text-tertiary" />
                  Send linked proposal
                  <ArrowUpRight className="ml-auto h-4 w-4 text-text-tertiary" />
                </button>
              ) : null}
              <button
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm font-medium text-text-primary transition-colors hover:bg-background-secondary"
                onClick={() => setIsTimeLogDrawerOpen(true)}
                type="button"
              >
                <Clock3 className="h-4 w-4 text-text-tertiary" />
                Log time
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
                  if (latestInvoice) {
                    navigate(`/invoices/${latestInvoice.id}`);
                  }
                }}
                type="button"
              >
                <ReceiptText className="h-4 w-4 text-text-tertiary" />
                Record payment
                <ArrowUpRight className="ml-auto h-4 w-4 text-text-tertiary" />
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm font-medium text-text-primary transition-colors hover:bg-background-secondary"
                onClick={askFundiForProject}
                type="button"
              >
                <Layers3 className="h-4 w-4 text-text-tertiary" />
                Ask Fundi about this project
                <ArrowUpRight className="ml-auto h-4 w-4 text-text-tertiary" />
              </button>
            </div>
          </Panel>

          <Panel icon={<Clock3 className="h-4 w-4 text-text-tertiary" />} title="Hours summary">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Billable hours</span>
                <span className="font-medium text-text-primary">{formatCompactHours(timeSummary.billable_hours)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Non-billable</span>
                <span className="text-text-primary">{formatCompactHours(timeSummary.non_billable_hours)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Total logged</span>
                <span className="font-medium text-text-primary">{formatCompactHours(timeSummary.total_hours)}</span>
              </div>
              <div className="my-2 h-px bg-border/80" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Effective rate</span>
                <span className="font-medium text-success-hover">{formatCurrencyValue(timeSummary.effective_rate)} / hr</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Budget remaining</span>
                <span className={`font-medium ${isBudgetWarning ? "text-warning-hover" : "text-success-hover"}`}>
                  {formatCurrencyValue(budgetRemaining.toFixed(2))} ({Math.max(100 - burnPercent, 0)}%)
                </span>
              </div>
            </div>

            {isBudgetWarning ? (
              <div className="mt-3 rounded-lg bg-warning-light px-3 py-3">
                <p className="text-xs font-semibold text-warning-hover">Budget warning</p>
                <p className="mt-1 text-xs leading-5 text-warning-hover">
                  {burnPercent}% burned with {Math.max(milestones.length - completedMilestones, 0)} milestones remaining.
                </p>
              </div>
            ) : null}
          </Panel>
        </div>
      </div>
    </section>
  );
}
