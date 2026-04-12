import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  Clock3,
  CreditCard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Receipt,
  UserRound,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

import type { Project, Proposal } from "@/api/types";
import {
  archiveClient,
  getClient,
  listClientProjects,
  listClientProposals,
} from "@/api/clients";
import { cn } from "@/app/cn";
import { queryClient } from "@/app/queryClient";
import { EmptyState } from "@/components/status/EmptyState";
import { LoadingState } from "@/components/status/LoadingState";
import { StatusBadge } from "@/components/status/StatusBadge";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ProposalDrawer } from "@/features/proposals/ProposalDrawer";
import { formatCurrencyValue } from "@/utils/currency";

type ClientTab = "proposals" | "projects" | "invoices" | "payments" | "time";

const tabMeta: Array<{ id: ClientTab; label: string }> = [
  { id: "proposals", label: "Proposals" },
  { id: "projects", label: "Projects" },
  { id: "invoices", label: "Invoices" },
  { id: "payments", label: "Payments" },
  { id: "time", label: "Time" },
];

function SummaryMetric({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-text-tertiary">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold leading-tight text-text-primary">{value}</p>
      {meta ? <p className="mt-1 text-xs text-text-secondary">{meta}</p> : null}
    </div>
  );
}

export function ClientDetailPage() {
  const navigate = useNavigate();
  const { clientId = "" } = useParams();
  const [activeTab, setActiveTab] = useState<ClientTab>("proposals");
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isProposalDrawerOpen, setIsProposalDrawerOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  const clientQuery = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClient(clientId),
    enabled: Boolean(clientId),
  });
  const proposalsQuery = useQuery({
    queryKey: ["client", clientId, "proposals"],
    queryFn: () => listClientProposals(clientId),
    enabled: Boolean(clientId),
  });
  const projectsQuery = useQuery({
    queryKey: ["client", clientId, "projects"],
    queryFn: () => listClientProjects(clientId),
    enabled: Boolean(clientId),
  });
  const archiveMutation = useMutation({
    mutationFn: () => archiveClient(clientId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      navigate("/clients");
    },
  });

  const proposalColumns = useMemo<DataTableColumn<Proposal>[]>(
    () => [
      {
        key: "proposal",
        header: "Proposal",
        width: "42%",
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
        width: "20%",
        cell: (proposal) => (
          <span className="text-sm text-text-primary">
            {formatCurrencyValue(proposal.amount)}
          </span>
        ),
      },
      {
        key: "deadline",
        header: "Deadline",
        width: "20%",
        cell: (proposal) => (
          <span className="text-sm text-text-secondary">{proposal.deadline}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        align: "right",
        width: "18%",
        className: "text-right",
        cell: (proposal) => <StatusBadge status={proposal.status} />,
      },
    ],
    [],
  );

  const projectColumns = useMemo<DataTableColumn<Project>[]>(
    () => [
      {
        key: "project",
        header: "Project",
        width: "46%",
        cell: (project) => (
          <div>
            <p className="font-medium text-text-primary">{project.title}</p>
            <p className="mt-1 text-sm text-text-secondary">{project.client_name}</p>
          </div>
        ),
      },
      {
        key: "budget",
        header: "Budget",
        width: "18%",
        cell: (project) => (
          <span className="text-sm text-text-primary">
            {formatCurrencyValue(project.budget)}
          </span>
        ),
      },
      {
        key: "due_date",
        header: "Due date",
        width: "18%",
        cell: (project) => (
          <span className="text-sm text-text-secondary">{project.due_date}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        align: "right",
        width: "18%",
        className: "text-right",
        cell: (project) => <StatusBadge status={project.status} />,
      },
    ],
    [],
  );

  if (clientQuery.isLoading) {
    return <LoadingState label="Loading client..." />;
  }

  if (clientQuery.isError || !clientQuery.data) {
    return (
      <EmptyState
        tone="error"
        title="Client not found"
        description="This client does not exist in your organisation."
      />
    );
  }

  const client = clientQuery.data;
  const proposals = proposalsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const openProposalCount = proposals.filter(
    (proposal) => !["won", "lost"].includes(proposal.status),
  ).length;
  const activeProjectCount = projects.filter((project) => project.status !== "done").length;

  const tabCounts: Record<ClientTab, number> = {
    proposals: proposals.length,
    projects: projects.length,
    invoices: 0,
    payments: 0,
    time: 0,
  };

  const currentTabLabel =
    tabMeta.find((tab) => tab.id === activeTab)?.label ?? "Proposals";

  const summaryMetrics = [
    { label: "Total Invoiced", value: "—", meta: "Starts in Sprint 2" },
    { label: "Total Collected", value: "—", meta: "Starts in Sprint 2" },
    { label: "Outstanding", value: "—", meta: "Starts in Sprint 2" },
    { label: "Open Proposals", value: String(openProposalCount) },
    { label: "Active Projects", value: String(activeProjectCount) },
    { label: "Total Hours", value: "—", meta: "Starts in Sprint 2" },
  ];

  const handleArchive = () => {
    if (client.is_archived || archiveMutation.isPending) {
      return;
    }
    setIsArchiveDialogOpen(true);
  };

  return (
    <section>
      <ProposalDrawer
        initialClientId={client.id}
        key={`${selectedProposal?.id ?? client.id}-proposal-${isProposalDrawerOpen ? "open" : "closed"}`}
        onClose={() => {
          setIsProposalDrawerOpen(false);
          setSelectedProposal(null);
        }}
        open={isProposalDrawerOpen}
        proposal={selectedProposal}
      />

      <AlertDialog
        confirmLabel="Archive client"
        confirmLoading={archiveMutation.isPending}
        description={`Archive ${client.name}. This keeps the history but removes it from the active client list.`}
        onCancel={() => {
          if (!archiveMutation.isPending) {
            setIsArchiveDialogOpen(false);
          }
        }}
        onConfirm={() => archiveMutation.mutate()}
        open={isArchiveDialogOpen}
        title="Archive client"
        tone="danger"
      />

      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
        to="/clients"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to clients
      </Link>

      <header className="mt-4 rounded-lg border border-border bg-card px-5 py-5 md:px-6">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="page-title">{client.name}</h1>
              <StatusBadge status={client.type} />
              {client.is_archived ? <StatusBadge status="archived" /> : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
                <UserRound className="h-4 w-4 text-icon-active" />
                <span>{client.contact_person}</span>
              </div>
              <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
                <Phone className="h-4 w-4 text-icon-active" />
                <span>{client.phone}</span>
              </div>
              <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
                <Mail className="h-4 w-4 text-icon-active" />
                <span>{client.email}</span>
              </div>
              <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
                <MapPin className="h-4 w-4 text-icon-active" />
                <span>{client.region}</span>
              </div>
            </div>

            {client.notes ? (
              <p className="max-w-3xl text-sm leading-6 text-text-secondary">
                {client.notes}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              leadingIcon={<Pencil className="h-4 w-4" />}
              onClick={() => navigate(`/clients/${client.id}/edit`)}
              variant="secondary"
            >
              Edit
            </Button>
            <Button
              className="text-error-hover"
              leadingIcon={<Archive className="h-4 w-4" />}
              loading={archiveMutation.isPending}
              onClick={handleArchive}
              variant="secondary"
            >
              {client.is_archived ? "Archived" : "Archive"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mt-4 grid gap-3 xl:hidden">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {summaryMetrics.map((metric) => (
            <SummaryMetric
              key={metric.label}
              label={metric.label}
              meta={metric.meta}
              value={metric.value}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-divider pb-1">
            {tabMeta.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "border-primary bg-primary-light text-primary-dark"
                      : "border-transparent bg-background-secondary text-text-secondary hover:border-border hover:bg-card hover:text-text-primary",
                  )}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-semibold",
                      isActive
                        ? "bg-card text-primary-dark"
                        : "bg-card text-text-secondary",
                    )}
                  >
                    {tabCounts[tab.id]}
                  </span>
                </button>
              );
            })}
          </div>

          <section className="space-y-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="page-eyebrow">Relationship View</p>
                <h2 className="mt-2 section-title">{currentTabLabel}</h2>
              </div>
              {activeTab === "proposals" ? (
                <Button
                  onClick={() => {
                    setSelectedProposal(null);
                    setIsProposalDrawerOpen(true);
                  }}
                >
                  New Proposal
                </Button>
              ) : null}
            </div>

            {activeTab === "proposals" ? (
              <DataTable
                columns={proposalColumns}
                emptyState={
                  proposalsQuery.isError ? (
                    <EmptyState
                      tone="error"
                      title="Proposals could not load"
                      description="The request failed. Refresh the page or sign in again."
                    />
                  ) : (
                    <EmptyState
                      title="No proposals yet"
                      description="Create the first proposal to start the client pipeline."
                      action={
                        <Button
                          onClick={() => {
                            setSelectedProposal(null);
                            setIsProposalDrawerOpen(true);
                          }}
                        >
                          New Proposal
                        </Button>
                      }
                    />
                  )
                }
                loading={proposalsQuery.isLoading}
                mobileCard={(proposal) => (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-text-primary">{proposal.title}</p>
                        <p className="mt-1 text-sm text-text-secondary">
                          {formatCurrencyValue(proposal.amount)}
                        </p>
                      </div>
                      <StatusBadge status={proposal.status} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="data-table-mobile-label">Deadline</p>
                        <p className="mt-1 text-sm text-text-primary">{proposal.deadline}</p>
                      </div>
                      <div>
                        <p className="data-table-mobile-label">Decision</p>
                        <p className="mt-1 text-sm text-text-primary">
                          {proposal.decision_date || "Pending"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                onRowClick={(proposal) => {
                  setSelectedProposal(proposal);
                  setIsProposalDrawerOpen(true);
                }}
                rowKey={(proposal) => proposal.id}
                rows={proposals}
              />
            ) : null}

            {activeTab === "projects" ? (
              <DataTable
                columns={projectColumns}
                emptyState={
                  projectsQuery.isError ? (
                    <EmptyState
                      tone="error"
                      title="Projects could not load"
                      description="The request failed. Refresh the page or sign in again."
                    />
                  ) : (
                    <EmptyState
                      title="No projects yet"
                      description="A project appears here after a proposal is converted and delivery starts."
                    />
                  )
                }
                loading={projectsQuery.isLoading}
                mobileCard={(project) => (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-text-primary">{project.title}</p>
                        <p className="mt-1 text-sm text-text-secondary">
                          {formatCurrencyValue(project.budget)}
                        </p>
                      </div>
                      <StatusBadge status={project.status} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="data-table-mobile-label">Start date</p>
                        <p className="mt-1 text-sm text-text-primary">{project.start_date}</p>
                      </div>
                      <div>
                        <p className="data-table-mobile-label">Due date</p>
                        <p className="mt-1 text-sm text-text-primary">{project.due_date}</p>
                      </div>
                    </div>
                  </div>
                )}
                rowKey={(project) => project.id}
                rows={projects}
              />
            ) : null}

            {["invoices", "payments", "time"].includes(activeTab) ? (
              <EmptyState
                title={`${currentTabLabel} start in Sprint 2`}
                description={`This client view already reserves the ${currentTabLabel.toLowerCase()} tab, but the API and records for it are not part of Sprint 1.`}
                icon={
                  activeTab === "invoices"
                    ? Receipt
                    : activeTab === "payments"
                      ? CreditCard
                      : Clock3
                }
              />
            ) : null}
          </section>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-4 rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="page-eyebrow">Summary</p>
                <h2 className="mt-2 section-title">Relationship Snapshot</h2>
              </div>
              <Button
                className="shrink-0"
                onClick={() => {
                  setSelectedProposal(null);
                  setIsProposalDrawerOpen(true);
                }}
                variant="secondary"
              >
                New Proposal
              </Button>
            </div>

            <div className="grid gap-3">
              {summaryMetrics.map((metric) => (
                <SummaryMetric
                  key={metric.label}
                  label={metric.label}
                  meta={metric.meta}
                  value={metric.value}
                />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
