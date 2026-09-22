"use client";

import { Loader2Icon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { children: ReactNode; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending && <Loader2Icon className="animate-spin" />}
      {pending ? (pendingLabel ?? "Salvando…") : children}
    </Button>
  );
}
