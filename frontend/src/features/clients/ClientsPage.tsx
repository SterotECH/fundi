import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  ChevronDown,
  ReceiptText,
  Search,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router";

import { listClients } from "@/api/clients";
import { listInvoices } from "@/api/invoices";
import { listProjects } from "@/api/projects";
import { listProposals } from "@/api/proposals";
import type { Client } from "@/api/types";
import { EmptyState } from "@/components/status/EmptyState";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { FilterPill } from "@/components/ui/FilterPill";
import { StatCard } from "@/components/ui/StatCard";
import { formatCurrencyValue } from "@/utils/currency";

const CLIENT_TYPE_LABELS: Record<string, string> = {
  intl: "International",
  jhs: "JHS",
  shs: "SHS",
  uni: "University",
};

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getClientTypeLabel(value: string) {
  return CLIENT_TYPE_LABELS[value] ?? value.replaceAll("_", " ");
}

function getClientTypeClassName(value: string) {
  if (value === "shs") return "client-type-chip client-type-chip-shs";
  if (value === "jhs") return "client-type-chip client-type-chip-jhs";
  if (value === "intl") return "client-type-chip client-type-chip-intl";
  if (value === "uni") return "client-type-chip client-type-chip-uni";
  return "client-type-chip client-type-chip-shs";
}

function getOutstandingToneClassName(amount: number) {
  if (amount <= 0) return "client-outstanding client-outstanding-clear";
  if (amount >= 10000) return "client-outstanding client-outstanding-bad";
  return "client-outstanding client-outstanding-warn";
}

function getOutstandingLabel(amount: number) {
  if (amount <= 0) {
    return "Paid up";
  }

  return formatCurrencyValue(amount);
}

type ClientMetrics = {
  activeProjects: number;
  openProposals: number;
  outstanding: number;
};

export function ClientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [archivedFilter, setArchivedFilter] = useState<"false" | "true">("false");
  const [typeFilter, setTypeFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");

  const clientsQuery = useQuery({
    queryKey: ["clients", { search, archivedFilter, typeFilter }],
    queryFn: () =>
      listClients({
        search,
        isArchived: archivedFilter,
        type: typeFilter,
      }),
  });

  const proposalsQuery = useQuery({
    queryKey: ["client-list-proposals"],
    queryFn: () => listProposals(),
  });

  const invoicesQuery = useQuery({
    queryKey: ["client-list-invoices"],
    queryFn: () => listInvoices(),
  });

  const projectsQuery = useQuery({
    queryKey: ["client-list-projects"],
    queryFn: () => listProjects(),
  });

  const clientMetrics = useMemo(() => {
    const metrics = new Map<string, ClientMetrics>();

    for (const proposal of proposalsQuery.data ?? []) {
      const current = metrics.get(proposal.client) ?? {
        activeProjects: 0,
        openProposals: 0,
        outstanding: 0,
      };
      if (!["won", "lost"].includes(proposal.status)) {
        current.openProposals += 1;
      }
      metrics.set(proposal.client, current);
    }

    for (const invoice of invoicesQuery.data ?? []) {
      const current = metrics.get(invoice.client) ?? {
        activeProjects: 0,
        openProposals: 0,
        outstanding: 0,
      };
      current.outstanding += Number.parseFloat(invoice.amount_remaining || "0");
      metrics.set(invoice.client, current);
    }

    for (const project of projectsQuery.data ?? []) {
      const current = metrics.get(project.client) ?? {
        activeProjects: 0,
        openProposals: 0,
        outstanding: 0,
      };
      if (project.status !== "done") {
        current.activeProjects += 1;
      }
      metrics.set(project.client, current);
    }

    return metrics;
  }, [invoicesQuery.data, projectsQuery.data, proposalsQuery.data]);

  const rows = useMemo(() => {
    const clients = clientsQuery.data ?? [];

    if (!regionFilter) {
      return clients;
    }

    return clients.filter((client) => client.region === regionFilter);
  }, [clientsQuery.data, regionFilter]);

  const regions = useMemo(
    () =>
      [...new Set((clientsQuery.data ?? []).map((client) => client.region))]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [clientsQuery.data],
  );

  const stats = useMemo(() => {
    const allClients = clientsQuery.data ?? [];
    const visibleClients = rows;
    const invoices = invoicesQuery.data ?? [];
    const projects = projectsQuery.data ?? [];
    const proposals = proposalsQuery.data ?? [];

    const unpaidInvoices = invoices.filter(
      (invoice) => Number.parseFloat(invoice.amount_remaining || "0") > 0,
    ).length;

    const openPipelineAmount = proposals
      .filter((proposal) => !["won", "lost"].includes(proposal.status))
      .reduce((total, proposal) => total + Number.parseFloat(proposal.amount || "0"), 0);

    const activeProjects = projects.filter((project) => project.status !== "done");
    const activeProjectClients = new Set(activeProjects.map((project) => project.client)).size;

    return {
      totalClients: allClients.length,
      activeClients: allClients.filter((client) => !client.is_archived).length,
      outstandingAmount: visibleClients.reduce((total, client) => {
        const metric = clientMetrics.get(client.id);
        return total + (metric?.outstanding ?? 0);
      }, 0),
      unpaidInvoices,
      openProposals: visibleClients.reduce((total, client) => {
        const metric = clientMetrics.get(client.id);
        return total + (metric?.openProposals ?? 0);
      }, 0),
      openPipelineAmount,
      activeProjects: activeProjects.length,
      activeProjectClients,
    };
  }, [clientMetrics, clientsQuery.data, invoicesQuery.data, projectsQuery.data, proposalsQuery.data, rows]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    archivedFilter !== "false" ||
    typeFilter !== "" ||
    regionFilter !== "";

  const columns: DataTableColumn<Client>[] = [
    {
      key: "client",
      header: "Client",
      width: "31%",
      cell: (client) => (
        <div className="client-name-cell">
          <span className="list-avatar">{getInitials(client.name)}</span>
          <div className="min-w-0">
            <p className="client-name-text truncate">{client.name}</p>
            <div className="mt-1">
              <span className={getClientTypeClassName(client.type)}>
                {getClientTypeLabel(client.type)}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact person",
      width: "18%",
      cell: (client) => <span className="client-contact-text">{client.contact_person}</span>,
    },
    {
      key: "phone",
      header: "Phone",
      width: "14%",
      cell: (client) => <span className="client-phone-text">{client.phone}</span>,
      hideOnMobile: true,
    },
    {
      key: "region",
      header: "Region",
      width: "13%",
      cell: (client) => <span className="client-region-pill">{client.region}</span>,
    },
    {
      key: "open_proposals",
      header: "Open proposals",
      width: "12%",
      cell: (client) => {
        const count = clientMetrics.get(client.id)?.openProposals ?? 0;
        return (
          <span
            className={[
              "client-proposal-count",
              count === 0 ? "client-proposal-count-none" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <ReceiptText className="h-3.5 w-3.5" />
            {count > 0 ? `${count} open` : "—"}
          </span>
        );
      },
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      width: "12%",
      className: "text-right",
      cell: (client) => {
        const outstanding = clientMetrics.get(client.id)?.outstanding ?? 0;
        return (
          <span className={getOutstandingToneClassName(outstanding)}>
            {getOutstandingLabel(outstanding)}
          </span>
        );
      },
    },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="page-eyebrow">Clients</p>
          <h1 className="page-title">Clients</h1>
          <p className="mt-2 text-sm text-text-secondary">
            All schools and institutions you work with
          </p>
        </div>
        <Button onClick={() => navigate("/clients/new")}>New Client</Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          color="primary"
          description={`${stats.activeClients} active`}
          icon={Users}
          label="Total clients"
          size="sm"
          value={stats.totalClients}
        />
        <StatCard
          color="flamingo"
          description={`${stats.unpaidInvoices} invoices unpaid`}
          icon={ReceiptText}
          label="Outstanding"
          size="sm"
          value={formatCurrencyValue(stats.outstandingAmount)}
        />
        <StatCard
          color="sunset"
          description={`${formatCurrencyValue(stats.openPipelineAmount)} pipeline`}
          icon={BriefcaseBusiness}
          label="Open proposals"
          size="sm"
          value={stats.openProposals}
        />
        <StatCard
          color="forest"
          description={`Across ${stats.activeProjectClients} clients`}
          icon={BriefcaseBusiness}
          label="Active projects"
          size="sm"
          value={stats.activeProjects}
        />
      </div>

      <DataTable
        columns={columns}
        emptyState={
          clientsQuery.isError ? (
            <EmptyState
              tone="error"
              title="Clients could not load"
              description="The request failed. Refresh the page or sign in again."
            />
          ) : (
            <EmptyState
              action={
                hasActiveFilters ? (
                  <Button
                    onClick={() => {
                      setSearch("");
                      setArchivedFilter("false");
                      setTypeFilter("");
                      setRegionFilter("");
                    }}
                    variant="secondary"
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
              title={hasActiveFilters ? "No clients match the current filters" : "No clients yet"}
              description={
                hasActiveFilters
                  ? "Try changing the search term or filter values."
                  : "Create the first client before adding proposals."
              }
              actionLabel={hasActiveFilters ? undefined : "New Client"}
              actionHref={hasActiveFilters ? undefined : "/clients/new"}
            />
          )
        }
        enableColumnToggle={false}
        getRowHref={(client) => `/clients/${client.id}`}
        getRowClassName={(client) => {
          const metric = clientMetrics.get(client.id);
          return [
            client.is_archived ? "list-row-archived" : "",
            (metric?.outstanding ?? 0) > 0 ? "list-row-balance" : "",
          ]
            .filter(Boolean)
            .join(" ");
        }}
        loading={
          clientsQuery.isLoading ||
          proposalsQuery.isLoading ||
          invoicesQuery.isLoading ||
          projectsQuery.isLoading
        }
        mobileCard={(client) => {
          const metrics = clientMetrics.get(client.id) ?? {
            activeProjects: 0,
            openProposals: 0,
            outstanding: 0,
          };
          return (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="client-name-cell">
                  <span className="list-avatar">{getInitials(client.name)}</span>
                  <div className="min-w-0">
                    <p className="client-name-text">{client.name}</p>
                    <p className="client-contact-text">{client.contact_person}</p>
                  </div>
                </div>
                <span className={getOutstandingToneClassName(metrics.outstanding)}>
                  {getOutstandingLabel(metrics.outstanding)}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="data-table-mobile-label">Phone</p>
                  <p className="mt-1 client-contact-text">{client.phone}</p>
                </div>
                <div>
                  <p className="data-table-mobile-label">Region</p>
                  <div className="mt-1">
                    <span className="client-region-pill">{client.region}</span>
                  </div>
                </div>
                <div>
                  <p className="data-table-mobile-label">Type</p>
                  <div className="mt-1">
                    <span className={getClientTypeClassName(client.type)}>
                      {getClientTypeLabel(client.type)}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="data-table-mobile-label">Open proposals</p>
                  <p className="mt-1 client-contact-text">
                    {metrics.openProposals > 0 ? `${metrics.openProposals} open` : "—"}
                  </p>
                </div>
              </div>
            </div>
          );
        }}
        rowKey={(client) => client.id}
        rows={rows}
        toolbar={
          <div className="client-filter-bar">
            <div className="client-search-wrap">
              <Search className="h-4 w-4" />
              <input
                className="client-search-input"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name..."
                type="search"
                value={search}
              />
            </div>

            <div className="client-toolbar-divider max-md:hidden" />

            <div className="client-filter-select-wrap">
              <select
                className="client-filter-select"
                onChange={(event) => setTypeFilter(event.target.value)}
                value={typeFilter}
              >
                <option value="">All types</option>
                <option value="shs">Senior High (SHS)</option>
                <option value="jhs">Junior High (JHS)</option>
                <option value="intl">International</option>
                <option value="uni">University</option>
              </select>
              <ChevronDown className="h-3.5 w-3.5" />
            </div>

            <div className="client-filter-select-wrap">
              <select
                className="client-filter-select"
                onChange={(event) => setRegionFilter(event.target.value)}
                value={regionFilter}
              >
                <option value="">All regions</option>
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5" />
            </div>

            <div className="client-toolbar-divider max-md:hidden" />

            <div className="client-archive-toggle">
              <FilterPill
                active={archivedFilter === "false"}
                activeClassName="client-archive-button-active"
                className="client-archive-button"
                onClick={() => setArchivedFilter("false")}
              >
                Active
              </FilterPill>
              <FilterPill
                active={archivedFilter === "true"}
                activeClassName="client-archive-button-active"
                className="client-archive-button"
                onClick={() => setArchivedFilter("true")}
              >
                Archived
              </FilterPill>
            </div>

            <span className="client-filter-count">
              Showing {rows.length} of {clientsQuery.data?.length ?? 0} clients
            </span>
          </div>
        }
        variant="list"
      />
    </section>
  );
}
