"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { SelectField, TextField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CouponType } from "@/generated/prisma/enums";
import { idleState } from "@/lib/actions/action-state";
import { COUPON_TYPE_LABELS } from "@/modules/coupons/coupon.schemas";
import { createCoupon, updateCoupon } from "./actions";

export interface CouponValues {
  id: string;
  code: string;
  type: CouponType;
  percentage: string;
  amount: string;
  minAmount: string;
  productId: string | null;
  maxRedemptions: string;
  oncePerCustomer: boolean;
  expiresAt: string;
  active: boolean;
}

export function CouponDialog({
  coupon,
  products,
  currency,
}: {
  coupon?: CouponValues;
  products: { id: string; name: string }[];
  currency: string;
}) {
  const [opened, setOpened] = useState(false);
  const [state, formAction] = useActionState(coupon ? updateCoupon : createCoupon, idleState);
  const [type, setType] = useState<CouponType>(coupon?.type ?? "PERCENTAGE");
  const fieldId = useId();
  const open = opened && state.status !== "success";
  const error = (field: string) => (state.status === "error" ? state.fieldErrors?.[field] : undefined);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Salvo");
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpened}>
      <DialogTrigger
        render={
          coupon ? (
            <Button variant="ghost" size="icon-sm" aria-label={`Editar cupom ${coupon.code}`}>
              <PencilIcon />
            </Button>
          ) : (
            <Button>
              <PlusIcon />
              Novo cupom
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{coupon ? "Editar cupom" : "Novo cupom"}</DialogTitle>
          <DialogDescription>O desconto é aplicado no checkout, antes do pagamento.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {coupon && <input type="hidden" name="couponId" value={coupon.id} />}
          <input type="hidden" name="currency" value={currency} />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Código"
              name="code"
              defaultValue={coupon?.code}
              placeholder="BEMVINDO10"
              required
              autoFocus
              style={{ textTransform: "uppercase" }}
              hint="O cliente digita no checkout."
              error={error("code")}
            />
            <SelectField
              label="Tipo de desconto"
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value as CouponType)}
              error={error("type")}
            >
              {Object.entries(COUPON_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {type === "PERCENTAGE" ? (
              <TextField
                label="Percentual (%)"
                name="percentage"
                inputMode="decimal"
                placeholder="10"
                defaultValue={coupon?.percentage}
                required
                error={error("percentage")}
              />
            ) : (
              <TextField
                label="Valor do desconto"
                name="amount"
                inputMode="decimal"
                placeholder="50,00"
                defaultValue={coupon?.amount}
                required
                error={error("amount")}
              />
            )}
            <TextField
              label="Compra mínima"
              name="minAmount"
              inputMode="decimal"
              placeholder="Sem mínimo"
              defaultValue={coupon?.minAmount}
              error={error("minAmount")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Produto" name="productId" defaultValue={coupon?.productId ?? ""} error={error("productId")}>
              <option value="">Todos os produtos</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Limite de usos"
              name="maxRedemptions"
              type="number"
              min={1}
              placeholder="Sem limite"
              defaultValue={coupon?.maxRedemptions}
              error={error("maxRedemptions")}
            />
          </div>

          <TextField
            label="Expira em"
            name="expiresAt"
            type="date"
            defaultValue={coupon?.expiresAt}
            hint="Deixe vazio para não expirar."
            error={error("expiresAt")}
          />

          <div className="flex items-center justify-between rounded-xl border p-3">
            <Label htmlFor={`once-${fieldId}`} className="cursor-pointer">
              Uma vez por cliente
              <span className="block text-xs font-normal text-muted-foreground">Cada cliente só consegue usar o cupom uma vez.</span>
            </Label>
            <Switch id={`once-${fieldId}`} name="oncePerCustomer" defaultChecked={coupon?.oncePerCustomer ?? false} />
          </div>

          {state.status === "error" && !state.fieldErrors && <p className="text-xs text-destructive">{state.message}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpened(false)}>
              Cancelar
            </Button>
            <SubmitButton>{coupon ? "Salvar" : "Criar cupom"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
