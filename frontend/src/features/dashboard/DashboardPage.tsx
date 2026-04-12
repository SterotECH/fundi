import { useMemo } from "react";
import type { ComponentType } from "react";
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

import { cn } from "@/app/cn";
import { getDashboardSummary } from "@/api/dashboard";
import type { DashboardSummary } from "@/api/types";
import { EmptyState } from "@/components/status/EmptyState";
import { LoadingState } from "@/components/status/LoadingState";
import { StatusBadge } from "@/components/status/StatusBadge";
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

type SummaryTileProps = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  meta: string;
  tone?: "default" | "good" | "warn" | "bad" | "info";
  value: string | number;
};

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

function SummaryTile({ icon: Icon, label, meta, tone = "default", value }: SummaryTileProps) {
  const toneClassName = {
    default: "text-text-tertiary",
    good: "text-success-hover",
    warn: "text-warning-hover",
    bad: "text-error-hover",
    info: "text-info-hover",
  }[tone];

  return (
    <article className="group min-h-32 rounded-lg border border-card-border bg-card px-4 py-4 transition-colors hover:border-border-hover hover:bg-card-hover">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.04em] text-text-tertiary">
            {label}
          </p>
          <p className="mt-3 font-syne text-2xl font-semibold leading-none text-text-primary">
            {value}
          </p>
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background-secondary text-icon-active transition-transform group-hover:-translate-y-0.5">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={cn("mt-3 text-xs font-medium", toneClassName)}>{meta}</p>
    </article>
  );
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

  const activityBars = useMemo(() => [35, 56, 42, 68, 82, 100], []);

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
  const overdueAmount = data.overdue_invoices.reduce(
    (total, invoice) => total + toNumber(invoice.amount_remaining),
    0,
  );
  const assistantMessage = data.overdue_invoices.length
    ? `${formatCurrencyValue(overdueAmount)} is overdue across ${data.overdue_invoices.length} invoices. Start with ${data.overdue_invoices[0]?.client_name}.`
    : `${formatCurrencyValue(data.total_outstanding)} is currently outstanding. No overdue invoice needs escalation.`;

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
        <SummaryTile
          icon={CircleDollarSign}
          label="Outstanding"
          meta={`${data.overdue_invoices.length} overdue invoices`}
          tone={data.overdue_invoices.length ? "bad" : "good"}
          value={formatCompactCurrency(data.total_outstanding)}
        />
        <SummaryTile
          icon={ReceiptText}
          label="Open proposals"
          meta="Draft, sent, and negotiating"
          tone="info"
          value={metrics.openProposalCount}
        />
        <SummaryTile
          icon={Trophy}
          label="Win rate"
          meta={`${metrics.decidedProposalCount} decided proposals`}
          tone="good"
          value={`${metrics.winRate}%`}
        />
        <SummaryTile
          icon={FolderKanban}
          label="Active projects"
          meta={`${metrics.dueThisMonth} due this month`}
          value={data.active_projects.length}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <section className="rounded-lg border border-card-border bg-card p-4 xl:col-span-4 xl:row-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-secondary">
              Proposal pipeline
            </h2>
            <span className="rounded-full bg-muted-background px-2.5 py-1 text-[0.7rem] font-semibold text-muted-foreground">
              Live
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {proposalStatusMeta.map((item) => {
              const count = data.proposal_counts[item.key] || 0;
              const width = `${Math.max(6, (count / maxProposalCount) * 100)}%`;

              return (
                <div
                  className="grid grid-cols-[6.4rem_minmax(0,1fr)_2rem] items-center gap-3"
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
                </div>
              );
            })}
          </div>

          <div className="my-4 h-px bg-divider" />

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-secondary">
              Pipeline pulse
            </h3>
            <span className="text-xs text-text-tertiary">Last 6 checks</span>
          </div>
          <div className="mt-3 flex h-14 items-end gap-1.5">
            {activityBars.map((height, index) => (
              <div
                className={cn(
                  "flex-1 rounded-t bg-primary-light",
                  index === activityBars.length - 1 && "bg-primary",
                )}
                key={`${height}-${index}`}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[0.68rem] font-medium text-text-tertiary">
            <span>Previous</span>
            <span>Now</span>
          </div>
        </section>

        <section className="rounded-lg border border-card-border bg-card p-4 xl:col-span-4 xl:row-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-secondary">
              Upcoming deadlines
            </h2>
            <CalendarClock className="h-4 w-4 text-icon-active" />
          </div>

          <div className="mt-3 divide-y divide-divider">
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
              <p className="py-8 text-sm text-text-secondary">
                No deadlines in the current window.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-card-border bg-card p-4 xl:col-span-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-secondary">
              Overdue invoices
            </h2>
            <span className="rounded-full bg-error-light px-2.5 py-1 text-[0.68rem] font-semibold text-error-hover">
              {formatCompactCurrency(overdueAmount)}
            </span>
          </div>

          <div className="mt-3 divide-y divide-divider">
            {data.overdue_invoices.length ? (
              data.overdue_invoices.slice(0, 3).map((invoice) => (
                <article className="flex items-center gap-3 py-2.5" key={invoice.id}>
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
                </article>
              ))
            ) : (
              <p className="py-8 text-sm text-text-secondary">
                No overdue invoices.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-card-border bg-card p-4 xl:col-span-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-secondary">
              Active projects
            </h2>
            <FolderKanban className="h-4 w-4 text-icon-active" />
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {data.active_projects.length ? (
              data.active_projects.slice(0, 4).map((project, index) => {
                const progress = [68, 44, 28, 12][index] || 18;

                return (
                  <article
                    className="rounded-lg bg-background-secondary px-3 py-3"
                    key={project.id}
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
                  </article>
                );
              })
            ) : (
              <p className="text-sm text-text-secondary">No active projects yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-card-border bg-card p-4 xl:col-span-4">
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
