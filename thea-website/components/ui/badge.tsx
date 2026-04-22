import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-thea-primary focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-thea-dark",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-thea-primary text-white hover:bg-thea-primary/80",
        secondary:
          "border-transparent bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/15",
        destructive:
          "border-transparent bg-red-500 text-white hover:bg-red-500/80",
        outline:
          "border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
