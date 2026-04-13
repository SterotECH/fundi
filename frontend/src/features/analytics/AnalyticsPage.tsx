import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CircleAlert, FolderKanban, ReceiptText, Users } from "lucide-react";
import { Link } from "react-router";

import {
  getClientProfitability,
  getInsights,
  getPipelineMetrics,
  getProjectBudgetBurn,
  getRevenueSeries,
  getRevenueSummary,
} from "@/api/analytics";
import type { Insight } from "@/api/types";
import { EmptyState } from "@/components/status/EmptyState";
import { LoadingState } from "@/components/status/LoadingState";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { formatCurrencyValue } from "@/utils/currency";

type ProfitSort = "revenue" | "hours" | "rate";

function toNumber(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("en-GH", { month: "short" }).format(date);
}

function resolveInsightHref(item: Insight) {
  if (!item.entity_type || !item.entity_id) {
    return "/analytics";
  }

  if (item.entity_type === "Client") {
    return `/clients/${item.entity_id}`;
  }

  if (item.entity_type === "Project") {
    return `/projects/${item.entity_id}`;
  }

  if (item.entity_type === "Proposal") {
    return `/proposals/${item.entity_id}`;
  }

  if (item.entity_type === "Invoice") {
    return `/invoices/${item.entity_id}`;
  }

  return "/analytics";
}

function getSeverityTone(severity: string) {
  if (severity === "high") {
    return "border-error/40 bg-error-light/60 text-error-hover";
  }
  if (severity === "medium") {
    return "border-warning/40 bg-warning-light/60 text-warning-hover";
  }
  return "border-info/40 bg-info-light/60 text-info-hover";
}

function getProjectBurnTone(burnPct: number, status: string) {
  if (status === "done") {
    return "bg-success";
  }
  if (burnPct >= 80) {
    return "bg-error";
  }
  if (burnPct >= 60) {
    return "bg-warning";
  }
  return "bg-success";
}

export function AnalyticsPage() {
  const [profitSort, setProfitSort] = useState<ProfitSort>("revenue");

  const revenueSeriesQuery = useQuery({
    queryKey: ["analytics", "revenue-series"],
    queryFn: () => getRevenueSeries(12),
  });
  const revenueSummaryQuery = useQuery({
    queryKey: ["analytics", "revenue-summary"],
    queryFn: getRevenueSummary,
  });
  const pipelineQuery = useQuery({
    queryKey: ["analytics", "pipeline"],
    queryFn: getPipelineMetrics,
  });
  const clientProfitabilityQuery = useQuery({
    queryKey: ["analytics", "clients", profitSort],
    queryFn: () => getClientProfitability(profitSort),
  });
  const projectBurnQuery = useQuery({
    queryKey: ["analytics", "projects"],
    queryFn: getProjectBudgetBurn,
  });
  const insightsQuery = useQuery({
    queryKey: ["analytics", "insights"],
    queryFn: getInsights,
  });

  const isLoading =
    revenueSeriesQuery.isLoading ||
    revenueSummaryQuery.isLoading ||
    pipelineQuery.isLoading ||
    clientProfitabilityQuery.isLoading ||
    projectBurnQuery.isLoading ||
    insightsQuery.isLoading;

  if (isLoading) {
    return <LoadingState label="Loading analytics..." />;
  }

  if (
    revenueSeriesQuery.isError ||
    revenueSummaryQuery.isError ||
    pipelineQuery.isError ||
    clientProfitabilityQuery.isError ||
    projectBurnQuery.isError ||
    insightsQuery.isError
  ) {
    return (
      <EmptyState
        tone="error"
        title="Analytics could not load"
        description="Refresh this screen. If the issue persists, re-authenticate."
      />
    );
  }

  const revenueSeries = revenueSeriesQuery.data;
  const revenueSummary = revenueSummaryQuery.data;
  const pipeline = pipelineQuery.data;
  const clientRows = clientProfitabilityQuery.data ?? [];
  const projectRows = projectBurnQuery.data ?? [];
  const insights = insightsQuery.data ?? [];
  const maxCollected = Math.max(
    1,
    ...(revenueSeries?.months.map((item) => toNumber(item.collected_ghs)) ?? [0]),
  );
  const months = revenueSeries?.months ?? [];
  const chartMonths = months.slice(-12);
  const chartMonthsMobile = chartMonths.slice(-6);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
            Sprint 3
          </p>
          <h1 className="mt-1 font-syne text-2xl font-semibold text-text-primary">
            Analytics & Insights
          </h1>
        </div>
        <Link to="/dashboard">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          color="success"
          icon={ReceiptText}
          label="This month"
          value={formatCurrencyValue(revenueSummary?.this_month_collected ?? "0")}
          description={`Last month ${formatCurrencyValue(revenueSummary?.last_month_collected ?? "0")}`}
        />
        <StatCard
          color={toNumber(revenueSummary?.mom_change_pct) >= 0 ? "success" : "flamingo"}
          icon={BarChart3}
          label="MoM change"
          value={`${toNumber(revenueSummary?.mom_change_pct).toFixed(1)}%`}
          description={`${formatCurrencyValue(revenueSummary?.ytd_collected ?? "0")} YTD`}
        />
        <StatCard
          color="sunset"
          icon={FolderKanban}
          label="Pipeline value"
          value={formatCurrencyValue(pipeline?.total_pipeline_value_ghs ?? "0")}
          description={`${toNumber(pipeline?.win_rate_pct).toFixed(1)}% win rate`}
        />
        <StatCard
          color={toNumber(revenueSummary?.overdue_total) > 0 ? "flamingo" : "forest"}
          icon={CircleAlert}
          label="Overdue total"
          value={formatCurrencyValue(revenueSummary?.overdue_total ?? "0")}
          description={`${revenueSummary?.overdue_count ?? 0} overdue invoices`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-2xl border border-card-border bg-card/90 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-primary">Revenue collected — last 12 months</h2>
            <span className="text-xs text-text-tertiary">GHS · payments received</span>
          </div>

          {chartMonths.length ? (
            <>
              <div className="hidden h-44 items-end gap-2 sm:flex">
                {chartMonths.map((point, index) => {
                  const value = toNumber(point.collected_ghs);
                  const height = Math.max(8, (value / maxCollected) * 100);
                  const isCurrent = index === chartMonths.length - 1;

                  return (
                    <div className="flex min-w-0 flex-1 flex-col items-center gap-1" key={point.month}>
                      <div
                        className={`w-full rounded-t-sm ${isCurrent ? "bg-primary" : "bg-primary/45"}`}
                        style={{ height: `${height}%` }}
                        title={`${point.month}: ${formatCurrencyValue(point.collected_ghs)}`}
                      />
                      <span className="text-[10px] text-text-tertiary">{formatMonthLabel(point.month)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex h-40 items-end gap-2 sm:hidden">
                {chartMonthsMobile.map((point, index) => {
                  const value = toNumber(point.collected_ghs);
                  const height = Math.max(8, (value / maxCollected) * 100);
                  const isCurrent = index === chartMonthsMobile.length - 1;

                  return (
                    <div className="flex min-w-0 flex-1 flex-col items-center gap-1" key={point.month}>
                      <div
                        className={`w-full rounded-t-sm ${isCurrent ? "bg-primary" : "bg-primary/45"}`}
                        style={{ height: `${height}%` }}
                        title={`${point.month}: ${formatCurrencyValue(point.collected_ghs)}`}
                      />
                      <span className="text-[10px] text-text-tertiary">{formatMonthLabel(point.month)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <EmptyState
              title="No revenue data yet"
              description="Record payments to generate the monthly revenue trend."
              icon={BarChart3}
              actionHref="/invoices"
              actionLabel="Go to invoices"
              framed={false}
              animated={false}
              size="sm"
            />
          )}
        </section>

        <section className="rounded-2xl border border-card-border bg-card/90 p-5">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Rule-based insights</h2>
          {insights.length ? (
            <div className="space-y-2">
              {insights.map((insight) => (
                <Link
                  className={`block rounded-xl border px-3 py-3 ${getSeverityTone(insight.severity)}`}
                  key={`${insight.type}-${insight.entity_id ?? insight.title}`}
                  to={resolveInsightHref(insight)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{insight.title}</p>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.06em]">
                      {insight.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs">{insight.body}</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No active insights"
              description="No thresholds are currently triggered by your live data."
              icon={CircleAlert}
              framed={false}
              animated={false}
              size="sm"
            />
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-card-border bg-card/90 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-text-primary">Client profitability</h2>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setProfitSort("revenue")} variant={profitSort === "revenue" ? "primary" : "secondary"}>
              Revenue
            </Button>
            <Button onClick={() => setProfitSort("hours")} variant={profitSort === "hours" ? "primary" : "secondary"}>
              Hours
            </Button>
            <Button onClick={() => setProfitSort("rate")} variant={profitSort === "rate" ? "primary" : "secondary"}>
              Rate
            </Button>
          </div>
        </div>

        {clientRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-divider text-xs uppercase tracking-[0.05em] text-text-tertiary">
                  <th className="py-2 pr-3 font-semibold">Client</th>
                  <th className="py-2 pr-3 font-semibold">Collected</th>
                  <th className="py-2 pr-3 font-semibold">Outstanding</th>
                  <th className="py-2 pr-3 font-semibold max-sm:hidden">Hours</th>
                  <th className="py-2 pr-3 font-semibold max-sm:hidden">Rate</th>
                  <th className="py-2 pr-0 font-semibold">Open proposals</th>
                </tr>
              </thead>
              <tbody>
                {clientRows.map((row) => (
                  <tr className="border-b border-divider/70 last:border-b-0" key={row.client_id}>
                    <td className="py-2 pr-3">
                      <Link className="font-medium text-primary hover:text-primary-hover" to={`/clients/${row.client_id}`}>
                        {row.client_name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-text-primary">{formatCurrencyValue(row.collected_ghs)}</td>
                    <td className="py-2 pr-3 text-text-secondary">{formatCurrencyValue(row.outstanding_ghs)}</td>
                    <td className="py-2 pr-3 text-text-secondary max-sm:hidden">{row.total_hours.toFixed(1)}h</td>
                    <td className="py-2 pr-3 text-text-secondary max-sm:hidden">
                      {formatCurrencyValue(row.effective_rate_ghs)}
                    </td>
                    <td className="py-2 pr-0 text-text-primary">{row.open_proposals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-text-tertiary sm:hidden">
              Swipe to view full profitability columns.
            </p>
          </div>
        ) : (
          <EmptyState
            title="No client profitability data"
            description="Create invoices, payments, and time logs to compute profitability."
            icon={Users}
            framed={false}
            animated={false}
            size="sm"
          />
        )}
      </section>

      <section className="rounded-2xl border border-card-border bg-card/90 p-5">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Project budget burn</h2>
        {projectRows.length ? (
          <div className="space-y-2">
            {projectRows.map((row) => (
              <Link
                className="block rounded-xl border border-divider bg-background-secondary/40 px-3 py-3 hover:bg-background-secondary/70"
                key={row.project_id}
                to={`/projects/${row.project_id}`}
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-text-primary">{row.title}</p>
                  <span className="text-xs text-text-tertiary">{row.status}</span>
                </div>
                <p className="mb-2 text-xs text-text-secondary">
                  {row.client_name} · {formatCurrencyValue(row.collected_ghs)} collected of{" "}
                  {formatCurrencyValue(row.budget_ghs)} budget
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-muted-background">
                  <div
                    className={`h-full ${getProjectBurnTone(row.burn_pct, row.status)}`}
                    style={{ width: `${Math.min(Math.max(row.burn_pct, 0), 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-text-tertiary">
                  {row.burn_pct.toFixed(1)}% burn · {row.billable_hours.toFixed(1)}h billable
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No project burn data"
            description="Burn indicators appear after projects have budgets and time logs."
            icon={FolderKanban}
            framed={false}
            animated={false}
            size="sm"
          />
        )}
      </section>
    </section>
  );
}
