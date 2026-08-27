import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

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
          background: "#7A2E2E",
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          <div style={{ width: 28, height: 92, background: "#E8D4B5", borderRadius: 3 }} />
          <div style={{ width: 34, height: 108, background: "#3F5C4A", borderRadius: 3 }} />
          <div style={{ width: 30, height: 86, background: "#1F3347", borderRadius: 3 }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
