"use client";

import { useEffect, useState } from "react";
import Logo from "./Logo";
import Avatar from "./Avatar";
import Modal from "./Modal";
import type { User } from "@/lib/types";
import { loadSettings, saveSettings } from "@/lib/settings";

export default function Navbar({ user }: { user: User | null }) {
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [joinMuted, setJoinMuted] = useState(false);
  const [joinVideoOff, setJoinVideoOff] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const settings = loadSettings();
    setMirror(settings.mirror);
    setJoinMuted(settings.joinMuted);
    setJoinVideoOff(settings.joinVideoOff);
    setDisplayName(settings.displayName);
  }, [settingsOpen]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  function save(next: { mirror?: boolean; joinMuted?: boolean; joinVideoOff?: boolean; displayName?: string }) {
    const settings = {
      mirror: next.mirror ?? mirror,
      joinMuted: next.joinMuted ?? joinMuted,
      joinVideoOff: next.joinVideoOff ?? joinVideoOff,
      displayName: next.displayName ?? displayName,
    };
    setMirror(settings.mirror);
    setJoinMuted(settings.joinMuted);
    setJoinVideoOff(settings.joinVideoOff);
    setDisplayName(settings.displayName);
    saveSettings(settings);
  }

  const name = user?.name || "Guest";

  return (
    <header className="topbar">
      <a href="/" className="logo-link" aria-label="Zoom home">
        <Logo />
      </a>
      <nav className="top-links" aria-label="Primary">
        <a className="top-link active" href="/">Home</a>
        <a className="top-link" href="/#upcoming">Meetings</a>
      </nav>
      <div className="top-spacer" />
      <button
        type="button"
        className="profile-btn"
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={(event) => {
          event.stopPropagation();
          setMenu((open) => !open);
        }}
      >
        <Avatar name={name} size={32} />
      </button>
      {menu && (
        <div className="dropdown profile-dropdown" role="menu" onClick={(event) => event.stopPropagation()}>
          <div className="dropdown-user">
            <strong>{name}</strong>
            <span>{user?.email}</span>
          </div>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); setProfile(true); }}>Profile</button>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); setSettingsOpen(true); }}>Settings</button>
        </div>
      )}
      {profile && user && (
        <Modal title="Profile" onClose={() => setProfile(false)}>
          <div className="profile-card">
            <Avatar name={user.name} size={64} />
            <div>
              <strong>{user.name}</strong>
              <p>{user.email}</p>
            </div>
          </div>
          <p className="help">You're signed in as the demo host. This assignment does not require login.</p>
        </Modal>
      )}
      {settingsOpen && (
        <Modal title="Settings" onClose={() => setSettingsOpen(false)}>
          <label className="check">
            <input type="checkbox" checked={mirror} onChange={(event) => save({ mirror: event.target.checked })} />
            Mirror my video
          </label>
          <label className="check">
            <input type="checkbox" checked={joinMuted} onChange={(event) => save({ joinMuted: event.target.checked })} />
            Mute my microphone when I join
          </label>
          <label className="check">
            <input type="checkbox" checked={joinVideoOff} onChange={(event) => save({ joinVideoOff: event.target.checked })} />
            Turn off my video when I join
          </label>
          <label className="field">
            <span>Name used when you join someone else's meeting</span>
            <input
              value={displayName}
              placeholder={user?.name || "Your name"}
              maxLength={64}
              onChange={(event) => save({ displayName: event.target.value })}
            />
          </label>
        </Modal>
      )}
    </header>
  );
}
