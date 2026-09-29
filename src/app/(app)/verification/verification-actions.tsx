"use client";

import { ExternalLinkIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refreshVerification, startVerification } from "./actions";

export function VerificationActions({ label, canStart }: { label: string; canStart: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canStart && (
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await startVerification();
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              // The provider hosts the form; we only send the producer there.
              if (result.url) window.location.href = result.url;
            })
          }
        >
          {pending ? <Loader2Icon className="animate-spin" /> : <ExternalLinkIcon />}
          {label}
        </Button>
      )}

      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await refreshVerification();
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success(result.message ?? "Status atualizado");
            router.refresh();
          })
        }
      >
        <RefreshCwIcon />
        Atualizar status
      </Button>
    </div>
  );
}
