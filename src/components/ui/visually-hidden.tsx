"use client"

import * as React from "react"
import * as VisuallyHiddenPrimitive from "@radix-ui/react-visually-hidden"

import { cn } from "@/lib/utils"

const VisuallyHidden = React.forwardRef<
  React.ElementRef<typeof VisuallyHiddenPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof VisuallyHiddenPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <VisuallyHiddenPrimitive.Root
      ref={ref}
      className={cn(
        "absolute -m-px h-px w-px overflow-hidden whitespace-nowrap",
        className
      )}
      {...props}
    />
  )
})
VisuallyHidden.displayName = "VisuallyHidden"

export { VisuallyHidden }
