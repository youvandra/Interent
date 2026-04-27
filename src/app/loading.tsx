import { SquareSpinner } from "@/components/ui/square-spinner";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-md">
      <div className="flex items-center gap-3 rounded-xl border border-[--color-border] bg-white/80 px-4 py-3 text-sm text-[--color-muted] shadow-[0_12px_48px_rgba(16,24,40,0.12)]">
        <SquareSpinner className="h-5 w-5" />
        <span>Loading…</span>
      </div>
    </div>
  );
}
