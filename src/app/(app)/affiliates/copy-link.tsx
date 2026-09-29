"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Copies the referral link; the code alone is useless without the checkout it points to. */
export function CopyLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="group flex max-w-72 items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-1.5 text-left transition-colors hover:bg-muted"
      aria-label={`Copiar link de ${label}`}
    >
      <span className="truncate font-mono text-xs">{url.replace(/^https?:\/\//, "")}</span>
      <Button render={<span />} variant="ghost" size="icon-sm" className="ml-auto size-6 shrink-0" tabIndex={-1} aria-hidden>
        {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
      </Button>
    </button>
  );
}
