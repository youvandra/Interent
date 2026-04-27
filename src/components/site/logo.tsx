import * as React from "react";

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={["inline-flex items-center gap-2", className ?? ""].join(" ")}>
      {/* Mark: simple geometric monogram built from rectangles (minimal, sharp) */}
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 22 22"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="1" y="1" width="20" height="20" stroke="currentColor" strokeWidth="2" />
        <rect x="6" y="6" width="2" height="10" fill="currentColor" />
        <rect x="14" y="6" width="2" height="10" fill="currentColor" />
        <rect x="8.5" y="10" width="5" height="2" fill="currentColor" />
      </svg>

      {showWordmark ? (
        <span className="text-sm font-semibold tracking-tight">Interent</span>
      ) : null}
    </span>
  );
}

