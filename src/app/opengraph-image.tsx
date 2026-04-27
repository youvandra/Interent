import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

function Mark() {
  return (
    <div
      style={{
        width: 180,
        height: 180,
        border: "10px solid #111827",
        borderRadius: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        background: "white",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 54,
          top: 46,
          width: 16,
          height: 92,
          background: "#111827",
          borderRadius: 8,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 54,
          top: 46,
          width: 16,
          height: 92,
          background: "#111827",
          borderRadius: 8,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 62,
          height: 16,
          background: "#111827",
          borderRadius: 8,
        }}
      />
    </div>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 72,
          background: "white",
          color: "#111827",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 760 }}>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -1 }}>Interent</div>
          <div style={{ fontSize: 30, lineHeight: 1.25, color: "#374151" }}>
            Pay-per-use AI microservices marketplace for agents.
          </div>
          <div style={{ fontSize: 22, color: "#6B7280" }}>
            OCR · Translation · Scraping · LLMs · Wrapped APIs
          </div>
        </div>

        <Mark />
      </div>
    ),
    size,
  );
}

