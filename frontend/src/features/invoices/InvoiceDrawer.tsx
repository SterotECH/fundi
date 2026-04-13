import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";

import { ApiError } from "@/api/client";
import { listClients } from "@/api/clients";
import { createInvoice, updateInvoice } from "@/api/invoices";
import { listProjects } from "@/api/projects";
import type { InvoiceDetail } from "@/api/types";
import { queryClient } from "@/app/queryClient";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import {
  createInvoiceFormState,
  emptyInvoiceLineItem,
  invoiceSchema,
  mapApiErrors,
  normalizeInvoicePayload,
  type InvoiceFormErrors,
  type InvoiceFormValues,
} from "@/features/invoices/invoiceFormConfig";
import { formatCurrencyValue } from "@/utils/currency";

type InvoiceDrawerProps = {
  open: boolean;
  invoice?: InvoiceDetail | null;
  initialClientId?: string;
  initialProjectId?: string;
  onClose: () => void;
};

const formId = "invoice-form";

function calculatePreviewTotal(values: InvoiceFormValues) {
  return values.line_items.reduce((total, item) => {
    const quantity = Number.parseFloat(item.quantity || "0");
    const unitPrice = Number.parseFloat(item.unit_price || "0");

    if (Number.isNaN(quantity) || Number.isNaN(unitPrice)) {
      return total;
    }

    return total + quantity * unitPrice;
  }, 0);
}

export function InvoiceDrawer({
  open,
  invoice,
  initialClientId,
  initialProjectId,
  onClose,
}: Readonly<InvoiceDrawerProps>) {
  const mode = invoice ? "edit" : "create";
  const [serverError, setServerError] = useState("");

  const defaultValues = useMemo(
    () => createInvoiceFormState(invoice ?? null, initialClientId, initialProjectId),
    [invoice, initialClientId, initialProjectId],
  );

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
    setValue,
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues,
  });

  const { append, fields, remove } = useFieldArray({
    control,
    name: "line_items",
  });
  const formValues = useWatch({ control });
  const selectedClientId = formValues.client_id ?? "";
  const previewTotal = calculatePreviewTotal(formValues as InvoiceFormValues);

  const clientsQuery = useQuery({
    queryKey: ["invoice-clients"],
    queryFn: () => listClients({ isArchived: "false" }),
    enabled: open,
  });
  const projectsQuery = useQuery({
    queryKey: ["invoice-projects", { selectedClientId }],
    queryFn: () => listProjects({ clientId: selectedClientId }),
    enabled: open && Boolean(selectedClientId),
  });

  const saveMutation = useMutation({
    mutationFn: (values: InvoiceFormValues) => {
      const payload = normalizeInvoicePayload(values);

      if (invoice) {
        return updateInvoice(invoice.id, payload);
      }

      return createInvoice(payload);
    },
    onSuccess: async (savedInvoice) => {
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["invoice", savedInvoice.id] });
      await queryClient.invalidateQueries({
        queryKey: ["client", savedInvoice.client, "invoices"],
      });
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const apiErrors = mapApiErrors<InvoiceFormErrors>(error.payload);

        if (apiErrors.client_id) {
          setError("client_id", { message: apiErrors.client_id });
        }
        if (apiErrors.project_id) {
          setError("project_id", { message: apiErrors.project_id });
        }
        if (apiErrors.due_date) {
          setError("due_date", { message: apiErrors.due_date });
        }
        if (apiErrors.notes) {
          setError("notes", { message: apiErrors.notes });
        }
        if (apiErrors.line_items) {
          setError("line_items", { message: apiErrors.line_items });
        }

        setServerError(apiErrors.detail ?? "The invoice could not be saved.");
        return;
      }

      setServerError("The invoice could not be saved.");
    },
  });

  const handleSave = (values: InvoiceFormValues) => {
    setServerError("");
    saveMutation.mutate(values);
  };

  const isSaving = isSubmitting || saveMutation.isPending;

  return (
    <Sheet
      description={
        mode === "create"
          ? "Create a draft invoice. The invoice number and status are assigned by the backend."
          : "Only draft invoices can be edited."
      }
      footer={
        <>
          <Button onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button form={formId} loading={isSaving} type="submit">
            {mode === "create" ? "Create Draft" : "Save Draft"}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title={mode === "create" ? "New Invoice" : invoice?.invoice_number || "Draft invoice"}
    >
      <form className="space-y-6" id={formId} onSubmit={handleSubmit(handleSave)}>
        {serverError ? (
          <div className="rounded-lg border border-error/25 bg-error-light px-4 py-3 text-sm text-error-hover">
            {serverError}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="field-label">Client</span>
            <select
              className="field-input"
              disabled={clientsQuery.isLoading}
              {...register("client_id", {
                onChange: () => setValue("project_id", ""),
              })}
            >
              <option value="">Select client</option>
              {(clientsQuery.data ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            {errors.client_id?.message ? (
              <span className="mt-2 block text-sm text-error-hover" role="alert">
                {errors.client_id.message}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="field-label">Project</span>
            <select
              className="field-input"
              disabled={!selectedClientId || projectsQuery.isLoading}
              {...register("project_id")}
            >
              <option value="">No linked project</option>
              {(projectsQuery.data ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
            {errors.project_id?.message ? (
              <span className="mt-2 block text-sm text-error-hover" role="alert">
                {errors.project_id.message}
              </span>
            ) : null}
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <Input
            error={errors.due_date?.message}
            label="Due date"
            type="date"
            {...register("due_date")}
          />

          <div className="rounded-lg border border-border bg-background-secondary px-4 py-3">
            <p className="text-xs font-semibold uppercase text-text-tertiary">
              Draft total
            </p>
            <p className="mt-2 text-xl font-semibold text-text-primary">
              {formatCurrencyValue(previewTotal)}
            </p>
          </div>
        </div>

        <label className="block">
          <span className="field-label">Notes</span>
          <textarea
            className="field-input min-h-24 resize-y"
            placeholder="Payment instructions or client-facing context"
            {...register("notes")}
          />
          {errors.notes?.message ? (
            <span className="mt-2 block text-sm text-error-hover" role="alert">
              {errors.notes.message}
            </span>
          ) : null}
        </label>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="section-title text-base">Line Items</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Quantity and unit price are recalculated by the backend.
              </p>
            </div>
            <Button
              aria-label="Add line item"
              className="h-10 w-10 px-0 py-0"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={() => append({ ...emptyInvoiceLineItem })}
              title="Add line item"
              type="button"
              variant="secondary"
            />
          </div>

          {typeof errors.line_items?.message === "string" ? (
            <p className="text-sm text-error-hover" role="alert">
              {errors.line_items.message}
            </p>
          ) : null}

          <div className="grid gap-3">
            {fields.map((field, index) => {
              const itemErrors = errors.line_items?.[index];

              return (
                <div className="rounded-lg border border-border bg-card p-4" key={field.id}>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Input
                      className="w-full"
                      error={itemErrors?.description?.message}
                      label="Description"
                      wrapperClassName="lg:col-span-2"
                      {...register(`line_items.${index}.description`)}
                    />
                    <Input
                      error={itemErrors?.quantity?.message}
                      inputMode="decimal"
                      label="Qty"
                      {...register(`line_items.${index}.quantity`)}
                    />
                    <Input
                      error={itemErrors?.unit_price?.message}
                      inputMode="decimal"
                      label="Unit price"
                      {...register(`line_items.${index}.unit_price`)}
                    />
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      aria-label="Remove line item"
                      className="h-10 w-10 px-0 py-0"
                      disabled={fields.length === 1}
                      leadingIcon={<Trash2 className="h-4 w-4" />}
                      onClick={() => remove(index)}
                      title="Remove line item"
                      type="button"
                      variant="secondary"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </form>
    </Sheet>
  );
}
