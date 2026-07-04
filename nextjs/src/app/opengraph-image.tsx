import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "German Law Vault — AI-powered German federal law search";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a0a 0%, #111111 50%, #0d0d0d 100%)",
          fontFamily: "serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Radial gold glow behind title */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "900px",
            height: "600px",
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.18) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Top label */}
        <p
          style={{
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "#71717a",
            marginBottom: "24px",
            display: "flex",
          }}
        >
          Bundesrepublik Deutschland · Bundesrecht
        </p>

        {/* Scale icon — Unicode ⚖ */}
        <div
          style={{
            fontSize: "56px",
            marginBottom: "20px",
            display: "flex",
          }}
        >
          ⚖️
        </div>

        {/* Main title */}
        <h1
          style={{
            fontSize: "80px",
            fontWeight: 900,
            color: "#ffffff",
            margin: "0 0 12px 0",
            letterSpacing: "-0.03em",
            lineHeight: 1,
            textAlign: "center",
            display: "flex",
          }}
        >
          The Law Vault
        </h1>

        {/* Gold divider */}
        <div
          style={{
            width: "120px",
            height: "2px",
            background:
              "linear-gradient(90deg, transparent, rgba(212,175,55,0.7), transparent)",
            margin: "24px 0",
            display: "flex",
          }}
        />

        {/* Tagline */}
        <p
          style={{
            fontSize: "22px",
            color: "#a1a1aa",
            fontStyle: "italic",
            textAlign: "center",
            maxWidth: "700px",
            margin: "0",
            lineHeight: 1.5,
            display: "flex",
          }}
        >
          Search 6,000+ German federal laws with AI assistance
        </p>

        {/* Feature pills */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "12px",
            marginTop: "40px",
          }}
        >
          {["Semantic Search", "Browser AI", "9 Languages", "Free & Open"].map(
            (label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  padding: "8px 20px",
                  borderRadius: "9999px",
                  border: "1px solid rgba(212,175,55,0.3)",
                  background: "rgba(212,175,55,0.07)",
                  color: "#d4af37",
                  fontSize: "13px",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                {label}
              </div>
            )
          )}
        </div>

        {/* Bottom domain label */}
        <p
          style={{
            position: "absolute",
            bottom: "28px",
            fontSize: "13px",
            color: "#3f3f46",
            letterSpacing: "0.1em",
            display: "flex",
          }}
        >
          ai-assisted-german-law.vercel.app
        </p>
      </div>
    ),
    {
      ...size,
    }
  );
}
