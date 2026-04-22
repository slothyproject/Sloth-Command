import * as React from "react"
import { cn } from "@/lib/cn"
import { Card, CardContent } from "./card"

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  label: string
  value: string | number
  subtext?: string
  trend?: { value: number; isPositive: boolean }
  isLoading?: boolean
  size?: "sm" | "md" | "lg"
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    { icon, label, value, subtext, trend, isLoading, size = "md", className, ...props },
    ref
  ) => {
    const sizeClasses = {
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
    }

    return (
      <Card
        ref={ref}
        variant="elevated"
        isGlowing
        className={cn(
          "group relative overflow-hidden transition-all duration-300 hover:shadow-neon-edge hover:border-cyan/50",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan/5 via-transparent to-lime/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <CardContent className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            {icon && (
              <div className="p-2 rounded-lg bg-cyan/10 group-hover:bg-cyan/20 transition-colors">
                {icon}
              </div>
            )}
            {trend && (
              <div
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-semibold",
                  trend.isPositive
                    ? "bg-lime/20 text-lime"
                    : "bg-danger/20 text-danger"
                )}
              >
                {trend.isPositive ? "+" : ""}{trend.value}%
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-text-2">{label}</p>
            {isLoading ? (
              <div className="h-8 bg-gradient-to-r from-cyan/20 to-cyan/10 rounded animate-pulse" />
            ) : (
              <h3 className="text-3xl font-bold text-cyan">{value}</h3>
            )}
            {subtext && (
              <p className="text-xs text-text-3 group-hover:text-text-2 transition-colors">
                {subtext}
              </p>
            )}
          </div>
        </CardContent>

        {/* Glowing border effect on hover */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan/0 via-cyan/0 to-lime/0 group-hover:from-cyan/10 group-hover:via-cyan/5 group-hover:to-lime/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300" />
      </Card>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard }
