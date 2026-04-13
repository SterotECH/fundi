import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  CircleAlert,
  FileText,
  Mail,
  Pencil,
  Send,
  Sparkles,
  Target,
  MailSearch,
  Trophy,
  XCircle,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

import { ApiError } from "@/api/client";
import { getClient, listClientProjects, listClientProposals } from "@/api/clients";
import {
  convertProposalToProject,
  deleteProposal,
  getProposal,
  transitionProposal,
  type ProposalConvertPayload,
} from "@/api/proposals";
import type { Proposal } from "@/api/types";
import { queryClient } from "@/app/queryClient";
import { EmptyState } from "@/components/status/EmptyState";
import { LoadingState } from "@/components/status/LoadingState";
import { Button } from "@/components/ui/Button";
import { ProposalDrawer } from "@/features/proposals/ProposalDrawer";
import { formatCurrencyValue } from "@/utils/currency";

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatShortDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function toNumber(value?: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getRelativeDeadline(deadline: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${deadline}T00:00:00`);
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) {
    return {
      label: `${Math.abs(diffDays)} day(s) overdue`,
      tone: "overdue" as const,
    };
  }

  if (diffDays === 0) {
    return { label: "Due today", tone: "urgent" as const };
  }

  if (diffDays <= 3) {
    return { label: `${diffDays} day(s) left`, tone: "urgent" as const };
  }

  return { label: `${diffDays} day(s) left`, tone: "ok" as const };
}

function getProposalRef(proposal: Proposal) {
  return `PROP-${proposal.id.slice(0, 8).toUpperCase()}`;
}

function getClientInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getStatusTone(status: string) {
  if (status === "won") return "bg-success-light text-success-hover border border-success/30";
  if (status === "lost") return "bg-error-light text-error-hover border border-error/30";
  if (status === "sent") return "bg-info-light text-info-hover border border-info/30";
  if (status === "negotiating")
    return "bg-warning-light text-warning-hover border border-warning/30";
  return "bg-muted-background text-muted-foreground border border-border";
}

function getTimeline(proposal: Proposal) {
  const stages = [
    {
      key: "created",
      label: "Created",
      date: proposal.sent_date ?? proposal.deadline,
      note: "Draft created",
      state: "done",
    },
  ];

  if (proposal.sent_date) {
    stages.push({
      key: "sent",
      label: "Sent",
      date: proposal.sent_date,
      note: "Shared with client",
      state: "done",
    });
  }

  if (proposal.status === "negotiating") {
    stages.push({
      key: "negotiating",
      label: "Negotiating",
      date: proposal.sent_date ?? proposal.deadline,
      note: "Discussion in progress",
      state: "active",
    });
  }

  if (proposal.status === "won" || proposal.status === "lost") {
    stages.push({
      key: "decision",
      label: proposal.status === "won" ? "Won" : "Lost",
      date: proposal.decision_date ?? proposal.deadline,
      note: "Decision recorded",
      state: "done",
    });
  } else {
    stages.push({
      key: "pending",
      label: "Decision pending",
      date: proposal.deadline,
      note: "Won or lost",
      state: "pending",
    });
  }

  return stages;
}

function getTransitionActions(status: string) {
  if (status === "draft") {
    return [
      {
        label: "Mark as Sent",
        nextStatus: "sent",
        icon: <Send className="h-4 w-4" />,
        variant: "secondary" as const,
      },
    ];
  }

  if (status === "sent") {
    return [
      {
        label: "Move to Negotiating",
        nextStatus: "negotiating",
        icon: <MailSearch className="h-4 w-4" />,
        variant: "secondary" as const,
      },
      {
        label: "Mark as Won",
        nextStatus: "won",
        icon: <Trophy className="h-4 w-4" />,
        variant: "success" as const,
      },
      {
        label: "Mark as Lost",
        nextStatus: "lost",
        icon: <XCircle className="h-4 w-4" />,
        variant: "danger" as const,
      },
    ];
  }

  if (status === "negotiating") {
    return [
      {
        label: "Mark as Won",
        nextStatus: "won",
        icon: <Trophy className="h-4 w-4" />,
        variant: "success" as const,
      },
      {
        label: "Mark as Lost",
        nextStatus: "lost",
        icon: <XCircle className="h-4 w-4" />,
        variant: "danger" as const,
      },
    ];
  }

  return [];
}

export function ProposalDetailPage() {
  const navigate = useNavigate();
  const { proposalId = "" } = useParams();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showLostConfirm, setShowLostConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [convertForm, setConvertForm] = useState<ProposalConvertPayload>({
    title: "",
    start_date: new Date().toISOString().slice(0, 10),
    due_date: "",
  });
  const [convertError, setConvertError] = useState("");

  const proposalQuery = useQuery({
    queryKey: ["proposal", proposalId],
    queryFn: () => getProposal(proposalId),
    enabled: Boolean(proposalId),
  });

  const clientQuery = useQuery({
    queryKey: ["proposal", proposalId, "client"],
    queryFn: () => getClient(proposalQuery.data!.client),
    enabled: Boolean(proposalQuery.data?.client),
  });

  const clientProposalsQuery = useQuery({
    queryKey: ["proposal", proposalId, "client-proposals"],
    queryFn: () => listClientProposals(proposalQuery.data!.client),
    enabled: Boolean(proposalQuery.data?.client),
  });
  const clientProjectsQuery = useQuery({
    queryKey: ["proposal", proposalId, "client-projects"],
    queryFn: () => listClientProjects(proposalQuery.data!.client),
    enabled: Boolean(proposalQuery.data?.client),
  });

  const transitionMutation = useMutation({
    mutationFn: (nextStatus: string) => transitionProposal(proposalId, nextStatus),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["proposals"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] });
      await queryClient.invalidateQueries({ queryKey: ["client", updated.client, "proposals"] });
      setShowLostConfirm(false);
    },
  });

  const convertMutation = useMutation({
    mutationFn: (payload: ProposalConvertPayload) => convertProposalToProject(proposalId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate("/projects");
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setConvertError((error.payload?.detail as string) || "Could not convert proposal.");
        return;
      }
      setConvertError("Could not convert proposal.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProposal(proposalId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["proposals"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate("/proposals");
    },
  });

  const proposal = proposalQuery.data;
  const client = clientQuery.data;
  const clientProposals = clientProposalsQuery.data ?? [];
  const clientProjects = clientProjectsQuery.data ?? [];
  const openClientProposals = clientProposals.filter(
    (item) => !["won", "lost"].includes(item.status),
  );
  const convertedProject = clientProjects.find((item) => item.proposal === proposal?.id) ?? null;
  const clientTotalValue = clientProposals.reduce((sum, item) => sum + toNumber(item.amount), 0);

  if (proposalQuery.isLoading) {
    return <LoadingState label="Loading proposal..." />;
  }

  if (proposalQuery.isError || !proposal) {
    return (
      <EmptyState
        tone="error"
        title="Proposal not found"
        description="This proposal does not exist in your organisation."
      />
    );
  }

  const proposalRef = getProposalRef(proposal);
  const deadlineMeta = getRelativeDeadline(proposal.deadline);
  const timeline = getTimeline(proposal);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysOpen =
    proposal.sent_date
      ? Math.max(
          Math.ceil(
            (today.getTime() - new Date(`${proposal.sent_date}T00:00:00`).getTime()) /
              86_400_000,
          ),
          0,
        )
      : 0;

  const askFundiDraft = () => {
    const contact = client?.contact_person || client?.name || proposal.client_name || "the client";
    globalThis.dispatchEvent(
      new CustomEvent("fundi:assistant-open", {
        detail: {
          prompt: `Draft a polite follow-up email to ${contact} for proposal ${proposalRef}.`,
          context: { proposal_id: proposal.id },
          autoSubmit: true,
        },
      }),
    );
  };

  const markLost = () => transitionMutation.mutate("lost");

  const transitionActions = getTransitionActions(proposal.status);

  return (
    <section className="space-y-4 px-1 pb-8">
      <ProposalDrawer
        onClose={() => setIsEditOpen(false)}
        open={isEditOpen}
        proposal={proposal}
      />

      <div className="flex items-center gap-2 text-xs text-text-tertiary">
        <Link className="hover:text-text-primary" to="/proposals">
          Proposals
        </Link>
        <span>/</span>
        <span className="inline-flex items-center gap-1 text-text-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {proposalRef}
        </span>
      </div>

      <header className="rounded-2xl border border-card-border bg-card/85 p-4 backdrop-blur-md sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-text-tertiary">
              <FileText className="h-3.5 w-3.5" />
              {proposalRef}
            </p>
            <h1 className="font-syne text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
              {proposal.title}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary-light text-[10px] font-bold text-primary-dark">
                {getClientInitials(proposal.client_name || client?.name || "CL")}
              </span>
              {proposal.client_name || client?.name || "Client"}
              {client?.contact_person ? <span>· {client.contact_person}</span> : null}
            </p>
          </div>
          <div className="w-full text-left sm:w-auto sm:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-tertiary sm:hidden">
              Status
            </p>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] capitalize ${getStatusTone(proposal.status)}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {proposal.status}
            </span>
            <p className="mt-2 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              {formatCurrencyValue(proposal.amount)}
            </p>
            <p className="text-[11px] text-text-tertiary">Proposal value</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-divider pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
              Sent
            </p>
            <p className="text-sm font-medium text-text-primary">{formatDate(proposal.sent_date)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
              Deadline
            </p>
            <p
              className={`text-sm font-medium ${deadlineMeta.tone === "overdue" ? "text-error-hover" : deadlineMeta.tone === "urgent" ? "text-warning-hover" : "text-success-hover"}`}
            >
              {formatDate(proposal.deadline)} · {deadlineMeta.label}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
              Source
            </p>
            <p className="text-sm font-medium text-text-primary">Client pipeline</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
              Days open
            </p>
            <p className="text-sm font-medium text-text-primary">{daysOpen} day(s)</p>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 max-sm:flex-col">
        {proposal.status === "draft" ? (
        <Button className="max-sm:w-full" leadingIcon={<Pencil className="h-4 w-4" />} onClick={() => setIsEditOpen(true)} variant="secondary">
          Edit
        </Button>
        ) : null}
        {transitionActions.length ? (
                    <div className="flex flex-wrap gap-3 max-sm:w-full max-sm:flex-col">
                      {transitionActions.map((action) => (
                        <Button
                          className="max-sm:w-full"
                          key={action.nextStatus}
                          leadingIcon={action.icon}
                          loading={
                            transitionMutation.isPending &&
                            transitionMutation.variables === action.nextStatus
                          }
                          onClick={() => transitionMutation.mutate(action.nextStatus)}
                          type="button"
                          variant={action.variant}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
        <Button className="max-sm:w-full" leadingIcon={<Mail className="h-4 w-4" />} onClick={askFundiDraft} variant="secondary">
          Draft follow-up
        </Button>
        <Button
          className="sm:ml-auto max-sm:w-full"
          leadingIcon={<Trash2 className="h-4 w-4" />}
          onClick={() => setShowDeleteConfirm(true)}
          variant="danger"
        >
          Delete
        </Button>
      </div>

      {showLostConfirm ? (
        <div className="flex items-center gap-2 rounded-xl border border-error/30 bg-error-light px-4 py-3 text-sm text-error-hover max-sm:flex-col max-sm:items-stretch">
          <CircleAlert className="h-4 w-4 shrink-0" />
          <p className="flex-1 font-medium">
            Mark {proposalRef} as lost? Decision date will be set to today.
          </p>
          <Button className="max-sm:w-full" onClick={markLost} variant="danger">Yes, lost</Button>
          <Button className="max-sm:w-full" onClick={() => setShowLostConfirm(false)} variant="secondary">Cancel</Button>
        </div>
      ) : null}

      {showDeleteConfirm ? (
        <div className="flex items-center gap-2 rounded-xl border border-error/30 bg-error-light px-4 py-3 text-sm text-error-hover max-sm:flex-col max-sm:items-stretch">
          <CircleAlert className="h-4 w-4 shrink-0" />
          <p className="flex-1 font-medium">Permanently delete this proposal?</p>
          <Button className="max-sm:w-full" onClick={() => deleteMutation.mutate()} variant="danger">Delete</Button>
          <Button className="max-sm:w-full" onClick={() => setShowDeleteConfirm(false)} variant="secondary">Cancel</Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-card-border bg-card/85 p-4 backdrop-blur-md sm:p-5">
          <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
            <Target className="h-3.5 w-3.5" />
            Status timeline
          </p>
          <div className="space-y-3 sm:space-y-4">
            {timeline.map((stage) => (
              <div className="flex items-start gap-3" key={stage.key}>
                <span
                  className={`mt-1 inline-flex h-2.5 w-2.5 rounded-full ${
                    stage.state === "done"
                      ? "bg-success"
                      : stage.state === "active"
                        ? "bg-warning"
                        : "bg-muted"
                  }`}
                />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">
                    {stage.label}
                  </p>
                  <p className="text-sm font-medium text-text-primary max-sm:text-[13px]">
                    {formatDate(stage.date)}
                  </p>
                  <p className="text-xs leading-5 text-text-secondary">{stage.note}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-card-border bg-card/85 p-4 backdrop-blur-md sm:p-5">
          <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
            <FileText className="h-3.5 w-3.5" />
            Description
          </p>
          <p className="text-sm leading-7 text-text-secondary max-sm:text-[13px] max-sm:leading-6">
            {proposal.description || "No description provided for this proposal."}
          </p>

          <p className="mt-5 mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
            <Send className="h-3.5 w-3.5" />
            Internal notes
          </p>
          <div className="rounded-r-xl border-l-4 border-primary bg-primary-light/40 px-3 py-3 text-sm leading-7 text-text-secondary max-sm:text-[13px] max-sm:leading-6 sm:px-4">
            {proposal.notes || "No internal notes yet."}
          </div>
        </article>
      </div>

      {proposal.status === "won" && !convertedProject ? (
        <article className="flex flex-wrap items-center gap-4 rounded-2xl border border-success/30 bg-success-light/50 p-4 sm:p-5">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-success-light text-success-hover">
            <Target className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-text-primary">Proposal won - convert to project?</p>
            <p className="text-sm text-text-secondary">
              Creates a project linked to this client with budget {formatCurrencyValue(proposal.amount)}.
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <input
              className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-input-foreground sm:w-auto"
              onChange={(event) =>
                setConvertForm((current) => ({ ...current, start_date: event.target.value }))
              }
              type="date"
              value={convertForm.start_date}
            />
            <input
              className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-input-foreground sm:w-auto"
              onChange={(event) =>
                setConvertForm((current) => ({ ...current, due_date: event.target.value }))
              }
              type="date"
              value={convertForm.due_date}
            />
            <Button
              className="max-sm:w-full"
              onClick={() => {
                if (!convertForm.start_date || !convertForm.due_date) {
                  setConvertError("Start and due date are required.");
                  return;
                }
                setConvertError("");
                convertMutation.mutate({
                  start_date: convertForm.start_date,
                  due_date: convertForm.due_date,
                });
              }}
            >
              Convert to project
            </Button>
          </div>
          {convertError ? <p className="w-full text-xs text-error-hover">{convertError}</p> : null}
        </article>
      ) : null}
      {proposal.status === "won" && convertedProject ? (
        <article className="flex flex-wrap items-center gap-4 rounded-2xl border border-info/30 bg-info-light/50 p-4 sm:p-5">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-info-light text-info-hover">
            <Target className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-text-primary">Already converted to project</p>
            <p className="text-sm text-text-secondary">
              This won proposal is already linked to a project.
            </p>
          </div>
          <Button className="max-sm:w-full" onClick={() => navigate(`/projects/${convertedProject.id}`)} variant="secondary">
            Open converted project
          </Button>
        </article>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-card-border bg-card/85 p-5 backdrop-blur-md">
          <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
            <FileText className="h-3.5 w-3.5" />
            Related client
          </p>

          <div className="flex items-center gap-3 border-b border-divider pb-3 max-sm:flex-wrap">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-light text-xs font-bold text-primary-dark">
              {getClientInitials(proposal.client_name || client?.name || "CL")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text-primary">
                {proposal.client_name || client?.name || "Client"}
              </p>
              <p className="truncate text-xs text-text-tertiary">
                {client?.contact_person || "Primary contact not set"}
              </p>
            </div>
            <Link className="text-xs font-semibold text-primary hover:text-primary-hover" to={`/clients/${proposal.client}`}>
              View <ArrowUpRight className="inline h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-background-secondary px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                Open proposals
              </p>
              <p className="text-xl font-bold text-text-primary">{openClientProposals.length}</p>
            </div>
            <div className="rounded-xl bg-background-secondary px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                Total value
              </p>
              <p className="text-xl font-bold text-text-primary">
                {formatCurrencyValue(clientTotalValue.toFixed(2))}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-card-border bg-card/85 p-5 backdrop-blur-md">
          <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
            <Sparkles className="h-3.5 w-3.5" />
            Activity log
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 border-b border-divider pb-2 text-xs max-sm:flex-wrap">
              <span className="w-24 font-mono text-text-tertiary max-sm:w-full">{formatShortDate(proposal.decision_date || proposal.deadline)}</span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-light text-[10px] font-bold text-primary-dark">SK</span>
              <span className="flex-1 text-text-secondary">Current status: {proposal.status}</span>
              <span className="rounded-full bg-warning-light px-2 py-0.5 text-[10px] font-semibold text-warning-hover max-sm:ml-auto">
                status
              </span>
            </div>
            <div className="flex items-center gap-3 border-b border-divider pb-2 text-xs max-sm:flex-wrap">
              <span className="w-24 font-mono text-text-tertiary max-sm:w-full">{formatShortDate(proposal.sent_date)}</span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-light text-[10px] font-bold text-primary-dark">SK</span>
              <span className="flex-1 text-text-secondary">Proposal sent to client</span>
              <span className="rounded-full bg-info-light px-2 py-0.5 text-[10px] font-semibold text-info-hover max-sm:ml-auto">
                updated
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs max-sm:flex-wrap">
              <span className="w-24 font-mono text-text-tertiary max-sm:w-full">{formatShortDate(proposal.sent_date || proposal.deadline)}</span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-light text-[10px] font-bold text-primary-dark">SK</span>
              <span className="flex-1 text-text-secondary">Proposal created</span>
              <span className="rounded-full bg-muted-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground max-sm:ml-auto">
                created
              </span>
            </div>
          </div>
        </article>
      </div>

      <div className="pt-2">
        <Button leadingIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate("/proposals")} variant="secondary">
          Back to proposals
        </Button>
      </div>
    </section>
  );
}
