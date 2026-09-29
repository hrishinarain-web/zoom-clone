import type { ReactNode } from "react";

type IconProps = { size?: number };

function Svg({ size = 22, children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {children}
    </svg>
  );
}

export function VideoIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="2.5" y="6" width="12.5" height="12" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 10.2 L21 7.2 V16.8 L15 13.8 Z" fill="currentColor" />
    </Svg>
  );
}

export function VideoOffIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M3 6.5 H13.5 A2 2 0 0 1 15.5 8.5 V15.5 A2 2 0 0 1 13.5 17.5 H6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.5 10.4 L21 7.4 V16.6 L17.2 14.2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4 4 L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function MicIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 11.5 A5.5 5.5 0 0 0 17.5 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 17 V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.5 21 H15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function MicOffIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M9 9 V14 A3 3 0 0 0 14.2 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15 11.2 V6 A3 3 0 0 0 10 3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.5 11.5 A5.5 5.5 0 0 0 12 17 A5.4 5.4 0 0 0 16.2 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 17 V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 4 L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function UsersIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.8 19.2 C4.4 15.8 6.4 14.2 9 14.2 C11.6 14.2 13.6 15.8 14.2 19.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16.5" cy="9.2" r="2.3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16.2 14.4 C18.2 14.6 19.6 15.8 20.2 18.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function ChatIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M5 6.5 H19 A2 2 0 0 1 21 8.5 V14.5 A2 2 0 0 1 19 16.5 H10 L6 20 V16.5 H5 A2 2 0 0 1 3 14.5 V8.5 A2 2 0 0 1 5 6.5 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  );
}

export function ShareIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3.5" y="5" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10 V19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.5 13.2 L12 9.8 L15.5 13.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ShieldIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 3.2 L19.5 6.2 V11.6 C19.5 15.8 16.4 19.2 12 20.8 C7.6 19.2 4.5 15.8 4.5 11.6 V6.2 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  );
}

export function RecordIcon({ size, on = false }: IconProps & { on?: boolean }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.1" fill={on ? "#ff4d4f" : "currentColor"} />
    </Svg>
  );
}

export function SmileIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
      <path d="M8.5 14.2 C9.5 16 14.5 16 15.5 14.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function ChevronIcon({ size = 16 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M6 9.5 L12 15 L18 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CalendarIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 9.5 H20.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.5 V6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 3.5 V6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function JoinIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M14 7 H6.5 A2 2 0 0 0 4.5 9 V15 A2 2 0 0 0 6.5 17 H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 12 H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.5 8.8 L20 12 L16.5 15.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CopyIcon({ size = 16 }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="8" y="8" width="11" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 15.5 H5.5 A2 2 0 0 1 3.5 13.5 V5.5 A2 2 0 0 1 5.5 3.5 H13.5 A2 2 0 0 1 15.5 5.5 V6" stroke="currentColor" strokeWidth="1.8" />
    </Svg>
  );
}

export function CloseIcon({ size = 18 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M6 6 L18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 6 L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function LockIcon({ size = 16 }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10 V7.5 A4 4 0 0 1 16 7.5 V10" stroke="currentColor" strokeWidth="1.8" />
    </Svg>
  );
}
