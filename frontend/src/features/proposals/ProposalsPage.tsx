import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listProposals } from "@/api/proposals";
import type { Proposal } from "@/api/types";
import { EmptyState } from "@/components/status/EmptyState";
import { StatusBadge } from "@/components/status/StatusBadge";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { ProposalDrawer } from "@/features/proposals/ProposalDrawer";
import { formatCurrencyValue } from "@/utils/currency";

const columns: DataTableColumn<Proposal>[] = [
  {
    key: "proposal",
    header: "Proposal",
    width: "38%",
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
    width: "18%",
    cell: (proposal) => (
      <span className="text-sm text-text-primary">
        {formatCurrencyValue(proposal.amount)}
      </span>
    ),
  },
  {
    key: "deadline",
    header: "Deadline",
    width: "22%",
    cell: (proposal) => (
      <span className="text-sm text-text-secondary">Due {proposal.deadline}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    align: "right",
    width: "22%",
    className: "text-right",
    cell: (proposal) => <StatusBadge status={proposal.status} />,
  },
];

export function ProposalsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ordering, setOrdering] = useState<"deadline" | "-deadline" | "">("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  const hasActiveFilters =
    search.trim().length > 0 || statusFilter !== "" || ordering !== "";
  const filterCount = Number(statusFilter !== "") + Number(ordering !== "");

  const proposalsQuery = useQuery({
    queryKey: ["proposals", { search, statusFilter, ordering }],
    queryFn: () =>
      listProposals({
        search,
        status: statusFilter,
        ordering,
      }),
  });

  const rows = proposalsQuery.data ?? [];

  return (
    <section>
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
          <p className="page-eyebrow">
            Pipeline
          </p>
          <h1 className="mt-2 page-title">Proposals</h1>
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

      <div className="mt-6">
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
                title={
                  hasActiveFilters
                    ? "No proposals match the current filters"
                    : "No proposals yet"
                }
                description={
                  hasActiveFilters
                    ? "Try changing the search term or filter values."
                    : "Create the first proposal from a client relationship."
                }
                action={
                  hasActiveFilters ? (
                    <Button
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("");
                        setOrdering("");
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
              />
            )
          }
          filterCount={filterCount}
          filterContent={
            <div className="grid gap-3">
              <label className="block">
                <span className="field-label">Status</span>
                <select
                  className="field-input min-w-48"
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
              </label>
              <label className="block">
                <span className="field-label">Order</span>
                <select
                  className="field-input min-w-48"
                  onChange={(event) =>
                    setOrdering(event.target.value as "deadline" | "-deadline" | "")
                  }
                  value={ordering}
                >
                  <option value="">Default</option>
                  <option value="deadline">Deadline ascending</option>
                  <option value="-deadline">Deadline descending</option>
                </select>
              </label>
            </div>
          }
          loading={proposalsQuery.isLoading}
          mobileCard={(proposal) => (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-text-primary">{proposal.title}</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {proposal.client_name || proposal.client}
                  </p>
                </div>
                <StatusBadge status={proposal.status} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="data-table-mobile-label">Amount</p>
                  <p className="mt-1 text-sm text-text-primary">
                    {formatCurrencyValue(proposal.amount)}
                  </p>
                </div>
                <div>
                  <p className="data-table-mobile-label">Deadline</p>
                  <p className="mt-1 text-sm text-text-primary">{proposal.deadline}</p>
                </div>
              </div>
            </div>
          )}
          onRowClick={(proposal) => {
            setSelectedProposal(proposal);
            setIsDrawerOpen(true);
          }}
          rowKey={(proposal) => proposal.id}
          rows={rows}
          searchSlot={
            <Input
              className="max-w-lg"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search proposal title, description, or client"
              value={search}
            />
          }
        />
      </div>
    </section>
  );
}
