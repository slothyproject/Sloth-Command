import * as React from "react"
import { cn } from "@/lib/cn"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info"
  size?: "sm" | "md"
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", size = "sm", ...props }, ref) => {
    const variantClasses = {
      default: "bg-cyan/20 text-cyan border border-cyan/40",
      success: "bg-lime/20 text-lime border border-lime/40",
      warning: "bg-amber/20 text-amber border border-amber/40",
      danger: "bg-danger/20 text-danger border border-danger/40",
      info: "bg-cyan/20 text-cyan-light border border-cyan/40",
    }

    const sizeClasses = {
      sm: "px-2 py-0.5 text-xs font-medium",
      md: "px-3 py-1 text-sm font-medium",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-md font-semibold transition-colors",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }
