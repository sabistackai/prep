"use client";

import { useState } from "react";

// Shows a link with Share (phone share sheet) or Copy, whichever the browser supports.
export function ShareLink({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch {
        // Cancelled or unsupported: fall back to copying.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-3 py-2 tabular-nums text-xs text-muted">{url}</code>
      <button
        type="button"
        onClick={share}
        className="min-h-11 shrink-0 rounded-[10px] border border-border bg-surface-2 px-4 text-sm font-bold hover:border-primary"
      >
        {copied ? "Copied" : "Share"}
      </button>
    </div>
  );
}
