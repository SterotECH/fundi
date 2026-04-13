import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  FileText,
  HandCoins,
  Search,
  Send,
  Trophy,
} from "lucide-react";
import { useNavigate } from "react-router";

import { listClients } from "@/api/clients";
import { listProposals } from "@/api/proposals";
import type { Proposal } from "@/api/types";
import { EmptyState } from "@/components/status/EmptyState";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { StatCard } from "@/components/ui/StatCard";
import { ProposalDrawer } from "@/features/proposals/ProposalDrawer";
import { formatCurrencyValue } from "@/utils/currency";

const CLIENT_TYPE_LABELS: Record<string, string> = {
  intl: "International School",
  jhs: "Junior High School",
  shs: "Senior High School",
  uni: "University",
};

type ProposalBucket = {
  amount: number;
  count: number;
  proposals: Proposal[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
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

function getProposalStatusBadgeClassName(status: string) {
  if (status === "draft") return "proposal-status-badge proposal-status-draft";
  if (status === "sent") return "proposal-status-badge proposal-status-sent";
  if (status === "negotiating") return "proposal-status-badge proposal-status-negotiating";
  if (status === "won") return "proposal-status-badge proposal-status-won";
  if (status === "lost") return "proposal-status-badge proposal-status-lost";
  return "proposal-status-badge proposal-status-draft";
}

function getProposalClientMeta(
  proposal: Proposal,
  clientMetaById: Map<string, { name: string; type: string }>,
) {
  const clientMeta = clientMetaById.get(proposal.client);
  return {
    name: proposal.client_name || clientMeta?.name || "Client",
    type: clientMeta?.type || "Client",
  };
}

function getDeadlineState(proposal: Proposal) {
  if (proposal.status === "won" || proposal.status === "lost") {
    return {
      chipClassName: "list-date-chip list-date-chip-neutral",
      label: "Decided",
      rowClassName: proposal.status === "won" ? "list-row-won" : "list-row-lost",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadline = new Date(`${proposal.deadline}T00:00:00`);
  const diffInDays = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);

  if (diffInDays < 0) {
    return {
      chipClassName: "list-date-chip list-date-chip-danger",
      label: "Overdue",
      rowClassName: "list-row-overdue",
    };
  }

  if (diffInDays <= 3) {
    return {
      chipClassName: "list-date-chip list-date-chip-warning",
      label: `${diffInDays} day${diffInDays === 1 ? "" : "s"}`,
      rowClassName: "list-row-urgent",
    };
  }

  if (diffInDays <= 7) {
    return {
      chipClassName: "list-date-chip list-date-chip-neutral",
      label: `${diffInDays} days`,
      rowClassName: "",
    };
  }

  return {
    chipClassName: "list-date-chip list-date-chip-neutral",
    label: `${diffInDays} days`,
    rowClassName: "",
  };
}

function sumAmount(proposals: Proposal[]) {
  return proposals.reduce(
    (total, proposal) => total + Number.parseFloat(proposal.amount || "0"),
    0,
  );
}

function isWithinDateRange(value: string, from: string, to: string) {
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

export function ProposalsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [deadlineFrom, setDeadlineFrom] = useState("");
  const [deadlineTo, setDeadlineTo] = useState("");
  const [ordering, setOrdering] = useState<
    "deadline" | "-deadline" | "amount_ghs" | "-amount_ghs"
  >("deadline");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  const proposalsQuery = useQuery({
    queryKey: ["proposals", { search, statusFilter, clientFilter }],
    queryFn: () =>
      listProposals({
        search,
        status: statusFilter,
        clientId: clientFilter,
      }),
  });

  const clientsQuery = useQuery({
    queryKey: ["proposal-filter-clients"],
    queryFn: () => listClients({ isArchived: "false" }),
  });

  const clientMetaById = useMemo(
    () =>
      new Map(
        (clientsQuery.data ?? []).map((client) => [
          client.id,
          {
            name: client.name,
            type: CLIENT_TYPE_LABELS[client.type] ?? client.type,
          },
        ]),
      ),
    [clientsQuery.data],
  );

  const allProposals = useMemo(() => proposalsQuery.data ?? [], [proposalsQuery.data]);

  const rows = useMemo(() => {
    const filtered = allProposals.filter((proposal) =>
      isWithinDateRange(proposal.deadline, deadlineFrom, deadlineTo),
    );

    return [...filtered].sort((left, right) => {
      if (ordering === "amount_ghs") {
        return Number.parseFloat(left.amount) - Number.parseFloat(right.amount);
      }

      if (ordering === "-amount_ghs") {
        return Number.parseFloat(right.amount) - Number.parseFloat(left.amount);
      }

      if (ordering === "-deadline") {
        return new Date(right.deadline).getTime() - new Date(left.deadline).getTime();
      }

      return new Date(left.deadline).getTime() - new Date(right.deadline).getTime();
    });
  }, [allProposals, deadlineFrom, deadlineTo, ordering]);

  const proposalBuckets = useMemo(() => {
    const openProposals = allProposals.filter(
      (proposal) => !["won", "lost"].includes(proposal.status),
    );
    const draft = allProposals.filter((proposal) => proposal.status === "draft");
    const sent = allProposals.filter((proposal) => proposal.status === "sent");
    const negotiating = allProposals.filter((proposal) => proposal.status === "negotiating");
    const won = allProposals.filter((proposal) => proposal.status === "won");

    const makeBucket = (proposals: Proposal[]): ProposalBucket => ({
      amount: sumAmount(proposals),
      count: proposals.length,
      proposals,
    });

    return {
      allOpen: makeBucket(openProposals),
      draft: makeBucket(draft),
      sent: makeBucket(sent),
      negotiating: makeBucket(negotiating),
      won: makeBucket(won),
    };
  }, [allProposals]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== "" ||
    clientFilter !== "" ||
    deadlineFrom !== "" ||
    deadlineTo !== "" ||
    ordering !== "deadline";

  const columns = useMemo<DataTableColumn<Proposal>[]>(
    () => [
      {
        key: "proposal",
        header: "Proposal",
        width: "24%",
        cell: (proposal) => (
          <div className="proposal-title-cell">
            <p className="proposal-title-text">{proposal.title}</p>
            <div className="mt-1">
              <span className={getProposalStatusBadgeClassName(proposal.status)}>
                <span className="proposal-status-dot" />
                <span>{proposal.status}</span>
              </span>
            </div>
          </div>
        ),
      },
      {
        key: "client",
        header: "Client",
        width: "24%",
        cell: (proposal) => {
          const clientMeta = getProposalClientMeta(proposal, clientMetaById);

          return (
            <div className="proposal-client-cell">
              <span className="list-avatar list-avatar-sm">{getInitials(clientMeta.name)}</span>
              <div className="min-w-0">
                <p className="proposal-client-name truncate">{clientMeta.name}</p>
                <p className="proposal-client-type truncate">{clientMeta.type}</p>
              </div>
            </div>
          );
        },
      },
      {
        key: "amount",
        header: "Amount",
        width: "14%",
        cell: (proposal) => (
          <span
            className={[
              "proposal-amount",
              proposal.status === "won" ? "proposal-amount-won" : "",
              proposal.status === "lost" ? "proposal-amount-lost" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {formatCurrencyValue(proposal.amount)}
          </span>
        ),
      },
      {
        key: "deadline",
        header: "Deadline",
        width: "18%",
        cell: (proposal) => {
          const deadlineState = getDeadlineState(proposal);
          return (
            <div className="proposal-deadline-cell">
              <span className="proposal-deadline-text">{formatDate(proposal.deadline)}</span>
              <span className={deadlineState.chipClassName}>{deadlineState.label}</span>
            </div>
          );
        },
      },
      {
        key: "sent_date",
        header: "Sent date",
        width: "10%",
        cell: (proposal) => (
          <span className={proposal.sent_date ? "proposal-date-text" : "proposal-client-type"}>
            {formatDate(proposal.sent_date)}
          </span>
        ),
      },
      {
        key: "decision_date",
        header: "Decision date",
        width: "10%",
        cell: (proposal) => (
          <span
            className={proposal.decision_date ? "proposal-date-text" : "proposal-client-type"}
          >
            {formatDate(proposal.decision_date)}
          </span>
        ),
      },
    ],
    [clientMetaById],
  );

  return (
    <section className="space-y-6">
      <ProposalDrawer
        key={`${selectedProposal?.id ?? "new"}-${isDrawerOpen ? "open" : "closed"}`}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedProposal(null);
        }}
        open={isDrawerOpen}
        proposal={selectedProposal}
      />

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="page-eyebrow">Pipeline</p>
          <h1 className="page-title">Proposals</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Track every pitch from draft to decision
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedProposal(null);
            setIsDrawerOpen(true);
          }}
        >
          New Proposal
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <button
          className="proposal-stat-card-button"
          onClick={() => setStatusFilter("")}
          type="button"
        >
          <StatCard
            badge={statusFilter === "" ? "Active" : null}
            color="primary"
            description={`${formatCurrencyValue(proposalBuckets.allOpen.amount)} total`}
            icon={FileText}
            label="All open"
            size="sm"
            value={proposalBuckets.allOpen.count}
          />
        </button>
        <button
          className="proposal-stat-card-button"
          onClick={() => setStatusFilter("draft")}
          type="button"
        >
          <StatCard
            badge={statusFilter === "draft" ? "Active" : null}
            color="neutral"
            description={formatCurrencyValue(proposalBuckets.draft.amount)}
            icon={FileText}
            label="Draft"
            size="sm"
            value={proposalBuckets.draft.count}
          />
        </button>
        <button
          className="proposal-stat-card-button"
          onClick={() => setStatusFilter("sent")}
          type="button"
        >
          <StatCard
            badge={statusFilter === "sent" ? "Active" : null}
            color="ocean"
            description={formatCurrencyValue(proposalBuckets.sent.amount)}
            icon={Send}
            label="Sent"
            size="sm"
            value={proposalBuckets.sent.count}
          />
        </button>
        <button
          className="proposal-stat-card-button"
          onClick={() => setStatusFilter("negotiating")}
          type="button"
        >
          <StatCard
            badge={statusFilter === "negotiating" ? "Active" : null}
            color="sunset"
            description={formatCurrencyValue(proposalBuckets.negotiating.amount)}
            icon={HandCoins}
            label="Negotiating"
            size="sm"
            value={proposalBuckets.negotiating.count}
          />
        </button>
        <button
          className="proposal-stat-card-button"
          onClick={() => setStatusFilter("won")}
          type="button"
        >
          <StatCard
            badge={statusFilter === "won" ? "Active" : null}
            color="forest"
            description={formatCurrencyValue(proposalBuckets.won.amount)}
            icon={Trophy}
            label="Won"
            size="sm"
            value={proposalBuckets.won.count}
          />
        </button>
      </div>

      <DataTable
        columns={columns}
        emptyState={
          proposalsQuery.isError ? (
            <EmptyState
              tone="error"
              title="Proposals could not load"
              description="The request failed. Refresh the page or sign in again."
            />
          ) : (
            <EmptyState
              action={
                hasActiveFilters ? (
                  <Button
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("");
                      setClientFilter("");
                      setDeadlineFrom("");
                      setDeadlineTo("");
                      setOrdering("deadline");
                    }}
                    variant="secondary"
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setSelectedProposal(null);
                      setIsDrawerOpen(true);
                    }}
                  >
                    New Proposal
                  </Button>
                )
              }
              title={hasActiveFilters ? "No proposals match the current filters" : "No proposals yet"}
              description={
                hasActiveFilters
                  ? "Try changing the search term or filter values."
                  : "Create the first proposal from a client relationship."
              }
            />
          )
        }
        enableColumnToggle={false}
        getRowClassName={(proposal) => getDeadlineState(proposal).rowClassName}
        loading={proposalsQuery.isLoading || clientsQuery.isLoading}
        mobileCard={(proposal) => {
          const clientMeta = getProposalClientMeta(proposal, clientMetaById);
          const deadlineState = getDeadlineState(proposal);

          return (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="proposal-title-text">{proposal.title}</p>
                  <p className="proposal-client-type mt-1 truncate">{clientMeta.name}</p>
                </div>
                <span className={getProposalStatusBadgeClassName(proposal.status)}>
                  <span className="proposal-status-dot" />
                  <span>{proposal.status}</span>
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="data-table-mobile-label">Amount</p>
                  <p className="mt-1 proposal-amount">{formatCurrencyValue(proposal.amount)}</p>
                </div>
                <div>
                  <p className="data-table-mobile-label">Deadline</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="proposal-deadline-text">{formatDate(proposal.deadline)}</span>
                    <span className={deadlineState.chipClassName}>{deadlineState.label}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        }}
        onRowClick={(proposal) => {
          navigate(`/proposals/${proposal.id}`);
        }}
        rowKey={(proposal) => proposal.id}
        rows={rows}
        toolbar={
          <div className="proposal-filter-bar">
            <div className="proposal-search-wrap">
              <Search className="h-4 w-4" />
              <input
                className="proposal-search-input"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by title or client..."
                type="search"
                value={search}
              />
            </div>

            <div className="proposal-toolbar-divider max-md:hidden" />

            <div className="proposal-filter-select-wrap">
              <select
                className="proposal-filter-select"
                onChange={(event) => setStatusFilter(event.target.value)}
                value={statusFilter}
              >
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="negotiating">Negotiating</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
              <ChevronDown className="h-3.5 w-3.5" />
            </div>

            <div className="proposal-filter-select-wrap">
              <select
                className="proposal-filter-select"
                onChange={(event) => setClientFilter(event.target.value)}
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

            <div className="proposal-toolbar-divider max-lg:hidden" />

            <div className="proposal-date-group">
              <span className="proposal-date-label">Deadline</span>
              <input
                className="proposal-date-input"
                onChange={(event) => setDeadlineFrom(event.target.value)}
                type="date"
                value={deadlineFrom}
              />
              <span className="proposal-date-sep">-</span>
              <input
                className="proposal-date-input"
                onChange={(event) => setDeadlineTo(event.target.value)}
                type="date"
                value={deadlineTo}
              />
            </div>

            <div className="proposal-toolbar-divider max-lg:hidden" />

            <div className="proposal-sort-wrap">
              <span className="proposal-sort-label">Sort</span>
              <div className="proposal-filter-select-wrap">
                <select
                  className="proposal-filter-select"
                  onChange={(event) =>
                    setOrdering(
                      event.target.value as
                        | "deadline"
                        | "-deadline"
                        | "amount_ghs"
                        | "-amount_ghs",
                    )
                  }
                  value={ordering}
                >
                  <option value="deadline">Deadline ↑</option>
                  <option value="-deadline">Deadline ↓</option>
                  <option value="-amount_ghs">Amount ↓</option>
                  <option value="amount_ghs">Amount ↑</option>
                </select>
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>

            <span className="proposal-filter-count">
              Showing {rows.length} of {allProposals.length} proposals
            </span>
          </div>
        }
        variant="list"
      />
    </section>
  );
}
