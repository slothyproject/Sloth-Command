import * as React from "react"
import { cn } from "@/lib/cn"

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  count?: number
  height?: "sm" | "md" | "lg"
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, count = 1, height = "md", ...props }, ref) => {
    const heightClasses = {
      sm: "h-4",
      md: "h-6",
      lg: "h-12",
    }

    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            ref={i === 0 ? ref : null}
            className={cn(
              "rounded-lg bg-gradient-to-r from-cyan/10 via-cyan/5 to-cyan/10 animate-pulse",
              heightClasses[height],
              i > 0 && "mt-2",
              className
            )}
            {...props}
          />
        ))}
      </>
    )
  }
)
Skeleton.displayName = "Skeleton"

export { Skeleton }
