"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";

const SECTIONS = ["General", "Video", "Audio", "Share screen", "Chat", "Background & effects", "Accessibility"];

/** Settings placeholder modelled on Zoom's settings window. Toggles are local-only. */
export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [section, setSection] = useState("General");
  const [prefs, setPrefs] = useState({
    dualMonitor: false,
    confirmLeave: true,
    mirror: true,
    hd: false,
    autoMute: false,
  });
  const toggle = (k: keyof typeof prefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  return (
    <Modal open={open} onClose={onClose} title="Settings" width="max-w-2xl">
      <div className="flex min-h-[320px] flex-col gap-4 sm:flex-row">
        <ul className="flex gap-1 overflow-x-auto sm:w-48 sm:flex-col">
          {SECTIONS.map((s) => (
            <li key={s}>
              <button
                onClick={() => setSection(s)}
                className={`w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm ${
                  section === s ? "bg-zoom-blue text-white" : "hover:bg-zoom-bg"
                }`}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex-1 space-y-3 text-sm">
          <h3 className="font-bold">{section}</h3>
          {section === "General" && (
            <>
              <Check label="Use dual monitors" on={prefs.dualMonitor} toggle={() => toggle("dualMonitor")} />
              <Check label="Ask me to confirm when I leave a meeting" on={prefs.confirmLeave} toggle={() => toggle("confirmLeave")} />
            </>
          )}
          {section === "Video" && (
            <>
              <Check label="Mirror my video" on={prefs.mirror} toggle={() => toggle("mirror")} />
              <Check label="HD" on={prefs.hd} toggle={() => toggle("hd")} />
            </>
          )}
          {section === "Audio" && (
            <Check label="Mute my mic when joining" on={prefs.autoMute} toggle={() => toggle("autoMute")} />
          )}
          {!["General", "Video", "Audio"].includes(section) && (
            <p className="text-zoom-muted">These settings are placeholders in this clone.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Check({ label, on, toggle }: { label: string; on: boolean; toggle: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={on} onChange={toggle} className="h-4 w-4 accent-zoom-blue" />
      {label}
    </label>
  );
}
