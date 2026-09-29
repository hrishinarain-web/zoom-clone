import { colorFor, initials } from "@/lib/format";

interface Props {
  name: string;
  color?: string;
  size?: number;
  className?: string;
  rounded?: "full" | "lg";
}

export default function Avatar({ name, color, size = 32, className = "", rounded = "full" }: Props) {
  return (
    <div
      className={`flex shrink-0 select-none items-center justify-center font-semibold text-white ${rounded === "full" ? "rounded-full" : "rounded-xl"} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4, background: color || colorFor(name) }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
