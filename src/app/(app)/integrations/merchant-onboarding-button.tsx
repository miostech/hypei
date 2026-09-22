"use client";

import { ExternalLinkIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startMerchantOnboarding, syncMerchantAccount } from "./actions";

export function MerchantOnboardingButton({ label }: { label: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await startMerchantOnboarding();
            if (result.status === "error") {
              toast.error(result.message);
              return;
            }
            if (result.url) window.location.href = result.url;
          })
        }
      >
        {pending ? <Loader2Icon className="animate-spin" /> : <ExternalLinkIcon />}
        {label}
      </Button>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await syncMerchantAccount();
            if (result.status === "error") toast.error(result.message);
            else {
              toast.success("Status atualizado");
              router.refresh();
            }
          })
        }
      >
        <RefreshCwIcon />
        Sincronizar status
      </Button>
    </div>
  );
}
