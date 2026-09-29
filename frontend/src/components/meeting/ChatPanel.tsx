"use client";

import { SendHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";

interface Props {
  messages: ChatMessage[];
  selfId: number;
  onSend: (text: string) => void;
  onClose: () => void;
}

export default function ChatPanel({ messages, selfId, onSend, onClose }: Props) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [messages.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <aside className="flex h-full flex-col bg-white text-zoom-text">
      <header className="flex items-center justify-between border-b border-zoom-border px-4 py-3">
        <h2 className="text-sm font-bold">Meeting Chat</h2>
        <button onClick={onClose} className="rounded p-1 text-zoom-muted hover:bg-zoom-bg" aria-label="Close chat">
          <X size={18} />
        </button>
      </header>

      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="pt-10 text-center text-sm text-zoom-muted">
            Messages addressed to &quot;Everyone&quot; will appear here. Only messages sent after you joined are shown.
          </p>
        )}
        {messages.map((m, i) => {
          const mine = m.participant_id === selfId;
          const grouped = i > 0 && messages[i - 1].participant_id === m.participant_id;
          return (
            <div key={m.id} className={`flex gap-2 ${grouped ? "-mt-2" : ""}`}>
              <div className="w-7">{!grouped && <Avatar name={m.sender_name} size={28} rounded="lg" />}</div>
              <div className="min-w-0 flex-1">
                {!grouped && (
                  <div className="flex items-baseline gap-2 text-xs">
                    <span className="font-semibold">{mine ? "Me" : m.sender_name}</span>
                    <span className="text-zoom-muted">to Everyone</span>
                    <span className="text-zoom-muted" suppressHydrationWarning>{formatTime(m.sent_at)}</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="border-t border-zoom-border p-3">
        <div className="mb-1.5 text-xs text-zoom-muted">
          To: <span className="rounded bg-zoom-blue-light px-1.5 py-0.5 font-semibold text-zoom-blue">Everyone</span>
        </div>
        <div className="flex items-end gap-2 rounded-lg border border-zoom-border p-2 focus-within:border-zoom-blue">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) submit(e);
            }}
            rows={2}
            maxLength={2000}
            placeholder="Type message here..."
            className="flex-1 resize-none text-sm outline-none"
            aria-label="Chat message"
          />
          <button className="rounded-md p-1.5 text-zoom-blue hover:bg-zoom-blue-light disabled:text-zoom-muted" disabled={!text.trim()} aria-label="Send">
            <SendHorizontal size={18} />
          </button>
        </div>
      </form>
    </aside>
  );
}
