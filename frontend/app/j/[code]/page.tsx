"use client";

import { useParams } from "next/navigation";
import Prejoin from "@/components/Prejoin";

export default function JoinByLinkPage() {
  const params = useParams<{ code: string }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  return <Prejoin code={code} />;
}
