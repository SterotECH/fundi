import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bell,
  CalendarClock,
  CircleDollarSign,
  FolderKanban,
  Lightbulb,
  ReceiptText,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Link } from "react-router";

import { cn } from "@/app/cn";
import { getDashboardSummary } from "@/api/dashboard";
import type { DashboardSummary } from "@/api/types";
import { EmptyState } from "@/components/status/EmptyState";
import { LoadingState } from "@/components/status/LoadingState";
import { StatusBadge } from "@/components/status/StatusBadge";
import { StatCard } from "@/components/ui/StatCard";
import { formatCurrencyValue } from "@/utils/currency";

const proposalStatusMeta = [
  {
    key: "draft",
    label: "Draft",
    barClassName: "bg-muted",
    chipClassName: "bg-muted-background text-muted-foreground",
  },
  {
    key: "sent",
    label: "Sent",
    barClassName: "bg-info",
    chipClassName: "bg-info-light text-info-hover",
  },
  {
    key: "negotiating",
    label: "Negotiating",
    barClassName: "bg-warning",
    chipClassName: "bg-warning-light text-warning-hover",
  },
  {
    key: "won",
    label: "Won",
    barClassName: "bg-success",
    chipClassName: "bg-success-light text-success-hover",
  },
  {
    key: "lost",
    label: "Lost",
    barClassName: "bg-error",
    chipClassName: "bg-error-light text-error-hover",
  },
] as const;

function toNumber(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(String(value));

  return Number.isNaN(numericValue) ? 0 : numericValue;
}

function getDaysDiff(dateValue: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(`${dateValue}T00:00:00`);
  const diff = date.getTime() - today.getTime();
  return Math.round(diff / 86_400_000);
}

function getDeadlineMeta(dateValue: string) {
  const days = getDaysDiff(dateValue);

  if (days <= 0) {
    return {
      label: "Today",
      chipClassName: "bg-error-light text-error-hover",
      dotClassName: "bg-error",
    };
  }

  if (days <= 5) {
    return {
      label: `${days} days`,
      chipClassName: "bg-warning-light text-warning-hover",
      dotClassName: "bg-warning",
    };
  }

  return {
    label: `${days} days`,
    chipClassName: "bg-success-light text-success-hover",
    dotClassName: "bg-success",
  };
}

function getOverdueLabel(dateValue: string | null) {
  if (!dateValue) {
    return "Overdue";
  }

  const days = Math.abs(Math.min(getDaysDiff(dateValue), 0));

  if (days === 0) {
    return "Today";
  }

  return `${days}d`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatCompactCurrency(value: string | number) {
  const amount = toNumber(value);

  if (amount >= 1000) {
    return `GHS ${new Intl.NumberFormat("en-GH", {
      maximumFractionDigits: 1,
      notation: "compact",
    }).format(amount)}`;
  }

  return formatCurrencyValue(amount);
}

function getDashboardMetrics(data: DashboardSummary) {
  const openProposalCount =
    (data.proposal_counts.draft || 0) +
    (data.proposal_counts.sent || 0) +
    (data.proposal_counts.negotiating || 0);
  const decidedProposalCount =
    (data.proposal_counts.won || 0) + (data.proposal_counts.lost || 0);
  const winRate =
    decidedProposalCount > 0
      ? Math.round(((data.proposal_counts.won || 0) / decidedProposalCount) * 100)
      : 0;
  const dueThisMonth = data.active_projects.filter((project) => {
    const dueDate = new Date(`${project.due_date}T00:00:00`);
    const today = new Date();
    return (
      dueDate.getMonth() === today.getMonth() &&
      dueDate.getFullYear() === today.getFullYear()
    );
  }).length;

  return {
    decidedProposalCount,
    dueThisMonth,
    openProposalCount,
    winRate,
  };
}

export function DashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboardSummary,
  });

  if (dashboardQuery.isLoading) {
    return <LoadingState label="Loading dashboard..." />;
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <EmptyState
        tone="error"
        title="Dashboard could not load"
        description="Refresh the page or sign in again if the session expired."
      />
    );
  }

  const data = dashboardQuery.data;
  const metrics = getDashboardMetrics(data);
  const maxProposalCount = Math.max(
    1,
    ...proposalStatusMeta.map((item) => data.proposal_counts[item.key] || 0),
  );
  const maxProposalAmount = Math.max(
    1,
    ...proposalStatusMeta.map((item) => toNumber(data.proposal_amounts[item.key])),
  );
  const overdueAmount = data.overdue_invoices.reduce(
    (total, invoice) => total + toNumber(invoice.amount_remaining),
    0,
  );
  const assistantMessage = data.overdue_invoices.length
    ? `${formatCurrencyValue(overdueAmount)} is overdue across ${data.overdue_invoices.length} invoices. Start with ${data.overdue_invoices[0]?.client_name}.`
    : `${formatCurrencyValue(data.total_outstanding)} is currently outstanding. No overdue invoice needs escalation.`;
  const hasPipelineData = proposalStatusMeta.some(
    (item) =>
      (data.proposal_counts[item.key] || 0) > 0 ||
      toNumber(data.proposal_amounts[item.key]) > 0,
  );
  const pipelinePulseBars = proposalStatusMeta.map((item) => ({
    ...item,
    amount: toNumber(data.proposal_amounts[item.key]),
    count: data.proposal_counts[item.key] || 0,
  }));
  const maxPipelinePulseValue = Math.max(
    1,
    ...pipelinePulseBars.map((item) => (item.amount > 0 ? item.amount : item.count)),
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
            Company OS
          </p>
          <h1 className="mt-1 font-syne text-2xl font-semibold leading-tight text-text-primary">
            Money, pipeline, and delivery
          </h1>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-text-secondary">
          <Bell className="h-4 w-4 text-icon-active" />
          {data.unread_notifications_count} unread alerts
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link to="/invoices">
          <StatCard
            color={data.overdue_invoices.length ? "flamingo" : "forest"}
            description={`${data.overdue_invoices.length} overdue invoices`}
            icon={CircleDollarSign}
            label="Outstanding"
            value={formatCompactCurrency(data.total_outstanding)}
          />
        </Link>
        <Link to="/proposals">
          <StatCard
            color="ocean"
            description="Draft, sent, and negotiating"
            icon={ReceiptText}
            label="Open proposals"
            value={metrics.openProposalCount}
          />
        </Link>
        <Link to="/proposals">
          <StatCard
            color="sunset"
            description={`${metrics.decidedProposalCount} decided proposals`}
            icon={Trophy}
            label="Win rate"
            value={`${metrics.winRate}%`}
          />
        </Link>
        <Link to="/projects">
          <StatCard
            color="primary"
            description={`${metrics.dueThisMonth} due this month`}
            icon={FolderKanban}
            label="Active projects"
            value={data.active_projects.length}
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <section className="flex h-full flex-col rounded-lg border border-card-border bg-card/90 p-4 backdrop-blur-sm xl:col-span-4 xl:row-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-secondary">
              Proposal pipeline
            </h2>
            <span className="rounded-full bg-muted-background px-2.5 py-1 text-[0.7rem] font-semibold text-muted-foreground">
              Live
            </span>
          </div>

          {hasPipelineData ? (
            <div className="mt-4 space-y-3">
              {proposalStatusMeta.map((item) => {
                const count = data.proposal_counts[item.key] || 0;
                const amount = toNumber(data.proposal_amounts[item.key]);
                const widthBasis = amount > 0 ? amount / maxProposalAmount : count / maxProposalCount;
                const width = `${Math.max(6, widthBasis * 100)}%`;

                return (
                  <div
                    className="grid grid-cols-[6.4rem_minmax(0,1fr)_2rem_5.75rem] items-center gap-3"
                    key={item.key}
                  >
                    <span className="truncate text-xs font-medium text-text-secondary">
                      {item.label}
                    </span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-background-tertiary">
                      <div
                        className={cn("h-full rounded-full", item.barClassName)}
                        style={{ width }}
                      />
                    </div>
                    <span className="text-right text-xs font-semibold text-text-primary">
                      {count}
                    </span>
                    <span className="text-right text-[0.68rem] font-medium text-text-tertiary">
                      {formatCompactCurrency(amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 flex min-h-52 flex-1 items-center">
              <EmptyState
                actionHref="/proposals"
                actionLabel="Create proposal"
                animated={false}
                color="info"
                description="Once proposals are added, stage counts and value totals will show here."
                framed={false}
                icon={ReceiptText}
                size="sm"
                title="No pipeline activity yet"
              />
            </div>
          )}

          <div className="my-4 h-px bg-divider" />

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-secondary">
              Pipeline pulse
            </h3>
            <span className="text-xs text-text-tertiary">Live stage mix</span>
          </div>
          {hasPipelineData ? (
            <>
              <div className="mt-3 flex h-14 items-end gap-1.5">
                {pipelinePulseBars.map((item) => {
                  const value = item.amount > 0 ? item.amount : item.count;
                  const height = Math.max(12, (value / maxPipelinePulseValue) * 100);

                  return (
                    <div
                      className={cn("flex-1 rounded-t", item.barClassName)}
                      key={item.key}
                      style={{ height: `${height}%` }}
                      title={`${item.label}: ${item.count} · ${formatCompactCurrency(item.amount)}`}
                    />
                  );
                })}
              </div>
              <div className="mt-2 grid grid-cols-5 gap-1 text-[0.68rem] font-medium text-text-tertiary">
                {pipelinePulseBars.map((item) => (
                  <span className="truncate text-center" key={item.key}>
                    {item.label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-3 text-xs text-text-tertiary">
              Pulse will appear once the first proposal enters the pipeline.
            </div>
          )}
        </section>

        <section className="flex h-full flex-col rounded-lg border border-card-border bg-card/90 p-4 backdrop-blur-sm xl:col-span-4 xl:row-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-secondary">
              Upcoming deadlines
            </h2>
            <CalendarClock className="h-4 w-4 text-icon-active" />
          </div>

          <div className="mt-3 flex flex-1 flex-col divide-y divide-divider">
            {data.upcoming_proposal_deadlines.length ? (
              data.upcoming_proposal_deadlines.slice(0, 5).map((proposal) => {
                const deadline = getDeadlineMeta(proposal.deadline);

                return (
                  <article
                    className="flex items-center gap-3 py-2.5"
                    key={proposal.id}
                  >
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", deadline.dotClassName)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {proposal.title}
                      </p>
                      <p className="truncate text-xs text-text-secondary">
                        {proposal.client_name} · {formatCompactCurrency(proposal.amount)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[0.68rem] font-semibold",
                        deadline.chipClassName,
                      )}
                    >
                      {deadline.label}
                    </span>
                  </article>
                );
              })
            ) : (
              <EmptyState
                actionHref="/proposals"
                actionLabel="View proposals"
                animated={false}
                color="warning"
                description="There are no proposal deadlines in the current two-week window."
                framed={false}
                icon={CalendarClock}
                size="sm"
                title="No upcoming deadlines"
              />
            )}
          </div>
        </section>

        <section className="flex h-full flex-col rounded-lg border border-card-border bg-card/90 p-4 backdrop-blur-sm xl:col-span-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-secondary">
              Overdue invoices
            </h2>
            <span className="rounded-full bg-error-light px-2.5 py-1 text-[0.68rem] font-semibold text-error-hover">
              {formatCompactCurrency(overdueAmount)}
            </span>
          </div>

          <div className="mt-3 flex flex-1 flex-col divide-y divide-divider">
            {data.overdue_invoices.length ? (
              data.overdue_invoices.slice(0, 3).map((invoice) => (
                <Link className="flex items-center gap-3 py-2.5" key={invoice.id} to={`/invoices/${invoice.id}`}>
                  <span className="w-24 shrink-0 truncate font-mono text-[0.72rem] text-text-tertiary">
                    {invoice.invoice_number || "Draft"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {invoice.client_name}
                    </p>
                    <p className="text-xs text-text-secondary">
                      Due {formatDate(invoice.due_date)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-text-primary">
                    {formatCompactCurrency(invoice.amount_remaining)}
                  </p>
                  <span className="rounded-full bg-warning-light px-2.5 py-1 text-[0.68rem] font-semibold text-warning-hover">
                    {getOverdueLabel(invoice.due_date)}
                  </span>
                </Link>
              ))
            ) : (
              <EmptyState
                actionHref="/invoices"
                actionLabel="View invoices"
                animated={false}
                color="success"
                description="Every invoice is either current or fully paid."
                framed={false}
                icon={CircleDollarSign}
                size="sm"
                title="Nothing overdue"
              />
            )}
          </div>
        </section>

        <section className="flex h-full flex-col rounded-lg border border-card-border bg-card/90 p-4 backdrop-blur-sm xl:col-span-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-secondary">
              Active projects
            </h2>
            <FolderKanban className="h-4 w-4 text-icon-active" />
          </div>

          <div className="mt-3 grid flex-1 gap-2 md:grid-cols-2">
            {data.active_projects.length ? (
              data.active_projects.slice(0, 4).map((project, index) => {
                const progress = [68, 44, 28, 12][index] || 18;

                return (
                  <Link
                    className="rounded-lg border border-border/60 bg-background-secondary px-3 py-3 transition-colors hover:border-border-hover hover:bg-card-hover"
                    key={project.id}
                    to={`/projects/${project.id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <StatusBadge status={project.status} />
                      <span className="text-xs text-text-tertiary">
                        Due {formatDate(project.due_date)}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold text-text-primary">
                      {project.title}
                    </p>
                    <p className="truncate text-xs text-text-secondary">
                      {project.client_name} · {formatCompactCurrency(project.budget)}
                    </p>
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-background-tertiary">
                      <div
                        className="h-full rounded-full bg-success"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </Link>
                );
              })
            ) : (
              <EmptyState
                actionHref="/projects"
                actionLabel="Create project"
                animated={false}
                color="primary"
                description="Active delivery work will appear here once a project is underway."
                framed={false}
                icon={FolderKanban}
                size="sm"
                title="No active projects"
              />
            )}
          </div>
        </section>

        <section className="rounded-lg border border-card-border bg-card/90 p-4 backdrop-blur-sm xl:col-span-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-secondary">
              Assistant cue
            </h2>
            <Sparkles className="h-4 w-4 text-icon-active" />
          </div>

          <div className="mt-3 rounded-lg bg-primary-light px-3 py-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Lightbulb className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium leading-6 text-primary-dark">
                  {assistantMessage}
                </p>
                <button
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover"
                  type="button"
                >
                  Open reminder workflow
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            <button
              className="rounded-lg border border-border bg-card px-3 py-2 text-left text-xs font-semibold text-text-secondary transition-colors hover:border-border-hover hover:bg-card-hover hover:text-text-primary"
              type="button"
            >
              Which proposals need follow-up this week?
            </button>
            <button
              className="rounded-lg border border-border bg-card px-3 py-2 text-left text-xs font-semibold text-text-secondary transition-colors hover:border-border-hover hover:bg-card-hover hover:text-text-primary"
              type="button"
            >
              Show unpaid work by client.
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
