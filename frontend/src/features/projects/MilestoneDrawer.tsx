import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Save, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { ApiError } from "@/api/client";
import {
  createProjectMilestone,
  deleteProjectMilestone,
  updateProjectMilestone,
} from "@/api/projects";
import type { Milestone } from "@/api/types";
import { queryClient } from "@/app/queryClient";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import {
  createMilestoneFormState,
  mapMilestoneApiErrors,
  milestoneSchema,
  normalizeMilestonePayload,
  type MilestoneFormValues,
} from "@/features/projects/projectFormConfig";

type MilestoneDrawerProps = {
  milestone?: Milestone | null;
  nextOrder?: number;
  onClose: () => void;
  open: boolean;
  projectId: string;
};

const formId = "milestone-form";

export function MilestoneDrawer({
  milestone,
  nextOrder = 0,
  onClose,
  open,
  projectId,
}: Readonly<MilestoneDrawerProps>) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneSchema),
    defaultValues: createMilestoneFormState(milestone, nextOrder),
  });
  const mode = milestone ? "edit" : "create";

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const saveMutation = useMutation({
    mutationFn: (values: MilestoneFormValues) => {
      const payload = normalizeMilestonePayload(values);
      if (milestone) {
        return updateProjectMilestone(projectId, milestone.id, payload);
      }
      return createProjectMilestone(projectId, payload);
    },
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const apiErrors = mapMilestoneApiErrors(error.payload);
        Object.entries(apiErrors).forEach(([field, message]) => {
          if (field === "detail" || !message) {
            return;
          }
          setError(field as keyof MilestoneFormValues, { message: String(message) });
        });
        if (apiErrors.detail) {
          setError("root", { message: apiErrors.detail });
        }
        return;
      }
      setError("root", { message: "The milestone could not be saved." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProjectMilestone(projectId, milestone!.id),
    onSuccess: async () => {
      await invalidate();
      setIsDeleteDialogOpen(false);
      onClose();
    },
  });

  const isSaving = isSubmitting || saveMutation.isPending;

  return (
    <>
      <AlertDialog
        confirmLabel="Delete milestone"
        confirmLoading={deleteMutation.isPending}
        description="Remove this milestone from the project plan."
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        open={isDeleteDialogOpen}
        title="Delete milestone"
        tone="danger"
      />

      <Sheet
        description={
          mode === "create"
            ? "Add a dated milestone to the current project."
            : "Update milestone details or mark it complete."
        }
        footer={
          <>
            {milestone ? (
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
              loading={isSaving}
              type="submit"
            >
              {mode === "create" ? "Save Milestone" : "Save Changes"}
            </Button>
          </>
        }
        onClose={onClose}
        open={open}
        title={mode === "create" ? "New Milestone" : "Edit Milestone"}
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

          <Input error={errors.title?.message} label="Title" {...register("title")} />
          <label className="block">
            <span className="field-label">Description</span>
            <textarea className="field-input min-h-24 resize-y" {...register("description")} />
            {errors.description?.message ? (
              <span className="mt-2 block text-sm text-error-hover">{errors.description.message}</span>
            ) : null}
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <Input error={errors.due_date?.message} label="Due date" type="date" {...register("due_date")} />
            <Input
              error={errors.order?.message}
              label="Order"
              type="number"
              {...register("order", { valueAsNumber: true })}
            />
          </div>

          <label className="inline-flex items-center gap-3 rounded-lg border border-border bg-background-secondary px-4 py-3 text-sm font-medium text-text-primary">
            <input type="checkbox" {...register("completed")} />
            Mark milestone complete
          </label>
        </form>
      </Sheet>
    </>
  );
}
