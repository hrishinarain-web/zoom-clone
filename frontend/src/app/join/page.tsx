"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import JoinModal from "@/components/home/JoinModal";
import TopNav from "@/components/layout/TopNav";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

/** Standalone /join route (like zoom.us/join) that opens the join dialog. */
export default function JoinRoute() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    api.me().then(setUser).catch(() => {});
  }, []);
  return (
    <div className="min-h-screen bg-zoom-bg">
      <TopNav user={user} />
      <JoinModal open onClose={() => router.push("/")} defaultName={user?.name || ""} />
    </div>
  );
}
