import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/app/cn";

type ButtonVariant = "primary" | "secondary" | "hud" | "danger" | "success";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary: "button-primary",
  secondary: "button-secondary",
  danger: "button-danger",
  success: "button-success",
  hud: "inline-flex items-center justify-center gap-2 rounded-md border border-info/35 bg-primary px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:border-info/55 hover:bg-primary-hover hover:shadow-[0_0_28px_color-mix(in_srgb,var(--primary)_38%,transparent)] focus:outline-2 focus:outline-offset-2 focus:outline-ring",
};

export function Button({
  children,
  className,
  disabled,
  leadingIcon,
  loading = false,
  trailingIcon,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={cn(
        variants[variant],
        isDisabled && "cursor-not-allowed opacity-75",
        className,
      )}
      disabled={isDisabled}
      type={type}
      {...props}
    >
      {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
      <span>{children}</span>
      {trailingIcon ? <span className="shrink-0">{trailingIcon}</span> : null}
    </button>
  );
}
