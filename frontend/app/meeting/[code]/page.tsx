"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MeetingRoom from "@/components/MeetingRoom";
import { loadSession } from "@/lib/session";
import type { Session } from "@/lib/types";

export default function MeetingPage() {
  const params = useParams<{ code: string }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const found = loadSession(code);
    if (!found) {
      router.replace(`/j/${code}`);
      return;
    }
    setSession(found);
    document.title = "Zoom Meeting";
  }, [code, router]);

  if (!session) return <div className="ended-screen"><p>Joining…</p></div>;
  return <MeetingRoom code={code} session={session} />;
}
