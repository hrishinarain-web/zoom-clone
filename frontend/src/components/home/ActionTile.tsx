import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  label: string;
  color: "orange" | "blue";
  onClick?: () => void;
  disabled?: boolean;
  children?: React.ReactNode; // optional dropdown caret etc.
}

/** Big square Zoom-style home action button (New meeting / Join / Schedule / Share screen). */
export default function ActionTile({ icon: Icon, label, color, onClick, disabled, children }: Props) {
  const bg = color === "orange" ? "bg-zoom-orange hover:bg-zoom-orange-hover" : "bg-zoom-blue hover:bg-zoom-blue-hover";
  return (
    <div className="relative flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`flex h-[72px] w-[72px] items-center justify-center rounded-[22px] text-white shadow-sm transition-transform active:scale-95 disabled:opacity-60 sm:h-20 sm:w-20 ${bg}`}
      >
        <Icon size={30} strokeWidth={2} />
      </button>
      <span className="flex items-center gap-1 text-xs font-medium text-zoom-text sm:text-sm">
        {label}
        {children}
      </span>
    </div>
  );
}
