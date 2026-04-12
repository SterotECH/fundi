import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

import { queryClient } from "@/app/queryClient";
import { ApiError } from "@/api/client";
import { getClient, updateClient } from "@/api/clients";
import { EmptyState } from "@/components/status/EmptyState";
import { LoadingState } from "@/components/status/LoadingState";
import { ClientForm } from "@/features/clients/ClientForm";
import {
  clientSchema,
  type ClientFormErrors,
  type ClientFormValues,
  mapClientApiErrors,
  normalizeClientPayload,
} from "@/features/clients/clientFormConfig";

function ClientEditFormInner({
  clientId,
  initialForm,
}: {
  clientId: string;
  initialForm: ClientFormValues;
}) {
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
    defaultValues: initialForm,
  });
  const form = useWatch({ control }) as ClientFormValues;

  const updateMutation = useMutation({
    mutationFn: (payload: ClientFormValues) =>
      updateClient(clientId, normalizeClientPayload(payload)),
    onSuccess: async (client) => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["client", clientId] });
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

        setServerError(apiErrors.detail ?? "Client could not be updated. Try again.");
        return;
      }

      setServerError("Client could not be updated. Try again.");
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
    updateMutation.mutate(values);
  });

  return (
    <ClientForm
      description="Update the organisation profile and contact details without changing the linked proposals or project history."
      errors={clientErrors}
      form={form}
      isSubmitting={updateMutation.isPending}
      onCancel={() => navigate(`/clients/${clientId}`)}
      onFieldChange={(key, value) => {
        setServerError("");
        setValue(key as keyof ClientFormValues, value, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }}
      onSubmit={submitForm}
      submitLabel="Save Changes"
      title="Edit client"
    />
  );
}

export function ClientEditPage() {
  const { clientId = "" } = useParams();
  const clientQuery = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClient(clientId),
    enabled: Boolean(clientId),
  });

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

  return (
    <section>
      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
        to={`/clients/${clientId}`}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to client
      </Link>

      <ClientEditFormInner
        clientId={clientId}
        initialForm={{
          type: client.type as ClientFormValues["type"],
          name: client.name,
          email: client.email ?? "",
          contact_person: client.contact_person ?? "",
          phone: client.phone ?? "",
          address: client.address ?? "",
          region: client.region ?? "",
          notes: client.notes ?? "",
        }}
        key={client.id}
      />
    </section>
  );
}
