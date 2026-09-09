import { InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";
 
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}
 
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm",
            "placeholder:text-slate-400",
            "focus:outline-none focus:ring-2 focus:ring-mcmaster-maroon focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);
 
Input.displayName = "Input";