import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Archive, Building2, Mail, Phone, Save, UserRound } from "lucide-react";
import { useNavigate } from "react-router";

import { ApiError } from "@/api/client";
import {
  convertLeadToClient,
  createLead,
  markLeadDead,
  updateLead,
} from "@/api/leads";
import type { Lead } from "@/api/types";
import { queryClient } from "@/app/queryClient";
import { StatusBadge } from "@/components/status/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { clientTypeOptions } from "@/features/clients/clientFormConfig";
import {
  convertLeadSchema,
  createConvertLeadFormState,
  createLeadFormState,
  leadSchema,
  leadSourceOptions,
  leadStatusOptions,
  mapConvertLeadApiErrors,
  mapLeadApiErrors,
  normalizeConvertLeadPayload,
  normalizeLeadPayload,
  type ConvertLeadFormValues,
  type LeadFormValues,
} from "@/features/leads/leadFormConfig";

type LeadDrawerProps = {
  open: boolean;
  lead?: Lead | null;
  onClose: () => void;
};

export function LeadDrawer({ open, lead, onClose }: Readonly<LeadDrawerProps>) {
  const navigate = useNavigate();
  const mode = lead ? "edit" : "create";
  const [currentLead, setCurrentLead] = useState<Lead | null>(lead ?? null);
  const [serverError, setServerError] = useState("");
  const [convertError, setConvertError] = useState("");

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: createLeadFormState(lead ?? null),
  });

  const {
    formState: { errors: convertErrors, isSubmitting: isConvertSubmitting },
    handleSubmit: handleConvertSubmit,
    register: registerConvert,
    setError: setConvertFieldError,
  } = useForm<ConvertLeadFormValues>({
    resolver: zodResolver(convertLeadSchema),
    defaultValues: currentLead ? createConvertLeadFormState(currentLead) : undefined,
  });

  const saveMutation = useMutation({
    mutationFn: (values: LeadFormValues) => {
      const payload = normalizeLeadPayload(values);

      if (mode === "create" && !currentLead) {
        return createLead(payload);
      }

      return updateLead(currentLead!.id, payload);
    },
    onSuccess: async (savedLead) => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setCurrentLead(savedLead);
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const apiErrors = mapLeadApiErrors(error.payload);

        if (apiErrors.name) {
          setError("name", { message: apiErrors.name });
        }
        if (apiErrors.contact_person) {
          setError("contact_person", { message: apiErrors.contact_person });
        }
        if (apiErrors.email) {
          setError("email", { message: apiErrors.email });
        }
        if (apiErrors.phone) {
          setError("phone", { message: apiErrors.phone });
        }
        if (apiErrors.source) {
          setError("source", { message: apiErrors.source });
        }
        if (apiErrors.status) {
          setError("status", { message: apiErrors.status });
        }
        if (apiErrors.notes) {
          setError("notes", { message: apiErrors.notes });
        }

        setServerError(apiErrors.detail ?? "The lead could not be saved.");
        return;
      }

      setServerError("The lead could not be saved.");
    },
  });

  const markDeadMutation = useMutation({
    mutationFn: () => markLeadDead(currentLead!.id),
    onSuccess: async (updatedLead) => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setCurrentLead(updatedLead);
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setServerError(error.payload.detail ?? "The lead could not be marked dead.");
        return;
      }

      setServerError("The lead could not be marked dead.");
    },
  });

  const convertMutation = useMutation({
    mutationFn: (values: ConvertLeadFormValues) =>
      convertLeadToClient(currentLead!.id, normalizeConvertLeadPayload(values)),
    onSuccess: async (client) => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
      navigate(`/clients/${client.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const apiErrors = mapConvertLeadApiErrors(error.payload);

        if (apiErrors.type) {
          setConvertFieldError("type", { message: apiErrors.type });
        }
        if (apiErrors.contact_person) {
          setConvertFieldError("contact_person", { message: apiErrors.contact_person });
        }
        if (apiErrors.email) {
          setConvertFieldError("email", { message: apiErrors.email });
        }
        if (apiErrors.phone) {
          setConvertFieldError("phone", { message: apiErrors.phone });
        }
        if (apiErrors.address) {
          setConvertFieldError("address", { message: apiErrors.address });
        }
        if (apiErrors.region) {
          setConvertFieldError("region", { message: apiErrors.region });
        }
        if (apiErrors.notes) {
          setConvertFieldError("notes", { message: apiErrors.notes });
        }

        setConvertError(apiErrors.detail ?? "The lead could not be converted.");
        return;
      }

      setConvertError("The lead could not be converted.");
    },
  });

  const isBusy =
    saveMutation.isPending ||
    markDeadMutation.isPending ||
    convertMutation.isPending ||
    isSubmitting ||
    isConvertSubmitting;
  const canConvert =
    currentLead && !["converted", "dead"].includes(currentLead.status);
  const canMarkDead =
    currentLead && !["converted", "dead"].includes(currentLead.status);

  return (
    <Sheet
      description={
        mode === "create"
          ? "Capture the prospect before it becomes a client."
          : "Update the lead, convert it to a client, or mark it dead."
      }
      footer={
        <>
          <Button onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button
            form="lead-form"
            leadingIcon={<Save className="h-4 w-4" />}
            loading={saveMutation.isPending || isSubmitting}
            type="submit"
          >
            {mode === "create" ? "Save Lead" : "Save Changes"}
          </Button>
        </>
      }
      onClose={() => {
        if (!isBusy) {
          onClose();
        }
      }}
      open={open}
      title={mode === "create" ? "New Lead" : "Edit Lead"}
    >
      <form
        className="space-y-5"
        id="lead-form"
        onSubmit={handleSubmit((values) => {
          setServerError("");
          saveMutation.mutate(values);
        })}
      >
        <section className="space-y-4 rounded-lg border border-border bg-background-secondary/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="page-eyebrow">Lead</p>
              <h3 className="mt-2 text-base font-semibold text-text-primary">
                Pipeline record
              </h3>
            </div>
            {currentLead ? <StatusBadge status={currentLead.status} /> : null}
          </div>
          <p className="text-sm leading-6 text-text-secondary">
            Lead creation follows the current backend write serializer: name,
            contact fields, source, and status.
          </p>
        </section>

        <Input
          error={errors.name?.message}
          label="Lead name"
          leftIcon={<Building2 className="h-4 w-4" />}
          placeholder="Prospect school"
          {...register("name", {
            onChange: () => setServerError(""),
          })}
        />

        <Input
          error={errors.contact_person?.message}
          label="Contact person"
          leftIcon={<UserRound className="h-4 w-4" />}
          placeholder="Kofi Mensah"
          {...register("contact_person", {
            onChange: () => setServerError(""),
          })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            error={errors.email?.message}
            label="Email"
            leftIcon={<Mail className="h-4 w-4" />}
            placeholder="prospect@example.com"
            type="email"
            {...register("email", {
              onChange: () => setServerError(""),
            })}
          />

          <Input
            error={errors.phone?.message}
            label="Phone"
            leftIcon={<Phone className="h-4 w-4" />}
            placeholder="024 000 0000"
            {...register("phone", {
              onChange: () => setServerError(""),
            })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Source</span>
            <select className="field-input" {...register("source")}>
              {leadSourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.source ? (
              <span className="mt-2 block text-sm text-error-hover">
                {errors.source.message}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="field-label">Status</span>
            <select className="field-input" {...register("status")}>
              {leadStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.status ? (
              <span className="mt-2 block text-sm text-error-hover">
                {errors.status.message}
              </span>
            ) : null}
          </label>
        </div>

        <label className="block">
          <span className="field-label">Notes</span>
          <textarea
            className="field-input min-h-24 resize-y"
            placeholder="Pipeline context, decision makers, objections, or next follow-up"
            rows={3}
            {...register("notes", {
              onChange: () => setServerError(""),
            })}
          />
          {errors.notes ? (
            <span className="mt-2 block text-sm text-error-hover">
              {errors.notes.message}
            </span>
          ) : null}
        </label>

        {serverError ? (
          <div className="rounded-lg border border-error/20 bg-error-light px-4 py-3 text-sm text-error-hover">
            {serverError}
          </div>
        ) : null}
      </form>

      {currentLead ? (
        <section className="mt-6 space-y-4 border-t border-divider pt-6">
          <div className="space-y-2">
            <p className="page-eyebrow">Actions</p>
            <h3 className="section-title">Lead outcome</h3>
            <p className="text-sm leading-6 text-text-secondary">
              Convert qualified prospects into clients or remove dead leads from
              the active pipeline.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {canMarkDead ? (
              <Button
                leadingIcon={<Archive className="h-4 w-4" />}
                loading={markDeadMutation.isPending}
                onClick={() => markDeadMutation.mutate()}
                type="button"
                variant="danger"
              >
                Mark Dead
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {canConvert ? (
        <section className="mt-6 space-y-5 border-t border-divider pt-6">
          <div className="space-y-2">
            <p className="page-eyebrow">Convert</p>
            <h3 className="section-title">Create client</h3>
            <p className="text-sm leading-6 text-text-secondary">
              Conversion creates a client from the lead and links the lead to that
              client.
            </p>
          </div>

          <form
            className="space-y-5"
            id="lead-convert-form"
            onSubmit={handleConvertSubmit((values) => {
              setConvertError("");
              convertMutation.mutate(values);
            })}
          >
            <label className="block">
              <span className="field-label">Client type</span>
              <select className="field-input" {...registerConvert("type")}>
                {clientTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {convertErrors.type ? (
                <span className="mt-2 block text-sm text-error-hover">
                  {convertErrors.type.message}
                </span>
              ) : null}
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                error={convertErrors.contact_person?.message}
                label="Contact person"
                {...registerConvert("contact_person")}
              />
              <Input
                error={convertErrors.phone?.message}
                label="Phone"
                {...registerConvert("phone")}
              />
            </div>

            <Input
              error={convertErrors.email?.message}
              label="Email"
              type="email"
              {...registerConvert("email")}
            />

            <label className="block">
              <span className="field-label">Address</span>
              <textarea
                className="field-input min-h-20 resize-y"
                rows={2}
                {...registerConvert("address")}
              />
              {convertErrors.address ? (
                <span className="mt-2 block text-sm text-error-hover">
                  {convertErrors.address.message}
                </span>
              ) : null}
            </label>

            <Input
              error={convertErrors.region?.message}
              label="Region"
              {...registerConvert("region")}
            />

            <label className="block">
              <span className="field-label">Conversion notes</span>
              <textarea
                className="field-input min-h-20 resize-y"
                placeholder="Onboarding context or corrections made during conversion"
                rows={2}
                {...registerConvert("notes")}
              />
              {convertErrors.notes ? (
                <span className="mt-2 block text-sm text-error-hover">
                  {convertErrors.notes.message}
                </span>
              ) : null}
            </label>

            {convertError ? (
              <div className="rounded-lg border border-error/20 bg-error-light px-4 py-3 text-sm text-error-hover">
                {convertError}
              </div>
            ) : null}

            <Button
              leadingIcon={<Building2 className="h-4 w-4" />}
              loading={convertMutation.isPending || isConvertSubmitting}
              type="submit"
              variant="success"
            >
              Convert to Client
            </Button>
          </form>
        </section>
      ) : null}
    </Sheet>
  );
}
