import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary] focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-9 px-3 text-sm" : "h-10 px-4 text-sm",
        variant === "primary" &&
          "text-white [background:var(--cta-gradient)] hover:opacity-95",
        variant === "secondary" &&
          "border border-[--color-border] bg-white text-[--color-text] hover:bg-[--color-surface]",
        variant === "ghost" &&
          "bg-transparent text-[--color-text] hover:bg-[--color-surface]",
        className,
      )}
      {...props}
    />
  );
}
