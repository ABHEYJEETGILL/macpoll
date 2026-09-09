import { ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-mcmaster-maroon text-white hover:bg-mcmaster-maroon/90 focus-visible:ring-mcmaster-gold disabled:opacity-50",
  secondary:
    "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-slate-400 disabled:opacity-50",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400 disabled:opacity-50",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-400 disabled:opacity-50"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2",
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";