import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";

import { listClients } from "@/api/clients";
import { EmptyState } from "@/components/status/EmptyState";
import { StatusBadge } from "@/components/status/StatusBadge";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import type { Client } from "@/api/types";

const columns: DataTableColumn<Client>[] = [
  {
    key: "name",
    header: "Name",
    width: "28%",
    cell: (client) => (
      <div>
        <p className="font-medium text-text-primary">{client.name}</p>
        <p className="mt-1 text-sm text-text-secondary">{client.email}</p>
      </div>
    ),
  },
  {
    key: "type",
    header: "Type",
    width: "14%",
    cell: (client) => <StatusBadge status={client.type} />,
    mobileLabel: "Client type",
  },
  {
    key: "contact",
    header: "Contact",
    width: "24%",
    cell: (client) => (
      <div>
        <p className="text-sm font-medium text-text-primary">{client.contact_person}</p>
        <p className="mt-1 text-sm text-text-secondary">{client.region}</p>
      </div>
    ),
  },
  {
    key: "phone",
    header: "Phone",
    width: "18%",
    cell: (client) => <span className="text-sm text-text-secondary">{client.phone}</span>,
    hideOnMobile: true,
  },
  {
    key: "status",
    header: "Status",
    align: "right",
    width: "16%",
    className: "text-right",
    cell: (client) => (
      <StatusBadge status={client.is_archived ? "archived" : "active"} />
    ),
  },
];

export function ClientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [archivedFilter, setArchivedFilter] = useState<"false" | "true" | "">("false");
  const [typeFilter, setTypeFilter] = useState("");

  const hasActiveFilters =
    search.trim().length > 0 || archivedFilter !== "false" || typeFilter !== "";
  const filterCount = Number(archivedFilter !== "false") + Number(typeFilter !== "");

  const clientsQuery = useQuery({
    queryKey: ["clients", { search, archivedFilter, typeFilter }],
    queryFn: () =>
      listClients({
        search,
        isArchived: archivedFilter,
        type: typeFilter,
      }),
  });

  return (
    <section>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="page-eyebrow">
            Clients
          </p>
          <h1 className="mt-2 page-title">
            Schools and organisations
          </h1>
        </div>
        <Button onClick={() => navigate("/clients/new")}>New Client</Button>
      </div>

      <div className="mt-6">
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
                      }}
                      variant="secondary"
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
                title={
                  hasActiveFilters ? "No clients match the current filters" : "No clients yet"
                }
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
          getRowHref={(client) => `/clients/${client.id}`}
          filterCount={filterCount}
          filterContent={
            <div className="grid gap-3">
              <label className="block">
                <span className="field-label">Status</span>
                <select
                  className="field-input min-w-48"
                  onChange={(event) =>
                    setArchivedFilter(event.target.value as "false" | "true" | "")
                  }
                  value={archivedFilter}
                >
                  <option value="false">Active</option>
                  <option value="true">Archived</option>
                </select>
              </label>
              <label className="block">
                <span className="field-label">Type</span>
                <select
                  className="field-input min-w-48"
                  onChange={(event) => setTypeFilter(event.target.value)}
                  value={typeFilter}
                >
                  <option value="">All types</option>
                  <option value="shs">SHS</option>
                  <option value="jhs">JHS</option>
                  <option value="intl">International</option>
                  <option value="uni">University</option>
                </select>
              </label>
            </div>
          }
          loading={clientsQuery.isLoading}
          mobileCard={(client) => (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-text-primary">{client.name}</p>
                  <p className="mt-1 text-sm text-text-secondary">{client.email}</p>
                </div>
                <StatusBadge status={client.is_archived ? "archived" : "active"} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="data-table-mobile-label">Contact</p>
                  <p className="mt-1 text-sm text-text-primary">{client.contact_person}</p>
                </div>
                <div>
                  <p className="data-table-mobile-label">Phone</p>
                  <p className="mt-1 text-sm text-text-primary">{client.phone}</p>
                </div>
                <div>
                  <p className="data-table-mobile-label">Type</p>
                  <div className="mt-1">
                    <StatusBadge status={client.type} />
                  </div>
                </div>
                <div>
                  <p className="data-table-mobile-label">Region</p>
                  <p className="mt-1 text-sm text-text-primary">{client.region}</p>
                </div>
              </div>
            </div>
          )}
          rowKey={(client) => client.id}
          rows={clientsQuery.data ?? []}
          searchSlot={
            <Input
              className="max-w-lg"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, or contact person"
              value={search}
            />
          }
        />
      </div>
    </section>
  );
}
