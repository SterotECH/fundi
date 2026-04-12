import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CircleDashed,
  FolderKanban,
  Send,
  Trophy,
} from "lucide-react";

import { getDashboardSummary } from "@/api/dashboard";
import { EmptyState } from "@/components/status/EmptyState";
import { LoadingState } from "@/components/status/LoadingState";
import { StatusBadge } from "@/components/status/StatusBadge";
import { StatCard } from "@/components/ui/StatCard";
import { formatCurrencyValue } from "@/utils/currency";

const proposalStatusMeta = [
  { key: "draft", label: "Draft", colorClass: "bg-muted" },
  { key: "sent", label: "Sent", colorClass: "bg-info" },
  { key: "negotiating", label: "Negotiating", colorClass: "bg-warning" },
  { key: "won", label: "Won", colorClass: "bg-success" },
  { key: "lost", label: "Lost", colorClass: "bg-error" },
] as const;

function getDaysUntil(dateValue: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(`${dateValue}T00:00:00`);
  const diff = date.getTime() - today.getTime();
  return Math.round(diff / 86_400_000);
}

function getDeadlineChip(dateValue: string) {
  const days = getDaysUntil(dateValue);

  if (days <= 0) {
    return {
      label: "Today",
      className: "bg-error-light text-error-hover",
      dotClassName: "bg-error",
    };
  }

  if (days <= 5) {
    return {
      label: `${days}d`,
      className: "bg-warning-light text-warning-hover",
      dotClassName: "bg-warning",
    };
  }

  return {
    label: `${days}d`,
    className: "bg-success-light text-success-hover",
    dotClassName: "bg-success",
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
  const openProposalCount =
    (data.proposal_counts.draft || 0) +
    (data.proposal_counts.sent || 0) +
    (data.proposal_counts.negotiating || 0);
  const maxProposalCount = Math.max(
    1,
    ...proposalStatusMeta.map((item) => data.proposal_counts[item.key] || 0),
  );
  const topStats = [
    {
      label: "Open proposals",
      value: openProposalCount,
      description: "Draft, sent, and negotiating proposals still moving.",
      icon: CircleDashed,
      color: "primary" as const,
      badge: "Pipeline",
    },
    {
      label: "Sent proposals",
      value: data.proposal_counts.sent || 0,
      description: "With clients and waiting for the next response.",
      icon: Send,
      color: "ocean" as const,
      badge: "Live",
    },
    {
      label: "Won proposals",
      value: data.proposal_counts.won || 0,
      description: "Accepted proposals ready for delivery.",
      icon: Trophy,
      color: "success" as const,
      badge: "Won",
    },
    {
      label: "Active projects",
      value: data.active_projects.length,
      description: "Current delivery work across clients.",
      icon: FolderKanban,
      color: "forest" as const,
      badge: "Delivery",
    },
  ];

  return (
    <section>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="page-eyebrow">
            Dashboard
          </p>
          <h1 className="mt-2 page-title">
            Pipeline and delivery
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
            Sprint 1 dashboard data only: proposal status counts, upcoming
            deadlines, and active projects.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {topStats.map((item) => (
          <StatCard
            badge={item.badge}
            color={item.color}
            description={item.description}
            icon={item.icon}
            key={item.label}
            label={item.label}
            value={item.value}
          />
        ))}
      </div>

      <div className="mt-6 grid gap-3 xl:grid-cols-12">
        <section className="app-card p-5 xl:col-span-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-eyebrow">Proposal pipeline</p>
              <h2 className="mt-2 section-title">Status counts</h2>
            </div>
            <span className="rounded-full bg-muted-background px-3 py-1 text-xs font-semibold text-text-secondary">
              Live API
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {proposalStatusMeta.map((item) => {
              const count = data.proposal_counts[item.key] || 0;
              const width = `${Math.max(5, (count / maxProposalCount) * 100)}%`;

              return (
                <div className="grid grid-cols-[6.75rem_minmax(0,1fr)_2rem] items-center gap-3" key={item.key}>
                  <span className="truncate text-sm font-medium text-text-secondary">
                    {item.label}
                  </span>
                  <div className="h-2 overflow-hidden rounded-full bg-background-tertiary">
                    <div
                      className={`h-full rounded-full ${item.colorClass}`}
                      style={{ width }}
                    />
                  </div>
                  <span className="text-right text-sm font-semibold text-text-primary">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="app-card p-5 xl:col-span-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-eyebrow">Upcoming deadlines</p>
              <h2 className="mt-2 section-title">Next 14 days</h2>
            </div>
            <CalendarClock className="h-5 w-5 text-icon-active" />
          </div>

          <div className="mt-4 divide-y divide-divider">
            {data.upcoming_proposal_deadlines.length ? (
              data.upcoming_proposal_deadlines.map((proposal) => (
                (() => {
                  const chip = getDeadlineChip(proposal.deadline);

                  return (
                    <div
                      className="flex items-center justify-between gap-3 py-3"
                      key={proposal.id}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${chip.dotClassName}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text-primary">
                          {proposal.title}
                        </p>
                        <p className="mt-1 truncate text-xs text-text-secondary">
                          {proposal.client_name} · {formatCurrencyValue(proposal.amount)}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${chip.className}`}>
                        {chip.label}
                      </span>
                    </div>
                  );
                })()
              ))
            ) : (
              <p className="py-8 text-sm text-text-secondary">No deadlines this window.</p>
            )}
          </div>
        </section>

        <section className="app-card p-5 xl:col-span-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-eyebrow">Active projects</p>
              <h2 className="mt-2 section-title">Current delivery</h2>
            </div>
            <FolderKanban className="h-5 w-5 text-icon-active" />
          </div>

          <div className="mt-4 grid gap-3">
            {data.active_projects.length ? (
              data.active_projects.map((project) => (
                <article
                  className="rounded-lg border border-border bg-background-secondary p-4"
                  key={project.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {project.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-text-secondary">
                        {project.client_name}
                      </p>
                    </div>
                    <StatusBadge status={project.status} />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-divider pt-3">
                    <p className="text-xs text-text-secondary">Due {project.due_date}</p>
                    <p className="text-sm font-semibold text-text-primary">
                      {formatCurrencyValue(project.budget)}
                    </p>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-text-secondary">No active projects yet.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
