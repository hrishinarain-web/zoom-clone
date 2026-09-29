"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { buildInvitation } from "@/lib/format";
import { session } from "@/lib/session";
import type { Meeting } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

/** Shared navigation/actions for starting, joining and sharing meetings. */
export function useMeetingActions() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const start = useCallback(
    (m: Pick<Meeting, "meeting_code" | "passcode">, video = true) => {
      session.markHost(m.meeting_code);
      session.setJoinPrefs({ video, audio: true });
      router.push(`/j/${m.meeting_code}?pwd=${encodeURIComponent(m.passcode)}`);
    },
    [router],
  );

  const newMeeting = useCallback(
    async (video = true) => {
      setBusy(true);
      try {
        const m = await api.createInstant();
        start(m, video);
      } catch (e) {
        toast((e as Error).message, "error");
        setBusy(false);
      }
    },
    [start, toast],
  );

  const copyInvite = useCallback(
    async (m: Meeting, full = false) => {
      const text = full ? buildInvitation(m) : m.join_url;
      try {
        await navigator.clipboard.writeText(text);
        toast(full ? "Invitation copied to clipboard" : "Invite link copied to clipboard", "success");
      } catch {
        toast("Couldn't access clipboard", "error");
      }
    },
    [toast],
  );

  return { start, newMeeting, copyInvite, busy };
}
