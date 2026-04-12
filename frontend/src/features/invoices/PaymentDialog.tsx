import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Banknote, Building2, CreditCard, Smartphone } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import { ApiError } from "@/api/client";
import { recordPayment } from "@/api/invoices";
import { queryClient } from "@/app/queryClient";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import {
  createPaymentFormState,
  mapApiErrors,
  normalizePaymentPayload,
  paymentMethodOptions,
  paymentSchema,
  type PaymentFormErrors,
  type PaymentFormValues,
} from "@/features/invoices/invoiceFormConfig";
import { formatCurrencyValue } from "@/utils/currency";

type PaymentDialogProps = {
  invoiceId: string;
  remainingAmount: string;
  open: boolean;
  onClose: () => void;
};

const formId = "payment-form";

export function PaymentDialog({
  invoiceId,
  remainingAmount,
  open,
  onClose,
}: Readonly<PaymentDialogProps>) {
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
    setValue,
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: createPaymentFormState(),
  });
  const values = useWatch({ control });
  const amountNumber = Number.parseFloat(values.amount || "0");
  const remainingNumber = Number.parseFloat(remainingAmount || "0");
  const isOverpayment =
    !Number.isNaN(amountNumber) &&
    !Number.isNaN(remainingNumber) &&
    remainingNumber > 0 &&
    amountNumber > remainingNumber;

  const paymentMutation = useMutation({
    mutationFn: (values: PaymentFormValues) =>
      recordPayment(invoiceId, normalizePaymentPayload(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      await queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId, "payments"] });
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const apiErrors = mapApiErrors<PaymentFormErrors>(error.payload);

        if (apiErrors.amount) {
          setError("amount", { message: apiErrors.amount });
        }
        if (apiErrors.method) {
          setError("method", { message: apiErrors.method });
        }
        if (apiErrors.provider_reference) {
          setError("provider_reference", { message: apiErrors.provider_reference });
        }
        if (apiErrors.notes) {
          setError("notes", { message: apiErrors.notes });
        }
        if (apiErrors.payment_date) {
          setError("payment_date", { message: apiErrors.payment_date });
        }
        if (apiErrors.detail) {
          setError("root", { message: apiErrors.detail });
        }
        return;
      }

      setError("root", { message: "The payment could not be recorded." });
    },
  });

  const isSaving = isSubmitting || paymentMutation.isPending;

  return (
    <Sheet
      description="Record money received against this invoice. The invoice status updates from the backend."
      footer={
        <>
          <Button onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button
            form={formId}
            leadingIcon={<CreditCard className="h-4 w-4" />}
            loading={isSaving}
            type="submit"
          >
            Record Payment
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Record Payment"
    >
      <form
        className="space-y-4"
        id={formId}
        onSubmit={handleSubmit((values) => paymentMutation.mutate(values))}
      >
        {errors.root?.message ? (
          <div className="rounded-lg border border-error/25 bg-error-light px-4 py-3 text-sm text-error-hover">
            {errors.root.message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            error={errors.amount?.message}
            hint={
              isOverpayment
                ? `This is above the remaining ${formatCurrencyValue(remainingAmount)}. Overpayment is allowed.`
                : `Remaining balance: ${formatCurrencyValue(remainingAmount)}`
            }
            inputMode="decimal"
            label="Amount"
            {...register("amount")}
          />
          <Input
            error={errors.payment_date?.message}
            label="Payment date"
            type="date"
            {...register("payment_date")}
          />
        </div>

        <div>
          <span className="field-label">Payment method</span>
          <input type="hidden" {...register("method")} />
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {paymentMethodOptions.map((method) => (
              <button
                className={`inline-flex items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm font-semibold transition-colors ${
                  values.method === method.value
                    ? "border-primary bg-primary-light text-primary-dark"
                    : "border-border bg-card text-text-secondary hover:border-border-hover hover:bg-card-hover hover:text-text-primary"
                }`}
                key={method.value}
                onClick={() => setValue("method", method.value, { shouldValidate: true })}
                type="button"
              >
                {method.value === "bank" ? (
                  <Building2 className="h-4 w-4" />
                ) : method.value === "cash" ? (
                  <Banknote className="h-4 w-4" />
                ) : (
                  <Smartphone className="h-4 w-4" />
                )}
                {method.label}
              </button>
            ))}
          </div>
          {errors.method?.message ? (
            <span className="mt-2 block text-sm text-error-hover" role="alert">
              {errors.method.message}
            </span>
          ) : null}
        </div>

        <Input
          error={errors.provider_reference?.message}
          label="Provider reference"
          placeholder="Transaction ID, cheque number, or bank reference"
          {...register("provider_reference")}
        />

        <label className="block">
          <span className="field-label">Notes</span>
          <textarea
            className="field-input min-h-24 resize-y"
            placeholder="Internal payment note"
            {...register("notes")}
          />
          {errors.notes?.message ? (
            <span className="mt-2 block text-sm text-error-hover" role="alert">
              {errors.notes.message}
            </span>
          ) : null}
        </label>
      </form>
    </Sheet>
  );
}
