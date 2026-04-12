import type { ReactNode } from "react";
import { Building2, Mail, MapPin, Phone, UserRound } from "lucide-react";

import { cn } from "@/app/cn";
import type { ClientPayload } from "@/api/clients";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { clientTypeOptions, type ClientFormErrors } from "@/features/clients/clientFormConfig";

type ClientFormProps = {
  form: ClientPayload;
  errors: ClientFormErrors;
  title: string;
  description: string;
  submitLabel: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onFieldChange: <K extends keyof ClientPayload>(key: K, value: ClientPayload[K]) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  aside?: ReactNode;
};

export function ClientForm({
  form,
  errors,
  title,
  description,
  submitLabel,
  isSubmitting,
  onCancel,
  onFieldChange,
  onSubmit,
  aside,
}: ClientFormProps) {
  const completionCount = [
    form.name,
    form.type,
    form.contact_person,
    form.phone,
    form.email,
    form.address,
    form.region,
    form.notes,
  ].filter((value) => value.trim().length > 0).length;

  return (
    <div className="mt-4 grid gap-6 2xl:grid-cols-[minmax(0,1.4fr)_360px] xl:grid-cols-[minmax(0,1fr)_320px]">
      <form className="space-y-6" onSubmit={onSubmit}>
        <header className="rounded-lg border border-border bg-card px-5 py-5 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="page-eyebrow">Clients</p>
              <h1 className="mt-2 page-title">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
                {description}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background-secondary px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-text-tertiary">
                Form progress
              </p>
              <p className="mt-2 text-2xl font-semibold text-text-primary">
                {completionCount}/8
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-lg border border-border bg-card p-5 md:p-6">
          <div className="grid gap-5 xl:grid-cols-2">
            <label className="block xl:col-span-2">
              <span className="field-label">Client type</span>
              <select
                className={cn(
                  "field-input",
                  errors.type && "border-error focus:border-error focus:ring-error/20",
                )}
                onChange={(event) => onFieldChange("type", event.target.value)}
                value={form.type}
              >
                {clientTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.type ? (
                <span className="mt-2 block text-sm text-error-hover">{errors.type}</span>
              ) : null}
            </label>

            <Input
              error={errors.name}
              label="Client name"
              leftIcon={<Building2 className="h-4 w-4" />}
              onChange={(event) => onFieldChange("name", event.target.value)}
              placeholder="St. Peter's SHS"
              value={form.name}
            />

            <Input
              error={errors.contact_person}
              label="Contact person"
              leftIcon={<UserRound className="h-4 w-4" />}
              onChange={(event) => onFieldChange("contact_person", event.target.value)}
              placeholder="Ama Mensah"
              value={form.contact_person}
            />

            <Input
              error={errors.phone}
              label="Phone"
              leftIcon={<Phone className="h-4 w-4" />}
              onChange={(event) => onFieldChange("phone", event.target.value)}
              placeholder="024 000 0000"
              value={form.phone}
            />

            <Input
              error={errors.email}
              label="Email"
              leftIcon={<Mail className="h-4 w-4" />}
              onChange={(event) => onFieldChange("email", event.target.value)}
              placeholder="info@school.edu.gh"
              value={form.email}
            />

            <Input
              error={errors.region}
              label="Region"
              leftIcon={<MapPin className="h-4 w-4" />}
              onChange={(event) => onFieldChange("region", event.target.value)}
              placeholder="Greater Accra"
              value={form.region}
            />

            <label className="block xl:col-span-2">
              <span className="field-label">Address</span>
              <textarea
                className={cn(
                  "field-input min-h-28 resize-y",
                  errors.address && "border-error focus:border-error focus:ring-error/20",
                )}
                onChange={(event) => onFieldChange("address", event.target.value)}
                placeholder="Street, district, landmark"
                rows={4}
                value={form.address}
              />
              {errors.address ? (
                <span className="mt-2 block text-sm text-error-hover">{errors.address}</span>
              ) : null}
            </label>

            <label className="block xl:col-span-2">
              <span className="field-label">Notes</span>
              <textarea
                className="field-input min-h-28 resize-y"
                onChange={(event) => onFieldChange("notes", event.target.value)}
                placeholder="Relationship context, internal reminders, billing notes"
                rows={4}
                value={form.notes}
              />
              <span className="mt-2 block text-sm text-text-secondary">
                Internal only. This stays on the client record for future proposals and
                follow-up.
              </span>
            </label>
          </div>

          {errors.detail ? (
            <div className="mt-5 rounded-lg border border-error/20 bg-error-light px-4 py-3 text-sm text-error-hover">
              {errors.detail}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-divider pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button className="w-full sm:w-auto" onClick={onCancel} type="button" variant="secondary">
              Cancel
            </Button>
            <Button className="w-full sm:w-auto" loading={isSubmitting} type="submit">
              {submitLabel}
            </Button>
          </div>
        </section>
      </form>

      <aside className="space-y-4">
        {aside ?? (
          <>
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="page-eyebrow">Record Structure</p>
              <h2 className="mt-2 section-title">What this unlocks</h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-text-secondary">
                <p>Proposals attach to this client record immediately after creation.</p>
                <p>Projects inherit the same client when a proposal is converted later.</p>
                <p>Archiving keeps history intact instead of deleting linked data.</p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <p className="page-eyebrow">Required</p>
              <h2 className="mt-2 section-title">Minimum data</h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-text-secondary">
                <p>Client name and type are mandatory.</p>
                <p>Email, phone, address, region, and notes remain optional.</p>
                <p>Use real institution names because this becomes the source record.</p>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
