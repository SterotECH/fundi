const statusStyles: Record<string, string> = {
  active: "bg-success-light text-secondary-dark",
  archived: "bg-muted-background text-muted-foreground",
  contacted: "bg-info-light text-info-hover",
  converted: "bg-success-light text-secondary-dark",
  dead: "bg-error-light text-error-hover",
  done: "bg-success-light text-secondary-dark",
  draft: "bg-muted-background text-muted-foreground",
  hold: "bg-warning-light text-warning-hover",
  lost: "bg-error-light text-error-hover",
  negotiating: "bg-warning-light text-warning-hover",
  new: "bg-muted-background text-muted-foreground",
  planning: "bg-info-light text-info-hover",
  qualified: "bg-primary-light text-primary-dark",
  sent: "bg-info-light text-info-hover",
  shs: "bg-muted-background text-muted-foreground",
  uni: "bg-muted-background text-muted-foreground",
  other: "bg-muted-background text-muted-foreground",
  won: "bg-success-light text-secondary-dark",
};

export function StatusBadge({ status }: { status: string }) {
  const className =
    statusStyles[status] || "bg-muted-background text-muted-foreground";
  const label = status.replaceAll("_", " ");

  return (
    <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}
