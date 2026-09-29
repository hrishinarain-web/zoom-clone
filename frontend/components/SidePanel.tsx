"use client";

import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import { CloseIcon, CopyIcon, MicOffIcon, VideoOffIcon } from "./Icons";
import type { ChatMessage } from "@/lib/types";

export type Person = {
  id: number;
  name: string;
  role: string;
  audio: boolean;
  video: boolean;
  isSelf: boolean;
};

export default function SidePanel({
  mode,
  people,
  messages,
  host,
  meetingId,
  onClose,
  onSend,
  onMuteAll,
  onRemove,
  onCopy,
}: {
  mode: "chat" | "people";
  people: Person[];
  messages: ChatMessage[];
  host: boolean;
  meetingId: string;
  onClose: () => void;
  onSend: (text: string) => void;
  onMuteAll: () => void;
  onRemove: (id: number) => void;
  onCopy: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === "chat") endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, mode]);

  const visible = people.filter((person) => person.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <aside className="panel">
      <header className="panel-head">
        <h2>{mode === "chat" ? "Chat" : `Participants (${people.length})`}</h2>
        <button type="button" className="icon-btn light" onClick={onClose} aria-label="Close panel">
          <CloseIcon />
        </button>
      </header>
      {mode === "people" ? (
        <>
          <div className="panel-tools">
            <p>Meeting ID: {meetingId}</p>
            <button type="button" className="icon-btn light" aria-label="Copy invitation" onClick={onCopy}>
              <CopyIcon />
            </button>
          </div>
          <input className="panel-search" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
          <ul className="people">
            {visible.map((person) => (
              <li key={person.id}>
                <Avatar name={person.name} size={32} />
                <div>
                  <strong>
                    {person.name}
                    {person.isSelf ? " (You)" : ""}
                    {person.role === "host" ? " (Host)" : ""}
                  </strong>
                </div>
                <span className="person-icons">
                  {!person.audio && <MicOffIcon size={16} />}
                  {!person.video && <VideoOffIcon size={16} />}
                </span>
                {host && !person.isSelf && (
                  <button type="button" className="text-danger" onClick={() => onRemove(person.id)}>Remove</button>
                )}
              </li>
            ))}
          </ul>
          {host && (
            <footer className="panel-foot">
              <button type="button" className="btn btn-outline btn-small" onClick={onMuteAll}>Mute all</button>
            </footer>
          )}
        </>
      ) : (
        <>
          <div className="chat-log">
            {messages.length === 0 && <p className="help center">Chat is empty. Say hello.</p>}
            {messages.map((message) => (
              <article key={message.id} className="chat-item">
                <header>
                  <strong>{message.senderName}</strong>
                  <time>{new Date(message.sentAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
                </header>
                <p>{message.body}</p>
              </article>
            ))}
            <div ref={endRef} />
          </div>
          <form
            className="chat-form"
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (!text) return;
              onSend(text);
              setDraft("");
            }}
          >
            <input
              value={draft}
              maxLength={500}
              placeholder="Type message here..."
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-small" disabled={!draft.trim()}>Send</button>
          </form>
        </>
      )}
    </aside>
  );
}
