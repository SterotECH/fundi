import { useId, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/app/cn";

type InputVariant = "default" | "hud";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  error?: string;
  hint?: string;
  label?: string;
  leftIcon?: ReactNode;
  shellClassName?: string;
  variant?: InputVariant;
  wrapperClassName?: string;
};

export function Input({
  className,
  error,
  hint,
  id,
  label,
  leftIcon,
  shellClassName,
  variant = "default",
  wrapperClassName,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const labelClassName =
    variant === "hud" ? "hud-label" : "field-label";

  const messageClassName = cn(
    "mt-2 text-sm",
    error ? "text-error-hover" : "text-text-secondary",
  );

   if (variant === "hud") {
     return (
       <label className={cn("block", wrapperClassName)} htmlFor={inputId}>
         {label ? <span className={labelClassName}>{label}</span> : null}
         <span className={cn("field-shell mt-3 border-info/20 bg-white/5", shellClassName)}>
           {leftIcon ? (
             <span className="shrink-0 text-info">{leftIcon}</span>
           ) : null}
           <input
             className={cn("text-white placeholder:text-white/38", className)}
             id={inputId}
             {...props}
           />
         </span>
         {error ? (
           <span className={cn("flex items-center gap-2", messageClassName)} role="alert">
             {error}
           </span>
         ) : hint ? (
           <span className={messageClassName}>{hint}</span>
         ) : null}
       </label>
     );
   }

   return (
     <label className={cn("block", wrapperClassName)} htmlFor={inputId}>
       {label ? <span className={labelClassName}>{label}</span> : null}
       <input className={cn("field-input", className)} id={inputId} {...props} />
       {error ? (
         <span className={messageClassName} role="alert">
           {error}
         </span>
       ) : hint ? (
         <span className={messageClassName}>{hint}</span>
       ) : null}
     </label>
   );
}
