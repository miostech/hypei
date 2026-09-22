"use client";

import { FastForwardIcon, Loader2Icon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { simulateSettlement } from "./actions";

/** Dev-only: simulates the settlement window so pending funds become available. */
export function SimulateSettlementButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await simulateSettlement();
          if (result.status === "success") toast.success(result.message ?? "Settlement executado");
          if (result.status === "error") toast.error(result.message);
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <FastForwardIcon />}
      Simular settlement
    </Button>
  );
}
