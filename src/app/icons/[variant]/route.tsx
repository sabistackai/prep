import { ImageResponse } from "next/og";

// App icons, drawn at request time: /icons/192, /icons/512, /icons/maskable, /icons/badge.
const variants = {
  "192": { size: 192, inset: 0 },
  "512": { size: 512, inset: 0 },
  maskable: { size: 512, inset: 0.2 }, // keeps the mark inside the safe zone when cropped to a circle
  badge: { size: 96, inset: 0 },
} as const;

export function generateStaticParams() {
  return Object.keys(variants).map((variant) => ({ variant }));
}

export async function GET(_: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  const v = variants[variant as keyof typeof variants];
  if (!v) return new Response("not found", { status: 404 });

  const badge = variant === "badge";
  const mark = v.size * (1 - v.inset * 2);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: badge ? "transparent" : "#0A0F14",
        }}
      >
        <div
          style={{
            width: mark * 0.62,
            height: mark * 0.62,
            borderRadius: mark * 0.16,
            background: badge ? "#FFFFFF" : "#84CC16",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: badge ? "transparent" : "#0A0F14",
            fontSize: mark * 0.42,
            fontWeight: 800,
          }}
        >
          P
        </div>
      </div>
    ),
    { width: v.size, height: v.size },
  );
}
