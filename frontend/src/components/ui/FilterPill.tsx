import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/app/cn";

type FilterPillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  activeClassName?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export function FilterPill({
  active = false,
  activeClassName,
  children,
  className,
  leadingIcon,
  trailingIcon,
  type = "button",
  ...props
}: FilterPillProps) {
  return (
    <button
      className={cn("filter-pill", active && "filter-pill-active", className, active && activeClassName)}
      type={type}
      {...props}
    >
      {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
      <span>{children}</span>
      {trailingIcon ? <span className="shrink-0">{trailingIcon}</span> : null}
    </button>
  );
}
