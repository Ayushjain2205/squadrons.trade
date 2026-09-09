import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon — purple slit-eye orb. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
        }}
      >
        <div
          style={{
            width: 156,
            height: 156,
            borderRadius: 999,
            background:
              "linear-gradient(145deg, #9B8BC4 0%, #6B5B95 52%, #4A3F6A 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 22,
            boxShadow: "inset 0 -10px 24px rgba(0,0,0,0.28)",
          }}
        >
          <div
            style={{
              width: 28,
              height: 9,
              borderRadius: 3,
              background: "#C4B5FD",
            }}
          />
          <div
            style={{
              width: 28,
              height: 9,
              borderRadius: 3,
              background: "#C4B5FD",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
