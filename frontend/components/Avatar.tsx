"use client";

import { colorFor, initials } from "@/lib/format";

export default function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: colorFor(name), fontSize: Math.max(11, size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}
