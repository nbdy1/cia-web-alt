/**
 * components/StudentAvatar.tsx
 *
 * Reusable student avatar. Shows photo_url when available, falls back to a
 * coloured initial circle (same palette used across the app).
 *
 * Usage:
 *   <StudentAvatar name="Ahmad Fauzi" photoUrl={student.photo_url} size="md" colorIndex={0} />
 *
 * Size map:
 *   sm  — w-10  h-10  (text-sm)   used in compact lists / recent-activity rows
 *   md  — w-12  h-12  (text-lg)   default; used in student-list cards
 *   lg  — w-14  h-14  (text-xl)   used in report headers
 *   xl  — w-20  h-20  (text-3xl)  used on the student detail page
 */
"use client";

import React, { useState } from "react";

const AVATAR_COLORS: { bg: string; shadow: string }[] = [
  { bg: "#22c55e", shadow: "#15803d" },
  { bg: "#3b82f6", shadow: "#1d4ed8" },
  { bg: "#f59e0b", shadow: "#92400e" },
  { bg: "#8b5cf6", shadow: "#6d28d9" },
  { bg: "#ef4444", shadow: "#b91c1c" },
  { bg: "#06b6d4", shadow: "#0e7490" },
];

const SIZE_CLASSES: Record<string, { container: string; text: string; radius: string }> = {
  sm:  { container: "w-10 h-10",  text: "text-sm",   radius: "rounded-xl"  },
  md:  { container: "w-12 h-12",  text: "text-lg",   radius: "rounded-2xl" },
  lg:  { container: "w-14 h-14",  text: "text-xl",   radius: "rounded-2xl" },
  xl:  { container: "w-20 h-20",  text: "text-3xl",  radius: "rounded-[1.6rem]" },
};

const IMAGE_SIZES: Record<"sm" | "md" | "lg" | "xl", number> = {
  sm: 80,
  md: 96,
  lg: 128,
  xl: 256,
};

function getOptimizedPhotoUrl(photoUrl: string, size: "sm" | "md" | "lg" | "xl") {
  try {
    const url = new URL(photoUrl);
    const marker = "/storage/v1/object/public/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return photoUrl;

    // Supabase Image Transformations are served from render/image while the
    // object path remains identical. The CDN caches each rendered variant.
    url.pathname = url.pathname.replace(marker, "/storage/v1/render/image/public/");
    url.searchParams.set("width", String(IMAGE_SIZES[size]));
    url.searchParams.set("height", String(IMAGE_SIZES[size]));
    url.searchParams.set("resize", "cover");
    url.searchParams.set("quality", size === "xl" ? "80" : "70");
    return url.toString();
  } catch {
    return photoUrl;
  }
}

interface StudentAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  colorIndex?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function StudentAvatar({
  name,
  photoUrl,
  size = "md",
  colorIndex = 0,
  className = "",
  style,
}: StudentAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const { container, text, radius } = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;
  const color = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
  const initial = name?.charAt(0)?.toUpperCase() ?? "?";

  const base = `${container} ${radius} flex-shrink-0 overflow-hidden flex items-center justify-center ${className}`;

  if (photoUrl && !imgError) {
    const optimizedPhotoUrl = getOptimizedPhotoUrl(photoUrl, size);
    return (
      <div className={base} style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={optimizedPhotoUrl}
          alt={name}
          className="w-full h-full object-cover"
          loading={size === "xl" ? "eager" : "lazy"}
          decoding="async"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${base} font-black text-white ${text}`}
      style={{ background: color.bg, boxShadow: `0 3px 0 0 ${color.shadow}`, ...style }}
    >
      {initial}
    </div>
  );
}
