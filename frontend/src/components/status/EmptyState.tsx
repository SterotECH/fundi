import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";

import { cn } from "@/app/cn";
import { systemIcons } from "@/components/icons/glyphs";
import { AppIcon } from "@/components/icons/system";
import { Button } from "@/components/ui/Button";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  actionLabel?: string;
  actionHref?: string;
  animated?: boolean;
  color?: "primary" | "secondary" | "success" | "warning" | "error" | "info";
  framed?: boolean;
  icon?: LucideIcon;
  size?: "sm" | "default" | "lg";
  tone?: "neutral" | "error";
  variant?: "primary" | "secondary" | "hud" | "ghost";
};

export function EmptyState({
  action,
  actionHref,
  actionLabel,
  animated = true,
  color,
  description,
  framed = true,
  icon,
  size = "default",
  title,
  tone = "neutral",
  variant = "ghost",
}: EmptyStateProps) {
  const Icon = icon ?? (tone === "error" ? systemIcons.alertTriangle : systemIcons.inbox);
  const resolvedColor = color ?? (tone === "error" ? "error" : "secondary");

  const sizeClasses = {
    sm: {
      container: "py-6",
      icon: "h-12 w-12 p-2",
      iconInner: "h-8 w-8",
      title: "text-base",
      description: "text-sm",
    },
    default: {
      container: "py-10",
      icon: "h-16 w-16 p-3",
      iconInner: "h-10 w-10",
      title: "text-lg",
      description: "text-sm",
    },
    lg: {
      container: "py-16",
      icon: "h-20 w-20 p-4",
      iconInner: "h-12 w-12",
      title: "text-xl",
      description: "text-base",
    },
  }[size];

  const colorClasses = {
    success: {
      iconBg: "bg-success-light",
      iconColor: "text-success-hover",
      border: "border-success/20",
    },
    warning: {
      iconBg: "bg-warning-light",
      iconColor: "text-warning-hover",
      border: "border-warning/20",
    },
    error: {
      iconBg: "bg-error-light",
      iconColor: "text-error-hover",
      border: "border-error/20",
    },
    info: {
      iconBg: "bg-info-light",
      iconColor: "text-info-hover",
      border: "border-info/20",
    },
    primary: {
      iconBg: "bg-primary-light",
      iconColor: "text-primary",
      border: "border-primary/20",
    },
    secondary: {
      iconBg: "bg-secondary-light",
      iconColor: "text-secondary",
      border: "border-secondary/20",
    },
  }[resolvedColor];

  const buttonVariant = variant === "ghost" ? "secondary" : variant;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        framed && "rounded-lg border border-border bg-card",
        sizeClasses.container,
        animated && "transition-all duration-300 ease-out",
      )}
    >
      <div
        className={cn(
          "mb-4 flex items-center justify-center rounded-xl border transition-all duration-300",
          sizeClasses.icon,
          colorClasses.iconBg,
          colorClasses.border,
          animated && "hover:scale-105",
        )}
      >
        <AppIcon className={cn(sizeClasses.iconInner, colorClasses.iconColor)} icon={Icon} />
      </div>

      <h3 className={cn("font-syne font-semibold text-text-primary", sizeClasses.title)}>
        {title}
      </h3>

      <p
        className={cn(
          "mt-2 max-w-sm leading-relaxed text-text-secondary",
          sizeClasses.description,
        )}
      >
        {description}
      </p>

      {action ? <div className="mt-6">{action}</div> : null}

      {!action && actionLabel && actionHref ? (
        <Link className="button-secondary mt-6" to={actionHref}>
          {actionLabel}
        </Link>
      ) : null}

      {!action && actionLabel && !actionHref ? (
        <Button className="mt-6" variant={buttonVariant}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
