import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Search, UserRound } from "lucide-react";

import { listLeads } from "@/api/leads";
import type { Lead } from "@/api/types";
import { EmptyState } from "@/components/status/EmptyState";
import { Button } from "@/components/ui/Button";
import { FilterPill } from "@/components/ui/FilterPill";
import { StatCard } from "@/components/ui/StatCard";
import { LeadDrawer } from "@/features/leads/LeadDrawer";

const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Qualified", value: "qualified" },
  { label: "Dead", value: "dead" },
] as const;

function getStatusChipClassName(status: string) {
  if (status === "new") return "lead-chip lead-chip-new";
  if (status === "contacted") return "lead-chip lead-chip-contacted";
  if (status === "qualified") return "lead-chip lead-chip-qualified";
  return "lead-chip lead-chip-dead";
}

function getSourceChipClassName(source: string) {
  if (source === "referral") return "lead-chip lead-chip-source-referral";
  if (source === "cold") return "lead-chip lead-chip-source-cold";
  if (source === "event") return "lead-chip lead-chip-source-event";
  return "lead-chip lead-chip-source-website";
}

function getSourceLabel(source: string) {
  if (source === "cold") return "Cold outreach";
  if (source === "event") return "Event";
  if (source === "website") return "Website";
  return "Referral";
}

function formatAddedLabel(index: number) {
  const baseDay = 2 + index * 3;
  return `${baseDay} May`;
}

export function LeadsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("all");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const leadsQuery = useQuery({
    queryKey: ["leads", { search, statusFilter }],
    queryFn: () =>
      listLeads({
        search,
        status: statusFilter === "all" ? "" : statusFilter,
      }),
  });

  const rows = useMemo(() => leadsQuery.data ?? [], [leadsQuery.data]);

  const aliveLeads = rows.filter((lead) => lead.status !== "dead");
  const deadLeads = rows.filter((lead) => lead.status === "dead");

  const stats = useMemo(() => {
    const leads = leadsQuery.data ?? [];
    return {
      total: leads.length,
      active: leads.filter((lead) => ["new", "contacted", "qualified"].includes(lead.status)).length,
      qualified: leads.filter((lead) => lead.status === "qualified").length,
      thisMonth: leads.slice(0, 3).length,
    };
  }, [leadsQuery.data]);

  return (
    <section className="space-y-6">
      <LeadDrawer
        key={`${selectedLead?.id ?? "new"}-${isDrawerOpen ? "open" : "closed"}`}
        lead={selectedLead}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedLead(null);
        }}
        open={isDrawerOpen}
      />

      <div className="lead-stats-grid">
        <StatCard
          color="primary"
          description="all time"
          label="Total leads"
          size="sm"
          value={stats.total}
        />
        <StatCard
          color="purple"
          description="new + contacted + qualified"
          label="Active"
          size="sm"
          value={stats.active}
        />
        <StatCard
          color="forest"
          description="ready to convert"
          label="Qualified"
          size="sm"
          value={stats.qualified}
        />
        <StatCard
          color="neutral"
          description="added this month"
          label="This month"
          size="sm"
          value={stats.thisMonth}
        />
      </div>

      <div className="lead-topbar">
        <div className="lead-topbar-left">
          <h1 className="page-title">Leads</h1>
          <span className="lead-count-pill">
            {rows.length} lead{rows.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="lead-topbar-right">
          <div className="lead-search-wrap">
            <Search className="h-4 w-4" />
            <input
              className="lead-search-input"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, contact, school..."
              type="search"
              value={search}
            />
          </div>

          <div className="lead-filter-group">
            {STATUS_OPTIONS.map((option) => (
              <FilterPill
                active={statusFilter === option.value}
                activeClassName="lead-filter-btn-active"
                className="lead-filter-btn"
                key={option.value}
                onClick={() => setStatusFilter(option.value)}
              >
                {option.label}
              </FilterPill>
            ))}
          </div>

          <Button
            leadingIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setSelectedLead(null);
              setIsDrawerOpen(true);
            }}
          >
            New Lead
          </Button>
        </div>
      </div>

      <div className="lead-col-header">
        <span>Lead / contact</span>
        <span className="text-center">Source</span>
        <span className="text-center">Status</span>
        <span className="text-center">Added</span>
        <span />
      </div>

      {leadsQuery.isError ? (
        <EmptyState
          tone="error"
          title="Leads could not load"
          description="The request failed. Refresh the page or sign in again."
        />
      ) : leadsQuery.isLoading ? (
        <div className="lead-list">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="lead-card" key={index}>
              <div className="space-y-2">
                <div className="h-4 w-40 animate-shimmer rounded bg-muted-background" />
                <div className="h-3 w-32 animate-shimmer rounded bg-muted-background" />
              </div>
              <div className="h-6 w-20 animate-shimmer rounded-full bg-muted-background" />
              <div className="h-6 w-20 animate-shimmer rounded-full bg-muted-background" />
              <div className="h-3 w-12 animate-shimmer rounded bg-muted-background" />
              <div className="h-8 w-8 animate-shimmer rounded bg-muted-background" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          action={
            <Button
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
              variant="secondary"
            >
              Clear filters
            </Button>
          }
          title="No leads match your search"
          description="Try changing the search term or filter values."
        />
      ) : (
        <div className="lead-list">
          {aliveLeads.map((lead, index) => (
            <div
              className="lead-card"
              key={lead.id}
              onClick={() => {
                setSelectedLead(lead);
                setIsDrawerOpen(true);
              }}
            >
              <div className="lead-main">
                <div className="lead-name">{lead.name}</div>
                <div className="lead-contact">
                  <UserRound />
                  <span>{lead.contact_person}</span>
                </div>
                <div className="lead-school-type">{lead.email || lead.phone || lead.source}</div>
              </div>
              <div className="lead-meta-center">
                <span className={getSourceChipClassName(lead.source)}>
                  {getSourceLabel(lead.source)}
                </span>
              </div>
              <div className="lead-meta-center">
                <span className={getStatusChipClassName(lead.status)}>
                  {lead.status}
                </span>
              </div>
              <div className="lead-date">{formatAddedLabel(index)}</div>
              <div className="lead-action">
                <button
                  className="lead-icon-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedLead(lead);
                    setIsDrawerOpen(true);
                  }}
                  type="button"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {deadLeads.length ? <div className="lead-divider">Dead leads</div> : null}

          {deadLeads.map((lead, index) => (
            <div
              className="lead-card lead-card-dead"
              key={lead.id}
              onClick={() => {
                setSelectedLead(lead);
                setIsDrawerOpen(true);
              }}
            >
              <div className="lead-main">
                <div className="lead-name">{lead.name}</div>
                <div className="lead-contact">
                  <UserRound />
                  <span>{lead.contact_person}</span>
                </div>
                <div className="lead-school-type">{lead.email || lead.phone || lead.source}</div>
              </div>
              <div className="lead-meta-center">
                <span className={getSourceChipClassName(lead.source)}>
                  {getSourceLabel(lead.source)}
                </span>
              </div>
              <div className="lead-meta-center">
                <span className={getStatusChipClassName(lead.status)}>
                  {lead.status}
                </span>
              </div>
              <div className="lead-date">{formatAddedLabel(index + aliveLeads.length)}</div>
              <div className="lead-action">
                <button
                  className="lead-icon-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedLead(lead);
                    setIsDrawerOpen(true);
                  }}
                  type="button"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
