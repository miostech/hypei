"use client";

import { CheckIcon, GiftIcon, TruckIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AwardMedal } from "./award-medal";

export interface AwardRow {
  tier: string;
  label: string;
  shortLabel: string;
  earned: boolean;
  achievedAt: string | null;
  status: "ACHIEVED" | "SHIPPED" | "DELIVERED" | null;
  trackingCode: string | null;
}

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warning" | "outline" }> = {
  ACHIEVED: { label: "Conquistado", variant: "warning" },
  SHIPPED: { label: "Enviado", variant: "success" },
  DELIVERED: { label: "Entregue", variant: "success" },
};

/**
 * Progress towards the next physical award. Sits in the topbar because it is a
 * reward, not a task: it should be visible without competing with the work.
 */
export function AwardsProgress({
  currentLabel,
  nextLabel,
  percentage,
  nextTier,
  rows,
}: {
  currentLabel: string;
  /** null when every tier has been reached. */
  nextLabel: string | null;
  percentage: number;
  nextTier: string | null;
  rows: AwardRow[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ver suas premiações"
        className="hidden items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1 transition-colors hover:bg-muted md:flex"
      >
        <AwardMedal tier={nextTier} className="size-7" />
        <span className="h-2 w-24 overflow-hidden rounded-full bg-muted lg:w-32">
          <span className="bg-brand-gradient block h-full rounded-full transition-all" style={{ width: `${Math.max(percentage, 3)}%` }} />
        </span>
        <span className="tabular text-xs font-medium whitespace-nowrap">
          {currentLabel}
          {nextLabel ? <span className="text-muted-foreground"> / {nextLabel}</span> : null}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <GiftIcon className="size-5" aria-hidden />
              </span>
              Premiações da Ripay
            </DialogTitle>
            <DialogDescription>
              Você recebe uma placa a cada meta de faturamento líquido — o que sobra para você depois das taxas, reembolsos e
              contestações. Vale para venda própria e para comissão de afiliado.
            </DialogDescription>
          </DialogHeader>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Premiação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rastreio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const status = row.status ? STATUS_LABEL[row.status] : null;
                return (
                  <TableRow key={row.tier} className={row.earned ? undefined : "opacity-60"}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{row.achievedAt ?? "—"}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 font-medium">
                        <AwardMedal tier={row.tier} muted={!row.earned} className="size-6" />
                        {row.shortLabel}
                        <span className="text-xs font-normal text-muted-foreground">{row.label}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      {status ? (
                        <Badge variant={status.variant}>
                          {row.status === "SHIPPED" && <TruckIcon className="size-3" />}
                          {row.status === "DELIVERED" && <CheckIcon className="size-3" />}
                          {status.label}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Não conquistado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.trackingCode ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <p className="text-xs text-muted-foreground">
            A placa é enviada pela equipe da Ripay assim que a meta é atingida. O código de rastreio aparece aqui quando ela sai.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
