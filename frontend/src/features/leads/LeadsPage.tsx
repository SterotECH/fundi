import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listLeads } from "@/api/leads";
import type { Lead } from "@/api/types";
import { EmptyState } from "@/components/status/EmptyState";
import { StatusBadge } from "@/components/status/StatusBadge";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { LeadDrawer } from "@/features/leads/LeadDrawer";

const columns: DataTableColumn<Lead>[] = [
  {
    key: "lead",
    header: "Lead",
    width: "34%",
    cell: (lead) => (
      <div>
        <p className="font-medium text-text-primary">{lead.name}</p>
        <p className="mt-1 text-sm text-text-secondary">{lead.email}</p>
      </div>
    ),
  },
  {
    key: "contact",
    header: "Contact person",
    width: "24%",
    cell: (lead) => (
      <div>
        <p className="text-sm font-medium text-text-primary">{lead.contact_person}</p>
        <p className="mt-1 text-sm text-text-secondary">{lead.phone}</p>
      </div>
    ),
  },
  {
    key: "source",
    header: "Source",
    width: "20%",
    cell: (lead) => <span className="text-sm text-text-secondary">{lead.source}</span>,
  },
  {
    key: "status",
    header: "Status",
    align: "right",
    width: "22%",
    className: "text-right",
    cell: (lead) => <StatusBadge status={lead.status} />,
  },
];

export function LeadsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const hasActiveFilters =
    search.trim().length > 0 || statusFilter !== "" || sourceFilter !== "";
  const filterCount = Number(statusFilter !== "") + Number(sourceFilter !== "");

  const leadsQuery = useQuery({
    queryKey: ["leads", { search, statusFilter, sourceFilter }],
    queryFn: () =>
      listLeads({
        search,
        status: statusFilter,
        source: sourceFilter,
      }),
  });

  const rows = leadsQuery.data ?? [];

  return (
    <section>
      <LeadDrawer
        key={`${selectedLead?.id ?? "new"}-${isDrawerOpen ? "open" : "closed"}`}
        lead={selectedLead}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedLead(null);
        }}
        open={isDrawerOpen}
      />

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="page-eyebrow">
            Pipeline
          </p>
          <h1 className="mt-2 page-title">Leads</h1>
        </div>
        <Button
          onClick={() => {
            setSelectedLead(null);
            setIsDrawerOpen(true);
          }}
        >
          New Lead
        </Button>
      </div>

      <div className="mt-6">
        <DataTable
          columns={columns}
          emptyState={
            leadsQuery.isError ? (
              <EmptyState
                tone="error"
                title="Leads could not load"
                description="The request failed. Refresh the page or sign in again."
              />
            ) : (
              <EmptyState
                title={
                  hasActiveFilters ? "No leads match the current filters" : "No leads yet"
                }
                description={
                  hasActiveFilters
                    ? "Try changing the search term or filter values."
                    : "Create the first lead before converting prospects to clients."
                }
                action={
                  hasActiveFilters ? (
                    <Button
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("");
                        setSourceFilter("");
                      }}
                      variant="secondary"
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setSelectedLead(null);
                        setIsDrawerOpen(true);
                      }}
                    >
                      New Lead
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
                  <option value="">Default pipeline</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="converted">Converted</option>
                  <option value="dead">Dead</option>
                </select>
              </label>
              <label className="block">
                <span className="field-label">Source</span>
                <select
                  className="field-input min-w-48"
                  onChange={(event) => setSourceFilter(event.target.value)}
                  value={sourceFilter}
                >
                  <option value="">All sources</option>
                  <option value="referral">Referral</option>
                  <option value="website">Website</option>
                  <option value="event">Event</option>
                  <option value="cold">Cold</option>
                </select>
              </label>
            </div>
          }
          loading={leadsQuery.isLoading}
          mobileCard={(lead) => (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-text-primary">{lead.name}</p>
                  <p className="mt-1 text-sm text-text-secondary">{lead.email}</p>
                </div>
                <StatusBadge status={lead.status} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="data-table-mobile-label">Contact person</p>
                  <p className="mt-1 text-sm text-text-primary">{lead.contact_person}</p>
                </div>
                <div>
                  <p className="data-table-mobile-label">Phone</p>
                  <p className="mt-1 text-sm text-text-primary">{lead.phone}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="data-table-mobile-label">Source</p>
                  <p className="mt-1 text-sm text-text-primary">{lead.source}</p>
                </div>
              </div>
            </div>
          )}
          onRowClick={(lead) => {
            setSelectedLead(lead);
            setIsDrawerOpen(true);
          }}
          rowKey={(lead) => lead.id}
          rows={rows}
          searchSlot={
            <Input
              className="max-w-lg"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, phone, or contact person"
              value={search}
            />
          }
        />
      </div>
    </section>
  );
}
