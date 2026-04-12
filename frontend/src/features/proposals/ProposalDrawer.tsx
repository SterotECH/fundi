import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  FileText,
  MailSearch,
  Send,
  Trophy,
  XCircle,
} from "lucide-react";

import { ApiError } from "@/api/client";
import { listClients } from "@/api/clients";
import {
  convertProposalToProject,
  createProposal,
  type ProposalConvertPayload,
  transitionProposal,
  updateProposal,
} from "@/api/proposals";
import type { Proposal } from "@/api/types";
import { cn } from "@/app/cn";
import { queryClient } from "@/app/queryClient";
import { StatusBadge } from "@/components/status/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import {
  createProposalFormState,
  createProposalSchema,
  mapProposalApiErrors,
  normalizeProposalPayload,
  proposalStatusOptions,
  type ProposalFormValues,
} from "@/features/proposals/proposalFormConfig";
import { formatCurrencyValue } from "@/utils/currency";

type ProposalDrawerProps = {
  open: boolean;
  proposal?: Proposal | null;
  initialClientId?: string;
  onClose: () => void;
};

type ConvertErrors = {
  start_date?: string;
  due_date?: string;
  detail?: string;
};

const emptyConvertState: ProposalConvertPayload = {
  title: "",
  start_date: "",
  due_date: "",
};

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

export function ProposalDrawer({
  open,
  proposal,
  initialClientId,
  onClose,
}: Readonly<ProposalDrawerProps>) {
  const mode = proposal ? "edit" : "create";
  const schema = useMemo(() => createProposalSchema(mode), [mode]);
  const [currentProposal, setCurrentProposal] = useState<Proposal | null>(proposal ?? null);
  const [serverError, setServerError] = useState("");
  const [convertForm, setConvertForm] = useState<ProposalConvertPayload>(
    proposal
      ? {
          title: proposal.title,
          start_date: new Date().toISOString().slice(0, 10),
          due_date: "",
        }
      : emptyConvertState,
  );
  const [convertErrors, setConvertErrors] = useState<ConvertErrors>({});

  const {
    clearErrors,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
    setValue,
    control,
  } = useForm<ProposalFormValues>({
    resolver: zodResolver(schema),
    defaultValues: createProposalFormState(proposal ?? null, initialClientId),
  });

  const formValues = useWatch({ control });

  const clientsQuery = useQuery({
    queryKey: ["proposal-clients"],
    queryFn: () =>
      listClients({
        isArchived: "false",
      }),
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: ProposalFormValues) => {
      const normalizedPayload = normalizeProposalPayload(payload);

      if (mode === "create" && !currentProposal) {
        return createProposal(normalizedPayload);
      }

      return updateProposal(currentProposal!.id, normalizedPayload);
    },
    onSuccess: async (savedProposal) => {
      await queryClient.invalidateQueries({ queryKey: ["proposals"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({
        queryKey: ["client", savedProposal.client, "proposals"],
      });

      if (currentProposal && currentProposal.client !== savedProposal.client) {
        await queryClient.invalidateQueries({
          queryKey: ["client", currentProposal.client, "proposals"],
        });
      }

      setCurrentProposal(savedProposal);
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const apiErrors = mapProposalApiErrors(error.payload);

        if (apiErrors.client_id) {
          setError("client_id", { message: apiErrors.client_id });
        }
        if (apiErrors.title) {
          setError("title", { message: apiErrors.title });
        }
        if (apiErrors.description) {
          setError("description", { message: apiErrors.description });
        }
        if (apiErrors.deadline) {
          setError("deadline", { message: apiErrors.deadline });
        }
        if (apiErrors.amount) {
          setError("amount", { message: apiErrors.amount });
        }
        if (apiErrors.notes) {
          setError("notes", { message: apiErrors.notes });
        }

        setServerError(apiErrors.detail ?? "The proposal could not be saved.");
        return;
      }

      setServerError("The proposal could not be saved.");
    },
  });

  const transitionMutation = useMutation({
    mutationFn: (nextStatus: string) => transitionProposal(currentProposal!.id, nextStatus),
    onSuccess: async (nextProposal) => {
      await queryClient.invalidateQueries({ queryKey: ["proposals"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({
        queryKey: ["client", nextProposal.client, "proposals"],
      });
      setCurrentProposal(nextProposal);
      setServerError("");
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const apiErrors = mapProposalApiErrors(error.payload);
        setServerError(apiErrors.detail ?? "The proposal status could not be updated.");
        return;
      }

      setServerError("The proposal status could not be updated.");
    },
  });

  const convertMutation = useMutation({
    mutationFn: (payload: ProposalConvertPayload) =>
      convertProposalToProject(currentProposal!.id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({
        queryKey: ["client", currentProposal?.client, "projects"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["client", currentProposal?.client, "proposals"],
      });
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const apiErrors = mapProposalApiErrors(error.payload);
        setConvertErrors({
          start_date: apiErrors.start_date,
          due_date: apiErrors.due_date,
          detail: apiErrors.detail ?? "The project could not be created.",
        });
        return;
      }

      setConvertErrors({ detail: "The project could not be created." });
    },
  });

  const availableClients = clientsQuery.data ?? [];
  const selectedClient = availableClients.find(
    (client) => client.id === formValues.client_id,
  );
  const status = currentProposal?.status ?? "draft";
  const transitionActions = getTransitionActions(status);
  const isBusy =
    saveMutation.isPending ||
    isSubmitting ||
    transitionMutation.isPending ||
    convertMutation.isPending;
  const currentStatusLabel =
    proposalStatusOptions.find((option) => option.value === status)?.label ?? status;

  const handleClientChange = (value: string) => {
    setServerError("");
    clearErrors("client_id");
    setValue("client_id", value, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleConvert = () => {
    const nextErrors: ConvertErrors = {};

    if (!convertForm.start_date) {
      nextErrors.start_date = "Start date is required.";
    }

    if (!convertForm.due_date) {
      nextErrors.due_date = "Due date is required.";
    } else if (
      convertForm.start_date &&
      convertForm.due_date < convertForm.start_date
    ) {
      nextErrors.due_date = "Due date cannot be before start date.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setConvertErrors(nextErrors);
      return;
    }

    setConvertErrors({});
    convertMutation.mutate({
      title: convertForm.title?.trim() || undefined,
      start_date: convertForm.start_date,
      due_date: convertForm.due_date,
    });
  };

  return (
    <Sheet
      description={
        mode === "create"
          ? "Keep the client context visible while creating the proposal."
          : "Update proposal fields, move the status forward, or convert a won proposal."
      }
      footer={
        <>
          <Button onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button
            form="proposal-form"
            leadingIcon={<FileText className="h-4 w-4" />}
            loading={saveMutation.isPending || isSubmitting}
            type="submit"
          >
            {mode === "create" ? "Save Proposal" : "Save Changes"}
          </Button>
        </>
      }
      onClose={() => {
        if (!isBusy) {
          onClose();
        }
      }}
      open={open}
      title={mode === "create" ? "New Proposal" : "Edit Proposal"}
    >
      <form className="space-y-6" id="proposal-form" onSubmit={handleSubmit((values) => {
        setServerError("");
        saveMutation.mutate(values);
      })}>
        <section className="space-y-4 rounded-lg border border-border bg-background-secondary/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="page-eyebrow">Proposal</p>
              <h3 className="mt-2 text-base font-semibold text-text-primary">
                {mode === "create" ? "Proposal details" : "Proposal record"}
              </h3>
            </div>
            {mode === "edit" ? <StatusBadge status={status} /> : null}
          </div>

          <div className={cn("grid gap-3", mode === "edit" && "sm:grid-cols-2")}>
            {mode === "edit" ? (
              <div className="rounded-md border border-border bg-card px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-text-tertiary">
                  Status
                </p>
                <p className="mt-2 text-sm font-medium text-text-primary">
                  {currentStatusLabel}
                </p>
              </div>
            ) : null}
            <div className="rounded-md border border-border bg-card px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-text-tertiary">
                Amount preview
              </p>
              <p className="mt-2 text-sm font-medium text-text-primary">
                {formatCurrencyValue(formValues.amount)}
              </p>
            </div>
          </div>
        </section>

        <label className="block">
          <span className="field-label">Client</span>
          <input type="hidden" {...register("client_id")} />
          <select
            className={cn(
              "field-input",
              errors.client_id && "border-error focus:border-error focus:ring-error/20",
            )}
            onChange={(event) => handleClientChange(event.target.value)}
            value={formValues.client_id ?? ""}
          >
            <option value="">Select a client</option>
            {availableClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          {selectedClient ? (
            <span className="mt-2 block text-sm text-text-secondary">
              {selectedClient.contact_person} · {selectedClient.region}
            </span>
          ) : (
            <span className="mt-2 block text-sm text-text-secondary">
              Choose an active client from your organisation.
            </span>
          )}
          {errors.client_id ? (
            <span className="mt-2 block text-sm text-error-hover">
              {errors.client_id.message}
            </span>
          ) : null}
        </label>

        <Input
          error={errors.title?.message}
          label="Title"
          placeholder="Website redesign proposal"
          {...register("title", {
            onChange: () => setServerError(""),
          })}
        />

        <label className="block">
          <span className="field-label">Description</span>
          <textarea
            className={cn(
              "field-input min-h-28 resize-y",
              errors.description && "border-error focus:border-error focus:ring-error/20",
            )}
            placeholder="Scope, deliverables, and commercial context"
            rows={4}
            {...register("description", {
              onChange: () => setServerError(""),
            })}
          />
          {errors.description ? (
            <span className="mt-2 block text-sm text-error-hover">
              {errors.description.message}
            </span>
          ) : null}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Amount</span>
            <div
              className={cn(
                "field-shell border border-input-border bg-input px-3 py-2",
                errors.amount && "border-error",
              )}
            >
              <span className="text-sm font-semibold text-text-secondary">GHS</span>
              <input
                className="w-full bg-transparent text-sm text-input-foreground outline-none placeholder:text-text-disabled"
                min="0"
                placeholder="0.00"
                step="0.01"
                type="number"
                {...register("amount", {
                  onChange: () => setServerError(""),
                })}
              />
            </div>
            {errors.amount ? (
              <span className="mt-2 block text-sm text-error-hover">
                {errors.amount.message}
              </span>
            ) : null}
          </label>

          <Input
            error={errors.deadline?.message}
            label="Deadline"
            min={mode === "create" ? new Date().toISOString().slice(0, 10) : undefined}
            type="date"
            {...register("deadline", {
              onChange: () => setServerError(""),
            })}
          />
        </div>

        {mode === "edit" ? (
          <label className="block">
            <span className="field-label">Notes</span>
            <textarea
              className="field-input min-h-20 resize-y"
              placeholder="Internal notes, negotiation points, or delivery assumptions"
              rows={2}
              {...register("notes", {
                onChange: () => setServerError(""),
              })}
            />
          </label>
        ) : null}

        {serverError ? (
          <div className="rounded-lg border border-error/20 bg-error-light px-4 py-3 text-sm text-error-hover">
            {serverError}
          </div>
        ) : null}
      </form>

      {currentProposal ? (
        <section className="mt-6 space-y-4 border-t border-divider pt-6">
          <div className="space-y-2">
            <p className="page-eyebrow">Actions</p>
            <h3 className="section-title">Status transition</h3>
            <p className="text-sm leading-6 text-text-secondary">
              Only valid next steps are shown. Terminal statuses stop here.
            </p>
          </div>

          {transitionActions.length ? (
            <div className="flex flex-wrap gap-3">
              {transitionActions.map((action) => (
                <Button
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
          ) : (
            <div className="rounded-lg border border-border bg-background-secondary/50 px-4 py-3 text-sm text-text-secondary">
              This proposal has reached a terminal status. No further transitions are
              available.
            </div>
          )}
        </section>
      ) : null}

      {currentProposal?.status === "won" ? (
        <section className="mt-6 space-y-4 border-t border-divider pt-6">
          <div className="space-y-2">
            <p className="page-eyebrow">Convert</p>
            <h3 className="section-title">Project conversion</h3>
            <p className="text-sm leading-6 text-text-secondary">
              Reuse the proposal amount and scope as the starting project record.
            </p>
          </div>

          <Input
            label="Project title"
            onChange={(event) =>
              setConvertForm((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Defaults to the proposal title"
            value={convertForm.title ?? ""}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              error={convertErrors.start_date}
              label="Start date"
              onChange={(event) => {
                setConvertForm((current) => ({
                  ...current,
                  start_date: event.target.value,
                }));
                setConvertErrors((current) => ({ ...current, start_date: undefined }));
              }}
              type="date"
              value={convertForm.start_date}
            />
            <Input
              error={convertErrors.due_date}
              label="Due date"
              onChange={(event) => {
                setConvertForm((current) => ({
                  ...current,
                  due_date: event.target.value,
                }));
                setConvertErrors((current) => ({
                  ...current,
                  due_date: undefined,
                  detail: undefined,
                }));
              }}
              type="date"
              value={convertForm.due_date}
            />
          </div>

          {convertErrors.detail ? (
            <div className="rounded-lg border border-error/20 bg-error-light px-4 py-3 text-sm text-error-hover">
              {convertErrors.detail}
            </div>
          ) : null}

          <Button
            leadingIcon={<BriefcaseBusiness className="h-4 w-4" />}
            loading={convertMutation.isPending}
            onClick={handleConvert}
            type="button"
            variant="success"
          >
            Convert to Project
          </Button>
        </section>
      ) : null}
    </Sheet>
  );
}
