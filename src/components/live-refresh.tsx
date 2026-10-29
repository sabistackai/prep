"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Re-renders the page when rows in these tables change (Realtime, filtered by RLS).
export function LiveRefresh({ tables }: { tables: string[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const key = tables.join(",");

  useEffect(() => {
    const channel = supabase.channel(`live:${key}`);
    for (const table of key.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => router.refresh());
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router, key]);

  return null;
}
