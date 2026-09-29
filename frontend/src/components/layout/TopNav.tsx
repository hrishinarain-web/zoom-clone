"use client";

import {
  Bell, CalendarDays, ChevronDown, Home, LogOut, MessageSquare, Search, Settings, User as UserIcon, Users, Video,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { User } from "@/lib/types";
import { formatMeetingId } from "@/lib/format";
import Avatar from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import SettingsModal from "./SettingsModal";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/meetings", label: "Meetings", icon: Video },
  { href: "#chat", label: "Team Chat", icon: MessageSquare },
  { href: "#calendar", label: "Calendar", icon: CalendarDays },
  { href: "#contacts", label: "Contacts", icon: Users },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Home">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoom-blue">
        <Video size={18} className="text-white" fill="white" />
      </span>
      <span className="hidden text-lg font-extrabold tracking-tight text-zoom-blue sm:inline">
        zoom<span className="font-semibold text-zoom-text">clone</span>
      </span>
    </Link>
  );
}

export default function TopNav({ user }: { user: User | null }) {
  const path = usePathname();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-zoom-border bg-white">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <Logo />

        <div className="mx-auto hidden max-w-md flex-1 md:block">
          <label className="relative block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zoom-muted" />
            <input
              placeholder="Search (Ctrl+F)"
              className="h-8 w-full rounded-lg bg-zoom-bg pl-9 pr-3 text-sm outline-none ring-zoom-blue/30 focus:ring-2"
            />
          </label>
        </div>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <button
            className="rounded-lg p-2 text-zoom-muted hover:bg-zoom-bg"
            aria-label="Notifications"
            onClick={() => toast("You're all caught up")}
          >
            <Bell size={18} />
          </button>
          <button
            className="rounded-lg p-2 text-zoom-muted hover:bg-zoom-bg"
            aria-label="Settings"
            onClick={() => setSettings(true)}
          >
            <Settings size={18} />
          </button>

          <div className="relative" ref={ref}>
            <button
              onClick={() => setMenu((v) => !v)}
              className="flex items-center gap-1 rounded-lg p-1 hover:bg-zoom-bg"
              aria-label="Profile menu"
            >
              <span className="relative">
                <Avatar name={user?.name || "?"} color={user?.avatar_color} size={30} rounded="lg" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-zoom-green" />
              </span>
              <ChevronDown size={14} className="text-zoom-muted" />
            </button>
            {menu && user && (
              <div className="absolute right-0 top-11 w-72 animate-fadeIn rounded-xl border border-zoom-border bg-white p-2 shadow-pop">
                <div className="flex items-center gap-3 p-3">
                  <Avatar name={user.name} color={user.avatar_color} size={44} rounded="lg" />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{user.name}</div>
                    <div className="truncate text-xs text-zoom-muted">{user.email}</div>
                    <span className="mt-1 inline-block rounded bg-zoom-blue-light px-1.5 py-0.5 text-[11px] font-semibold text-zoom-blue">
                      BASIC
                    </span>
                  </div>
                </div>
                <div className="mx-3 mb-2 rounded-lg bg-zoom-bg px-3 py-2 text-xs text-zoom-muted">
                  Personal Meeting ID
                  <div className="font-semibold text-zoom-text">{formatMeetingId(user.personal_meeting_id)}</div>
                </div>
                <hr className="my-1 border-zoom-border" />
                <MenuItem icon={UserIcon} label="My profile" onClick={() => toast("Profile page is a placeholder")} />
                <MenuItem icon={Settings} label="Settings" onClick={() => { setMenu(false); setSettings(true); }} />
                <hr className="my-1 border-zoom-border" />
                <MenuItem icon={LogOut} label="Sign out" onClick={() => toast("Authentication is out of scope: default user stays signed in")} />
              </div>
            )}
          </div>
        </div>
      </div>

      <nav className="scroll-thin flex gap-1 overflow-x-auto px-2 lg:px-4" aria-label="Main">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          const placeholder = href.startsWith("#");
          const cls = `flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
            active ? "border-zoom-blue text-zoom-blue" : "border-transparent text-zoom-muted hover:text-zoom-text"
          }`;
          return placeholder ? (
            <button key={label} className={cls} onClick={() => toast(`${label} is not part of this clone`)}>
              <Icon size={16} /> {label}
            </button>
          ) : (
            <Link key={label} href={href} className={cls}>
              <Icon size={16} /> {label}
            </Link>
          );
        })}
      </nav>
      <SettingsModal open={settings} onClose={() => setSettings(false)} />
    </header>
  );
}

function MenuItem({ icon: Icon, label, onClick }: { icon: typeof Home; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-zoom-bg">
      <Icon size={16} className="text-zoom-muted" /> {label}
    </button>
  );
}
