"use client";

import { useMemo, useState } from "react";

const CLOTH = [
  "#6B2B2B",
  "#2F4A3C",
  "#1F3347",
  "#7A4B1E",
  "#3D2C5E",
  "#4A5A2A",
  "#5C2E24",
  "#2C3D4F",
];

function hashHue(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 33 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function Cover({
  title,
  author,
  coverUrl,
  className = "",
}: {
  title: string;
  author: string;
  coverUrl?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const cloth = useMemo(() => CLOTH[hashHue(title + author) % CLOTH.length], [title, author]);
  const initials = (title.trim()[0] ?? "?").toUpperCase();
  const showImage = Boolean(coverUrl) && !failed;

  return (
    <div
      className={`relative overflow-hidden rounded-sm shadow-[2px_3px_0_rgb(36_23_15_/_0.18)] ${className}`}
      style={{ background: cloth }}
      aria-hidden={showImage}
    >
      <div className="flex h-full w-full flex-col justify-between p-2 text-[#F3E6D0]">
        <span className="font-display text-2xl leading-none">{initials}</span>
        <span className="line-clamp-3 text-[10px] leading-tight opacity-80">{title}</span>
      </div>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl ?? ""}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}
