import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus, SquareArrowOutUpRight } from "lucide-react";

import { cn } from "@/app/cn";
import { AppIcon } from "@/components/icons/system";

type StatCardColor =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "error"
  | "danger"
  | "info"
  | "purple"
  | "ocean"
  | "sunset"
  | "forest"
  | "midnight"
  | "flamingo"
  | "neutral";

type StatCardSize = "sm" | "default" | "lg";
type StatCardTrend = "up" | "down" | "flat" | null;

type StatCardProps = {
  animated?: boolean;
  badge?: string | null;
  color?: StatCardColor;
  description?: string | null;
  href?: string | null;
  icon?: LucideIcon | null;
  label?: string;
  loading?: boolean;
  size?: StatCardSize;
  title?: string;
  trend?: StatCardTrend;
  trendValue?: string | null;
  value?: string | number;
};

const sizeClasses: Record<
  StatCardSize,
  {
    body: string;
    iconBox: string;
    iconGlyph: string;
    value: string;
  }
> = {
  sm: {
    body: "p-4",
    iconBox: "h-10 w-10",
    iconGlyph: "h-5 w-5",
    value: "text-lg",
  },
  default: {
    body: "p-6",
    iconBox: "h-12 w-12",
    iconGlyph: "h-6 w-6",
    value: "text-2xl",
  },
  lg: {
    body: "p-8",
    iconBox: "h-16 w-16",
    iconGlyph: "h-8 w-8",
    value: "text-3xl",
  },
};

const colorClasses: Record<
  StatCardColor,
  {
    border: string;
    hoverBorder: string;
    hoverShadow: string;
    iconBg: string;
    iconColor: string;
    overlay: string;
    title: string;
    trendBg: string;
    trendColor: string;
  }
> = {
  primary: {
    border: "border-primary/15",
    hoverBorder: "group-hover:border-primary/35",
    hoverShadow: "group-hover:shadow-[0_16px_30px_color-mix(in_srgb,var(--primary)_14%,transparent)]",
    iconBg: "bg-primary/12 group-hover:bg-primary/18",
    iconColor: "text-primary",
    overlay: "from-primary/14 via-primary/6 to-transparent",
    title: "group-hover:text-primary",
    trendBg: "bg-primary/12",
    trendColor: "text-primary",
  },
  secondary: {
    border: "border-secondary/15",
    hoverBorder: "group-hover:border-secondary/35",
    hoverShadow: "group-hover:shadow-[0_16px_30px_color-mix(in_srgb,var(--secondary)_14%,transparent)]",
    iconBg: "bg-secondary/12 group-hover:bg-secondary/18",
    iconColor: "text-secondary",
    overlay: "from-secondary/14 via-secondary/6 to-transparent",
    title: "group-hover:text-secondary",
    trendBg: "bg-secondary/12",
    trendColor: "text-secondary",
  },
  success: {
    border: "border-success/15",
    hoverBorder: "group-hover:border-success/35",
    hoverShadow: "group-hover:shadow-[0_16px_30px_color-mix(in_srgb,var(--success)_14%,transparent)]",
    iconBg: "bg-success/12 group-hover:bg-success/18",
    iconColor: "text-success-hover",
    overlay: "from-success/14 via-success/6 to-transparent",
    title: "group-hover:text-success-hover",
    trendBg: "bg-success/12",
    trendColor: "text-success-hover",
  },
  warning: {
    border: "border-warning/15",
    hoverBorder: "group-hover:border-warning/35",
    hoverShadow: "group-hover:shadow-[0_16px_30px_color-mix(in_srgb,var(--warning)_14%,transparent)]",
    iconBg: "bg-warning/12 group-hover:bg-warning/18",
    iconColor: "text-warning-hover",
    overlay: "from-warning/14 via-warning/6 to-transparent",
    title: "group-hover:text-warning-hover",
    trendBg: "bg-warning/12",
    trendColor: "text-warning-hover",
  },
  error: {
    border: "border-error/15",
    hoverBorder: "group-hover:border-error/35",
    hoverShadow: "group-hover:shadow-[0_16px_30px_color-mix(in_srgb,var(--error)_14%,transparent)]",
    iconBg: "bg-error/12 group-hover:bg-error/18",
    iconColor: "text-error-hover",
    overlay: "from-error/14 via-error/6 to-transparent",
    title: "group-hover:text-error-hover",
    trendBg: "bg-error/12",
    trendColor: "text-error-hover",
  },
  danger: {
    border: "border-error/18",
    hoverBorder: "group-hover:border-error/40",
    hoverShadow: "group-hover:shadow-[0_16px_30px_color-mix(in_srgb,var(--error)_18%,transparent)]",
    iconBg: "bg-error/14 group-hover:bg-error/20",
    iconColor: "text-error-hover",
    overlay: "from-error/16 via-error/7 to-transparent",
    title: "group-hover:text-error-hover",
    trendBg: "bg-error/14",
    trendColor: "text-error-hover",
  },
  info: {
    border: "border-info/15",
    hoverBorder: "group-hover:border-info/35",
    hoverShadow: "group-hover:shadow-[0_16px_30px_color-mix(in_srgb,var(--info)_14%,transparent)]",
    iconBg: "bg-info/12 group-hover:bg-info/18",
    iconColor: "text-info-hover",
    overlay: "from-info/14 via-info/6 to-transparent",
    title: "group-hover:text-info-hover",
    trendBg: "bg-info/12",
    trendColor: "text-info-hover",
  },
  purple: {
    border: "border-primary/18",
    hoverBorder: "group-hover:border-primary/40",
    hoverShadow: "group-hover:shadow-[0_16px_30px_color-mix(in_srgb,var(--primary)_18%,transparent)]",
    iconBg: "bg-primary/14 group-hover:bg-primary/20",
    iconColor: "text-primary",
    overlay: "from-primary/16 via-primary/8 to-transparent",
    title: "group-hover:text-primary",
    trendBg: "bg-primary/14",
    trendColor: "text-primary",
  },
  ocean: {
    border: "border-info/18",
    hoverBorder: "group-hover:border-info/40",
    hoverShadow: "group-hover:shadow-[0_16px_30px_color-mix(in_srgb,var(--info)_16%,transparent)]",
    iconBg: "bg-info/14 group-hover:bg-info/20",
    iconColor: "text-info-hover",
    overlay: "from-info/16 via-info/8 to-transparent",
    title: "group-hover:text-info-hover",
    trendBg: "bg-info/14",
    trendColor: "text-info-hover",
  },
  sunset: {
    border: "border-warning/18",
    hoverBorder: "group-hover:border-warning/40",
    hoverShadow: "group-hover:shadow-[0_16px_30px_color-mix(in_srgb,var(--warning)_16%,transparent)]",
    iconBg: "bg-warning/14 group-hover:bg-warning/20",
    iconColor: "text-warning-hover",
    overlay: "from-warning/16 via-error/8 to-transparent",
    title: "group-hover:text-warning-hover",
    trendBg: "bg-warning/14",
    trendColor: "text-warning-hover",
  },
  forest: {
    border: "border-success/18",
    hoverBorder: "group-hover:border-success/40",
    hoverShadow: "group-hover:shadow-[0_16px_30px_color-mix(in_srgb,var(--success)_16%,transparent)]",
    iconBg: "bg-success/14 group-hover:bg-success/20",
    iconColor: "text-success-hover",
    overlay: "from-success/16 via-secondary/8 to-transparent",
    title: "group-hover:text-success-hover",
    trendBg: "bg-success/14",
    trendColor: "text-success-hover",
  },
  midnight: {
    border: "border-text-primary/10",
    hoverBorder: "group-hover:border-text-primary/20",
    hoverShadow: "group-hover:shadow-[0_16px_30px_color-mix(in_srgb,var(--text-primary)_10%,transparent)]",
    iconBg: "bg-text-primary/8 group-hover:bg-text-primary/12",
    iconColor: "text-text-primary",
    overlay: "from-text-primary/10 via-text-primary/4 to-transparent",
    title: "group-hover:text-text-primary",
    trendBg: "bg-text-primary/10",
    trendColor: "text-text-primary",
  },
  flamingo: {
    border: "border-error/16",
    hoverBorder: "group-hover:border-error/38",
    hoverShadow: "group-hover:shadow-[0_16px_30px_color-mix(in_srgb,var(--error)_16%,transparent)]",
    iconBg: "bg-error/12 group-hover:bg-error/18",
    iconColor: "text-error-hover",
    overlay: "from-error/16 via-primary/6 to-transparent",
    title: "group-hover:text-error-hover",
    trendBg: "bg-error/12",
    trendColor: "text-error-hover",
  },
  neutral: {
    border: "border-border/70",
    hoverBorder: "group-hover:border-border-hover",
    hoverShadow: "group-hover:shadow-[0_14px_24px_color-mix(in_srgb,var(--text-primary)_6%,transparent)]",
    iconBg: "bg-muted-background group-hover:bg-card-hover",
    iconColor: "text-icon-active",
    overlay: "from-muted-background/80 via-card/20 to-transparent",
    title: "group-hover:text-text-primary",
    trendBg: "bg-muted-background",
    trendColor: "text-text-secondary",
  },
};

function formatValue(value: string | number | undefined) {
  if (typeof value === "number") {
    return value.toLocaleString();
  }
  return value ?? "---";
}

function getTrendIcon(trend: StatCardTrend) {
  if (trend === "up") return <ArrowUpRight className="h-3.5 w-3.5" />;
  if (trend === "down") return <ArrowDownRight className="h-3.5 w-3.5" />;
  if (trend === "flat") return <Minus className="h-3.5 w-3.5" />;
  return null;
}

function LoadingState({
  classes,
  sizing,
  icon,
  badge,
  description,
}: Readonly<{
  classes: (typeof colorClasses)[StatCardColor];
  sizing: (typeof sizeClasses)[StatCardSize];
  icon?: LucideIcon | null;
  badge?: string | null;
  description?: string | null;
}>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card/80",
        classes.border,
        sizing.body,
      )}
    >
      <div className="animate-shimmer absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] bg-size-[200%_100%]" />
      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {icon ? (
              <div className={cn("rounded-lg bg-muted-background", sizing.iconBox)} />
            ) : null}
            <div className="space-y-2">
              <div className="h-3 w-24 rounded bg-muted-background" />
              <div className="h-8 w-20 rounded bg-muted-background" />
            </div>
          </div>
          {badge ? <div className="h-6 w-16 rounded-full bg-muted-background" /> : null}
        </div>
        {description ? (
          <div className="mt-4 h-3 w-3/4 rounded bg-muted-background" />
        ) : null}
      </div>
    </div>
  );
}

function TrendBadge({
  trend,
  trendValue,
  classes,
}: Readonly<{
  trend: StatCardTrend;
  trendValue: string | null;
  classes: (typeof colorClasses)[StatCardColor];
}>) {
  if (!trend || !trendValue) return null;

  return (
    <div className="mt-2 flex items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
          classes.trendBg,
          classes.trendColor,
        )}
      >
        {getTrendIcon(trend)}
        <span>{trendValue}</span>
      </span>
      <span className="text-xs text-text-tertiary">vs last period</span>
    </div>
  );
}

function IconBox({
  icon,
  sizing,
  classes,
  animated,
}: Readonly<{
  icon: LucideIcon | null;
  sizing: (typeof sizeClasses)[StatCardSize];
  classes: (typeof colorClasses)[StatCardColor];
  animated: boolean;
}>) {
  if (!icon) return null;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border border-current/5 transition-transform duration-200",
        sizing.iconBox,
        classes.iconBg,
        classes.iconColor,
        animated && "group-hover:scale-[1.04]",
      )}
    >
      <AppIcon className={sizing.iconGlyph} icon={icon} />
    </div>
  );
}

function BadgeLabel({
  badge,
  classes,
}: Readonly<{
  badge: string | null;
  classes: (typeof colorClasses)[StatCardColor];
}>) {
  if (!badge) return null;

  return (
    <span
      className={cn(
        "shrink-0 rounded-full border border-current/10 px-3 py-1 text-xs font-semibold",
        classes.trendBg,
        classes.trendColor,
      )}
    >
      {badge}
    </span>
  );
}

export function StatCard({
  animated = true,
  badge = null,
  color = "primary",
  description = null,
  href = null,
  icon = null,
  label,
  loading = false,
  size = "default",
  title,
  trend = null,
  trendValue = null,
  value = "---",
}: Readonly<StatCardProps>) {
  const resolvedLabel = label || title || "";
  const classes = colorClasses[color];
  const sizing = sizeClasses[size];
  const Component = href ? "a" : "div";

  if (loading) {
    return <LoadingState classes={classes} sizing={sizing} icon={icon} badge={badge} description={description} />;
  }

  return (
    <Component
      {...(href ? { href } : {})}
      className={cn(
        "group relative block overflow-hidden rounded-lg border bg-card/80 backdrop-blur-sm transition-all duration-200",
        classes.border,
        classes.hoverBorder,
        classes.hoverShadow,
        animated && "hover:-translate-y-0.5",
        href && "cursor-pointer",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 bg-linear-to-tr opacity-100 transition-opacity duration-200",
          classes.overlay,
        )}
      />

      <div className={cn("relative", sizing.body)}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-4">
              <IconBox icon={icon} sizing={sizing} classes={classes} animated={animated} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-secondary">
                  {resolvedLabel}
                </p>
                <p
                  className={cn(
                    "mt-1 font-bold leading-tight text-text-primary transition-colors duration-200",
                    sizing.value,
                    classes.title,
                  )}
                >
                  {formatValue(value)}
                </p>

                <TrendBadge trend={trend} trendValue={trendValue} classes={classes} />
              </div>
            </div>
          </div>

          <BadgeLabel badge={badge} classes={classes} />
        </div>

        {description ? (
          <p className="mt-4 text-xs leading-6 text-text-tertiary">{description}</p>
        ) : null}

        {href ? (
          <div className="absolute right-6 top-6 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 translate-x-1">
            <SquareArrowOutUpRight className="h-4 w-4 text-text-tertiary" />
          </div>
        ) : null}
      </div>
    </Component>
  );
}
