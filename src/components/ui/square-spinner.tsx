import * as React from "react";
import { cn } from "@/lib/utils";

export function SquareSpinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        // Square outline spinner (one side transparent) to create a sharp rotating feel.
        "inline-block h-4 w-4 animate-spin border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

