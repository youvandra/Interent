import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[--color-border] bg-[--color-surface] px-2.5 py-1 text-xs font-medium text-[--color-text]",
        className,
      )}
      {...props}
    />
  );
}

