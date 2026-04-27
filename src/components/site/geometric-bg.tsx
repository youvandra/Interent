export function GeometricBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Subtle geometric patterns (low opacity) */}
      <svg
        className="absolute -left-24 -top-24 h-[420px] w-[420px] opacity-[0.10]"
        viewBox="0 0 420 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="210" cy="210" r="140" stroke="var(--primary)" strokeWidth="2" />
        <circle cx="210" cy="210" r="95" stroke="var(--primary)" strokeWidth="2" />
        <circle cx="210" cy="210" r="50" stroke="var(--primary)" strokeWidth="2" />
      </svg>

      <svg
        className="absolute -right-28 top-24 h-[520px] w-[520px] opacity-[0.08]"
        viewBox="0 0 520 520"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="70" y="70" width="380" height="380" stroke="var(--primary)" strokeWidth="2" />
        <rect
          x="130"
          y="130"
          width="260"
          height="260"
          stroke="var(--primary)"
          strokeWidth="2"
        />
        <path
          d="M70 260H450"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeDasharray="6 8"
        />
        <path
          d="M260 70V450"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeDasharray="6 8"
        />
      </svg>

      {/* Dot grid */}
      <div
        className="absolute bottom-[-120px] left-[10%] h-[320px] w-[520px] opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(65,1,246,0.9) 1px, transparent 0)",
          backgroundSize: "18px 18px",
        }}
      />

      {/* Soft gradient blobs (very subtle) */}
      <div className="absolute left-[30%] top-[-140px] h-[280px] w-[280px] rounded-full bg-[--color-primary-soft] opacity-[0.35] blur-2xl" />
      <div className="absolute right-[20%] bottom-[-160px] h-[320px] w-[320px] rounded-full bg-[--color-primary-soft] opacity-[0.25] blur-2xl" />
    </div>
  );
}

