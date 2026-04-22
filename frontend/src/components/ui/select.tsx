import * as React from "react"
import { cn } from "@/lib/cn"
import { ChevronDown } from "lucide-react"

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { label: string; value: string }[]
  icon?: React.ReactNode
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, icon, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            "w-full px-4 py-2 rounded-lg bg-panel-light border border-cyan/30 hover:border-cyan/50",
            "text-text-0 appearance-none cursor-pointer",
            "focus:outline-none focus:border-cyan focus:ring-2 focus:ring-cyan/30",
            "transition-all duration-200 pr-10",
            className
          )}
          ref={ref}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-2 pointer-events-none" />
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }
