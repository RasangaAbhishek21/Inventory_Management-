import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// App icon: "H47" in near-black on Home Yellow (brief §9 — yellow only as a fill).
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7c517",
          color: "#1a1a1a",
          fontSize: 220,
          fontWeight: 700,
          letterSpacing: -8,
        }}
      >
        H47
      </div>
    ),
    { ...size },
  );
}
