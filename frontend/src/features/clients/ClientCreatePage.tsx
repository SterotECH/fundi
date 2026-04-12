import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { queryClient } from "@/app/queryClient";
import { ApiError } from "@/api/client";
import { createClient } from "@/api/clients";
import { ClientForm } from "@/features/clients/ClientForm";
import {
  clientSchema,
  type ClientFormErrors,
  type ClientFormValues,
  initialClientFormState,
  mapClientApiErrors,
  normalizeClientPayload,
} from "@/features/clients/clientFormConfig";

export function ClientCreatePage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const {
    control,
    formState: { errors },
    handleSubmit,
    setError,
    setValue,
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: initialClientFormState,
  });
  const form = useWatch({ control }) as ClientFormValues;

  const createMutation = useMutation({
    mutationFn: createClient,
    onSuccess: async (client) => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate(`/clients/${client.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const apiErrors = mapClientApiErrors(error.payload);

        Object.entries(apiErrors).forEach(([field, message]) => {
          if (field === "detail" || !message) {
            return;
          }

          setError(field as keyof ClientFormValues, { message });
        });

        setServerError(apiErrors.detail ?? "Client could not be created. Try again.");
        return;
      }

      setServerError("Client could not be created. Try again.");
    },
  });

  const clientErrors: ClientFormErrors = {
    type: errors.type?.message,
    name: errors.name?.message,
    email: errors.email?.message,
    contact_person: errors.contact_person?.message,
    phone: errors.phone?.message,
    address: errors.address?.message,
    region: errors.region?.message,
    notes: errors.notes?.message,
    detail: serverError,
  };

  const submitForm = handleSubmit((values) => {
    setServerError("");
    createMutation.mutate(normalizeClientPayload(values));
  });

  return (
    <section>
      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
        to="/clients"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to clients
      </Link>

      <ClientForm
        description="Add the organisation profile, contact details, and internal notes so proposals and projects can attach to a single record."
        errors={clientErrors}
        form={form}
        isSubmitting={createMutation.isPending}
        onCancel={() => navigate("/clients")}
        onFieldChange={(key, value) => {
          setServerError("");
          setValue(key as keyof ClientFormValues, value, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }}
        onSubmit={submitForm}
        submitLabel="Save Client"
        title="Create client"
      />
    </section>
  );
}
