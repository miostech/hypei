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
import { useAppDictionary } from "@/lib/i18n/app/provider";
import { fill } from "@/lib/i18n/locale";
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
  const dict = useAppDictionary();
  const t = dict.couponDialog;
  const [opened, setOpened] = useState(false);
  const [state, formAction] = useActionState(coupon ? updateCoupon : createCoupon, idleState);
  const [type, setType] = useState<CouponType>(coupon?.type ?? "PERCENTAGE");
  const fieldId = useId();
  const open = opened && state.status !== "success";
  const error = (field: string) => (state.status === "error" ? state.fieldErrors?.[field] : undefined);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? dict.actions.saved);
  }, [state, dict.actions.saved]);

  return (
    <Dialog open={open} onOpenChange={setOpened}>
      <DialogTrigger
        render={
          coupon ? (
            <Button variant="ghost" size="icon-sm" aria-label={fill(dict.coupons.edit, { code: coupon.code })}>
              <PencilIcon />
            </Button>
          ) : (
            <Button>
              <PlusIcon />
              {t.new}
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{coupon ? t.editTitle : t.new}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {coupon && <input type="hidden" name="couponId" value={coupon.id} />}
          <input type="hidden" name="currency" value={currency} />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t.code}
              name="code"
              defaultValue={coupon?.code}
              placeholder={t.codePlaceholder}
              required
              autoFocus
              style={{ textTransform: "uppercase" }}
              hint={t.codeHint}
              error={error("code")}
            />
            <SelectField
              label={t.type}
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value as CouponType)}
              error={error("type")}
            >
              {Object.entries(t.types).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {type === "PERCENTAGE" ? (
              <TextField
                label={t.percentage}
                name="percentage"
                inputMode="decimal"
                placeholder={t.percentagePlaceholder}
                defaultValue={coupon?.percentage}
                required
                error={error("percentage")}
              />
            ) : (
              <TextField
                label={t.amount}
                name="amount"
                inputMode="decimal"
                placeholder={t.amountPlaceholder}
                defaultValue={coupon?.amount}
                required
                error={error("amount")}
              />
            )}
            <TextField
              label={t.minAmount}
              name="minAmount"
              inputMode="decimal"
              placeholder={t.minAmountPlaceholder}
              defaultValue={coupon?.minAmount}
              error={error("minAmount")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label={dict.common.product} name="productId" defaultValue={coupon?.productId ?? ""} error={error("productId")}>
              <option value="">{dict.coupons.allProducts}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </SelectField>
            <TextField
              label={t.maxRedemptions}
              name="maxRedemptions"
              type="number"
              min={1}
              placeholder={t.maxRedemptionsPlaceholder}
              defaultValue={coupon?.maxRedemptions}
              error={error("maxRedemptions")}
            />
          </div>

          <TextField
            label={t.expiresAt}
            name="expiresAt"
            type="date"
            defaultValue={coupon?.expiresAt}
            hint={t.expiresAtHint}
            error={error("expiresAt")}
          />

          <div className="flex items-center justify-between rounded-xl border p-3">
            <Label htmlFor={`once-${fieldId}`} className="cursor-pointer">
              {dict.coupons.oncePerCustomer}
              <span className="block text-xs font-normal text-muted-foreground">{t.oncePerCustomerHint}</span>
            </Label>
            <Switch id={`once-${fieldId}`} name="oncePerCustomer" defaultChecked={coupon?.oncePerCustomer ?? false} />
          </div>

          {state.status === "error" && !state.fieldErrors && <p className="text-xs text-destructive">{state.message}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpened(false)}>
              {dict.common.cancel}
            </Button>
            <SubmitButton>{coupon ? dict.common.save : t.create}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
