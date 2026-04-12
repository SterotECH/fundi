import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Clock3, Save, Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import { ApiError } from "@/api/client";
import {
  createTimeLog,
  deleteTimeLog,
  updateTimeLog,
} from "@/api/projects";
import type { Project, TimeLog } from "@/api/types";
import { queryClient } from "@/app/queryClient";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import {
  createTimeLogFormState,
  mapTimeLogApiErrors,
  normalizeTimeLogPayload,
  timeLogSchema,
  type TimeLogFormValues,
} from "@/features/projects/timeLogFormConfig";

type TimeLogDrawerProps = {
  clientId?: string;
  initialProjectId?: string;
  onClose: () => void;
  open: boolean;
  projects: Project[];
  timeLog?: TimeLog | null;
};

const formId = "time-log-form";
const quickHourOptions = ["0.5", "1", "2", "3", "4"] as const;

export function TimeLogDrawer({
  clientId,
  initialProjectId,
  onClose,
  open,
  projects,
  timeLog,
}: Readonly<TimeLogDrawerProps>) {
  const mode = timeLog ? "edit" : "create";
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
    control,
  } = useForm<TimeLogFormValues>({
    resolver: zodResolver(timeLogSchema),
    defaultValues: createTimeLogFormState(timeLog, initialProjectId),
  });

  const selectedProjectId = useWatch({ control, name: "project_id" });
  const selectedHours = useWatch({ control, name: "hours" });
  const isBillable = useWatch({ control, name: "billable" });
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const filteredProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    if (!query) {
      return projects;
    }

    return projects.filter((project) =>
      `${project.title} ${project.status}`.toLowerCase().includes(query),
    );
  }, [projectSearch, projects]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextValues = createTimeLogFormState(timeLog, initialProjectId);
    reset(nextValues);
  }, [initialProjectId, open, reset, timeLog]);

  const invalidateTimeQueries = async (projectId?: string) => {
    await queryClient.invalidateQueries({ queryKey: ["timelogs"] });

    if (clientId) {
      await queryClient.invalidateQueries({ queryKey: ["client", clientId, "time"] });
    }

    if (projectId) {
      await queryClient.invalidateQueries({ queryKey: ["project", projectId, "timelogs"] });
    }
  };

  const saveMutation = useMutation({
    mutationFn: (values: TimeLogFormValues) => {
      const payload = normalizeTimeLogPayload(values);
      if (timeLog) {
        return updateTimeLog(timeLog.id, payload);
      }
      return createTimeLog(payload);
    },
    onSuccess: async (savedTimeLog) => {
      await invalidateTimeQueries(savedTimeLog.project);
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const apiErrors = mapTimeLogApiErrors(error.payload);

        if (apiErrors.project_id) {
          setError("project_id", { message: apiErrors.project_id });
        }
        if (apiErrors.log_date) {
          setError("log_date", { message: apiErrors.log_date });
        }
        if (apiErrors.hours) {
          setError("hours", { message: apiErrors.hours });
        }
        if (apiErrors.description) {
          setError("description", { message: apiErrors.description });
        }
        if (apiErrors.billable) {
          setError("billable", { message: apiErrors.billable });
        }
        if (apiErrors.detail) {
          setError("root", { message: apiErrors.detail });
        }
        return;
      }

      setError("root", { message: "The time log could not be saved." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTimeLog(timeLog!.id),
    onSuccess: async () => {
      await invalidateTimeQueries(timeLog?.project);
      setIsDeleteDialogOpen(false);
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setError("root", {
          message: error.payload.detail ?? "The time log could not be deleted.",
        });
        return;
      }

      setError("root", { message: "The time log could not be deleted." });
    },
  });

  const isBusy = isSubmitting || saveMutation.isPending || deleteMutation.isPending;

  return (
    <>
      <AlertDialog
        confirmLabel="Delete time log"
        confirmLoading={deleteMutation.isPending}
        description="Remove this time entry from the project history."
        onCancel={() => {
          if (!deleteMutation.isPending) {
            setIsDeleteDialogOpen(false);
          }
        }}
        onConfirm={() => deleteMutation.mutate()}
        open={isDeleteDialogOpen}
        title="Delete time log"
        tone="danger"
      />

      <Sheet
        description={
          mode === "create"
            ? "Log delivery work against one of this client's active projects."
            : "Update the time entry or remove it from the project history."
        }
        footer={
          <>
            {timeLog ? (
              <Button
                className="text-error-hover"
                leadingIcon={<Trash2 className="h-4 w-4" />}
                onClick={() => setIsDeleteDialogOpen(true)}
                type="button"
                variant="secondary"
              >
                Delete
              </Button>
            ) : null}
            <Button onClick={onClose} type="button" variant="secondary">
              Cancel
            </Button>
            <Button
              form={formId}
              leadingIcon={<Save className="h-4 w-4" />}
              loading={isBusy}
              type="submit"
            >
              {mode === "create" ? "Save Time Log" : "Save Changes"}
            </Button>
          </>
        }
        onClose={() => {
          if (!isBusy) {
            onClose();
          }
        }}
        open={open}
        title={mode === "create" ? "Log Time" : "Edit Time Log"}
      >
        <form
          className="space-y-5"
          id={formId}
          onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
        >
          {errors.root?.message ? (
            <div className="rounded-lg border border-error/25 bg-error-light px-4 py-3 text-sm text-error-hover">
              {errors.root.message}
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="field-label">Project</span>
              {selectedProject ? (
                <span className="text-xs font-medium text-text-secondary">
                  {selectedProject.status}
                </span>
              ) : null}
            </div>
            <input type="hidden" {...register("project_id")} />
            <Input
              label={undefined}
              onChange={(event) => setProjectSearch(event.target.value)}
              placeholder="Search project"
              value={projectSearch}
            />
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border bg-background-secondary p-2">
              {filteredProjects.length ? (
                filteredProjects.map((project) => {
                  const isSelected = project.id === selectedProjectId;

                  return (
                    <button
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary-light text-primary-dark"
                          : "border-transparent bg-card text-text-secondary hover:border-border hover:bg-card-hover hover:text-text-primary"
                      }`}
                      key={project.id}
                      onClick={() => {
                        setValue("project_id", project.id, { shouldValidate: true });
                        setProjectSearch(project.title);
                      }}
                      type="button"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{project.title}</p>
                        <p className="mt-1 text-xs text-text-tertiary">
                          {project.status} · {project.due_date}
                        </p>
                      </div>
                      {isSelected ? <Clock3 className="h-4 w-4 shrink-0" /> : null}
                    </button>
                  );
                })
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-card px-4 py-5 text-sm text-text-secondary">
                  No projects match this search.
                </div>
              )}
            </div>
            {errors.project_id?.message ? (
              <span className="block text-sm text-error-hover" role="alert">
                {errors.project_id.message}
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              error={errors.log_date?.message}
              label="Date"
              type="date"
              {...register("log_date")}
            />
            <div>
              <Input
                error={errors.hours?.message}
                hint="Use 0.5 hour increments when needed."
                inputMode="decimal"
                label="Hours"
                {...register("hours")}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {quickHourOptions.map((value) => (
                  <button
                    className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                      selectedHours === value
                        ? "border-primary bg-primary-light text-primary-dark"
                        : "border-border bg-card text-text-secondary hover:border-border-hover hover:bg-card-hover hover:text-text-primary"
                    }`}
                    key={value}
                    onClick={() => setValue("hours", value, { shouldValidate: true })}
                    type="button"
                  >
                    {value}h
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="block">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="field-label">Description</span>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary">
                <input
                  className="sr-only"
                  type="checkbox"
                  {...register("billable")}
                />
                <button
                  aria-pressed={isBillable}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isBillable
                      ? "border-secondary bg-success-light text-secondary-dark"
                      : "border-border bg-card text-text-secondary"
                  }`}
                  onClick={() =>
                    setValue("billable", !isBillable, { shouldValidate: true })
                  }
                  type="button"
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isBillable ? "bg-secondary" : "bg-muted"
                    }`}
                  />
                  {isBillable ? "Billable" : "Non-billable"}
                </button>
              </label>
            </div>
            <textarea
              className="field-input min-h-28 resize-y"
              placeholder="What did you work on?"
              {...register("description")}
            />
            {errors.description?.message ? (
              <span className="mt-2 block text-sm text-error-hover" role="alert">
                {errors.description.message}
              </span>
            ) : null}
          </label>
        </form>
      </Sheet>
    </>
  );
}
