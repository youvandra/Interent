import { Suspense } from "react";
import { InputClient } from "./input-client";
import { SquareSpinner } from "@/components/ui/square-spinner";

export const dynamic = "force-dynamic";

export default function InputPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-[--color-muted]">
          <SquareSpinner />
          <span>Loading…</span>
        </div>
      }
    >
      <InputClient />
    </Suspense>
  );
}
