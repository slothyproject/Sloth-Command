import * as React from "react"
import { cn } from "@/lib/cn"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, error, type, ...props }, ref) => {
    return (
      <div className="relative">
        <input
          type={type}
          className={cn(
            "w-full px-4 py-2 rounded-lg bg-panel-light border border-cyan/30 hover:border-cyan/50",
            "text-text-0 placeholder-text-3",
            "focus:outline-none focus:border-cyan focus:ring-2 focus:ring-cyan/30",
            "transition-all duration-200",
            icon && "pl-10",
            error && "border-danger focus:ring-danger/30",
            className
          )}
          ref={ref}
          {...props}
        />
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-2 pointer-events-none">
            {icon}
          </div>
        )}
        {error && (
          <p className="text-xs text-danger mt-1">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
