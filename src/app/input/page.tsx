import { Suspense } from "react";
import { InputClient } from "./input-client";

export const dynamic = "force-dynamic";

export default function InputPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[--color-muted]">Loading…</div>}>
      <InputClient />
    </Suspense>
  );
}
