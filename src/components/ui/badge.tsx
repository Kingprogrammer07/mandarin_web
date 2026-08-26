import * as React from "react"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
// Kept out of this file so it exports components only — otherwise every edit
// here drops Fast Refresh back to a full reload.
import { badgeVariants } from "@/components/ui/badge-variants"

function Badge({
    className,
    variant,
    ...props
}: React.ComponentProps<"div"> & VariantProps<typeof badgeVariants>) {
    return (
        <div
            data-slot="badge"
            className={cn(badgeVariants({ variant }), className)}
            {...props}
        />
    )
}

export { Badge }
