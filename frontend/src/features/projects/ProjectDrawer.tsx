import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, FolderKanban, GripVertical, Plus, Save, X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import { ApiError } from "@/api/client";
import { listClients, listClientProposals } from "@/api/clients";
import { createProject, updateProject } from "@/api/projects";
import type { ProjectDetail } from "@/api/types";
import { queryClient } from "@/app/queryClient";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import {
  createProjectFormState,
  mapProjectApiErrors,
  normalizeProjectPayload,
  projectSchema,
  projectStatusOptions,
  type ProjectFormValues,
} from "@/features/projects/projectFormConfig";

type ProjectDrawerProps = {
  initialClientId?: string;
  onClose: () => void;
  open: boolean;
  project?: ProjectDetail | null;
};

const formId = "project-form";
const createInitialDraftMilestones = (mode: "create" | "edit") =>
  mode === "create"
    ? [
        { due_date: "", title: "" },
        { due_date: "", title: "" },
      ]
    : [];

export function ProjectDrawer({
  initialClientId,
  onClose,
  open,
  project,
}: Readonly<ProjectDrawerProps>) {
  const mode = project ? "edit" : "create";
  const [serverError, setServerError] = useState("");
  const [draftMilestones, setDraftMilestones] = useState<Array<{ due_date: string; title: string }>>(
    () => createInitialDraftMilestones(mode),
  );

  const defaultValues = useMemo(
    () => createProjectFormState(project ?? null, initialClientId),
    [initialClientId, project],
  );

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
    control,
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues,
  });

  const selectedClientId = useWatch({ control, name: "client_id" });
  const selectedProposalId = useWatch({ control, name: "proposal_id" });
  const selectedStatus = useWatch({ control, name: "status" });
  const watchedTitle = useWatch({ control, name: "title" });
  const watchedDescription = useWatch({ control, name: "description" });
  const watchedStartDate = useWatch({ control, name: "start_date" });
  const watchedDueDate = useWatch({ control, name: "due_date" });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const clientsQuery = useQuery({
    queryKey: ["project-clients"],
    queryFn: () => listClients({ isArchived: "false" }),
    enabled: open,
  });
  const proposalsQuery = useQuery({
    queryKey: ["project-client-proposals", selectedClientId],
    queryFn: () => listClientProposals(selectedClientId),
    enabled: open && Boolean(selectedClientId),
  });

  const selectedProposal = useMemo(
    () => (proposalsQuery.data ?? []).find((proposal) => proposal.id === selectedProposalId) ?? null,
    [proposalsQuery.data, selectedProposalId],
  );

  const saveMutation = useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      const payload = {
        ...normalizeProjectPayload(values),
        milestones:
          mode === "create"
            ? draftMilestones
                .map((milestone, index) => ({
                  completed: false,
                  description: "",
                  due_date: milestone.due_date,
                  order: index,
                  title: milestone.title.trim(),
                }))
                .filter((milestone) => milestone.title && milestone.due_date)
            : undefined,
      };
      if (project) {
        return updateProject(project.id, payload);
      }

      return createProject(payload);
    },
    onSuccess: async (savedProject) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["project", savedProject.id] });
      await queryClient.invalidateQueries({
        queryKey: ["client", savedProject.client, "projects"],
      });
      resetDrawerState();
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const apiErrors = mapProjectApiErrors(error.payload);

        Object.entries(apiErrors).forEach(([field, message]) => {
          if (field === "detail" || !message) {
            return;
          }
          setError(field as keyof ProjectFormValues, { message });
        });

        setServerError(apiErrors.detail ?? "The project could not be saved.");
        return;
      }

      setServerError("The project could not be saved.");
    },
  });

  const isSaving = isSubmitting || saveMutation.isPending;
  const titleCount = watchedTitle?.length ?? 0;
  const descriptionCount = watchedDescription?.length ?? 0;

  const footerHint = !selectedClientId
    ? "Select a client to continue"
    : !watchedTitle?.trim()
      ? "Project title is required"
      : !watchedStartDate || !watchedDueDate
        ? "Start and due dates required"
        : watchedStartDate >= watchedDueDate
          ? "Start date must be before due date"
      : "All required fields filled";

  const addMilestone = () => {
    setDraftMilestones((current) => [...current, { due_date: "", title: "" }]);
  };

  const resetDrawerState = () => {
    setServerError("");
    reset(defaultValues);
    setDraftMilestones(createInitialDraftMilestones(mode));
  };

  const handleClose = () => {
    resetDrawerState();
    onClose();
  };

  const removeMilestone = (index: number) => {
    setDraftMilestones((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const updateMilestone = (
    index: number,
    field: "due_date" | "title",
    value: string,
  ) => {
    setDraftMilestones((current) =>
      current.map((milestone, currentIndex) =>
        currentIndex === index ? { ...milestone, [field]: value } : milestone,
      ),
    );
  };

  return (
    <Sheet
      description={
        mode === "create"
          ? "Create a project record with delivery dates, budget, and an optional linked proposal."
          : "Update the project metadata, dates, budget, and current status."
      }
      footer={
        <div className="project-drawer-footer">
          <span className="project-drawer-footer-hint">{footerHint}</span>
          <div className="project-drawer-footer-actions">
            <Button onClick={handleClose} type="button" variant="secondary">
              Cancel
            </Button>
            <Button
              form={formId}
              leadingIcon={<Save className="h-4 w-4" />}
              loading={isSaving}
              type="submit"
            >
              {mode === "create" ? "Create project" : "Save changes"}
            </Button>
          </div>
        </div>
      }
      onClose={handleClose}
      open={open}
      title={mode === "create" ? "New Project" : "Edit Project"}
    >
      <form
        className="project-drawer-form"
        id={formId}
        onSubmit={handleSubmit((values) => {
          setServerError("");
          saveMutation.mutate(values);
        })}
      >
        <div className="project-drawer-header">
          <div className="project-drawer-header-icon">
            <FolderKanban className="h-4 w-4" />
          </div>
          <div>
            <p className="project-drawer-header-title">
              {mode === "create" ? "New project" : "Edit project"}
            </p>
          </div>
        </div>

        {serverError ? (
          <div className="rounded-lg border border-error/25 bg-error-light px-4 py-3 text-sm text-error-hover">
            {serverError}
          </div>
        ) : null}

        {selectedProposal ? (
          <div className="project-drawer-proposal-banner">
            <div className="project-drawer-proposal-icon">
              <FileText className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="project-drawer-proposal-title">Converted from won proposal</p>
              <p className="project-drawer-proposal-sub">
                {selectedProposal.title} · {selectedProposal.amount} · {selectedProposal.client_name}
              </p>
            </div>
            <button
              className="project-drawer-proposal-clear"
              onClick={() =>
                setValue("proposal_id", "", { shouldDirty: true, shouldValidate: true })
              }
              type="button"
            >
              Clear
            </button>
          </div>
        ) : null}

        <label className="block">
          <span className="field-label">Client</span>
          <select
            className="field-input"
            disabled={clientsQuery.isLoading}
            {...register("client_id")}
          >
            <option value="">Select a client…</option>
            {(clientsQuery.data ?? []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          {errors.client_id?.message ? (
            <span className="mt-2 block text-sm text-error-hover">{errors.client_id.message}</span>
          ) : null}
        </label>

        <div className="project-drawer-field">
          <Input
            error={errors.title?.message}
            label="Project title"
            maxLength={80}
            {...register("title")}
          />
          <div className="project-drawer-char-count">{titleCount} / 80</div>
        </div>

        <label className="block">
          <span className="field-label">Description</span>
          <textarea
            className="field-input min-h-24 resize-y"
            maxLength={300}
            placeholder="What does this project deliver? Keep it to 2–3 sentences."
            {...register("description")}
          />
          <div className="project-drawer-char-count">{descriptionCount} / 300</div>
          {errors.description?.message ? (
            <span className="mt-2 block text-sm text-error-hover">{errors.description.message}</span>
          ) : null}
        </label>

        <label className="block">
          <span className="field-label">Status</span>
          <div className="project-drawer-status-group">
            {projectStatusOptions
              .filter((option) => option.value !== "done")
              .map((option) => (
                <button
                  className={[
                    "project-drawer-status-option",
                    selectedStatus === option.value
                      ? `project-drawer-status-option-${option.value}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={option.value}
                  onClick={() =>
                    setValue("status", option.value, { shouldDirty: true, shouldValidate: true })
                  }
                  type="button"
                >
                  {option.label === "Hold" ? "On hold" : option.label}
                </button>
              ))}
          </div>
          <span className="mt-2 block text-sm text-text-secondary">
            Set to Active when work begins
          </span>
          {errors.status?.message ? (
            <span className="mt-2 block text-sm text-error-hover">{errors.status.message}</span>
          ) : null}
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <Input error={errors.start_date?.message} label="Start date" type="date" {...register("start_date")} />
          <Input error={errors.due_date?.message} label="Due date" type="date" {...register("due_date")} />
        </div>

        <label className="block">
          <span className="field-label">Budget (GHS)</span>
          <div className="project-drawer-budget-shell">
            <span className="project-drawer-budget-prefix">GHS</span>
            <input
              className="field-input project-drawer-budget-input"
              inputMode="decimal"
              min="0"
              placeholder="0.00"
              step="100"
              {...register("budget")}
            />
          </div>
          <span className="mt-2 block text-sm text-text-secondary">
            Used to calculate burn rate and effective hourly rate
          </span>
          {errors.budget?.message ? (
            <span className="mt-2 block text-sm text-error-hover">{errors.budget.message}</span>
          ) : null}
        </label>

        <label className="block">
          <span className="field-label">Linked proposal</span>
          <select
            className="field-input"
            disabled={!selectedClientId || proposalsQuery.isLoading}
            {...register("proposal_id")}
          >
            <option value="">None (manual project)</option>
            {(proposalsQuery.data ?? []).map((proposal) => (
              <option key={proposal.id} value={proposal.id}>
                {proposal.title} — {proposal.status} · {proposal.amount}
              </option>
            ))}
          </select>
          <span className="mt-2 block text-sm text-text-secondary">
            Links this project back to the originating proposal
          </span>
          {errors.proposal_id?.message ? (
            <span className="mt-2 block text-sm text-error-hover">{errors.proposal_id.message}</span>
          ) : null}
        </label>

        {mode === "create" ? (
          <>
            <div className="project-drawer-section-divider">
              Milestones
              <span className="project-drawer-section-note">
                optional — add now or later
              </span>
            </div>

            <div className="project-drawer-milestone-list">
              {draftMilestones.map((milestone, index) => (
                <div className="project-drawer-milestone-item" key={`${index}-${milestone.title}`}>
                  <GripVertical className="project-drawer-milestone-grip h-4 w-4" />
                  <span className="project-drawer-milestone-number">{index + 1}</span>
                  <input
                    className="project-drawer-milestone-title"
                    onChange={(event) => updateMilestone(index, "title", event.target.value)}
                    placeholder="Milestone title"
                    type="text"
                    value={milestone.title}
                  />
                  <input
                    className="project-drawer-milestone-date"
                    onChange={(event) => updateMilestone(index, "due_date", event.target.value)}
                    type="date"
                    value={milestone.due_date}
                  />
                  <button
                    className="project-drawer-milestone-remove"
                    onClick={() => removeMilestone(index)}
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            <button
              className="project-drawer-add-milestone"
              onClick={addMilestone}
              type="button"
            >
              <Plus className="h-4 w-4" />
              Add milestone
            </button>
          </>
        ) : null}
      </form>
    </Sheet>
  );
}
