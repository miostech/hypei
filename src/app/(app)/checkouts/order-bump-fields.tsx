"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { SelectField, TextField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppDictionary } from "@/lib/i18n/app/provider";
import { fill } from "@/lib/i18n/locale";
import { MAX_ORDER_BUMPS } from "@/modules/checkout/checkout.schemas";

export interface OrderBumpFormValue {
  offerId: string;
  headline: string;
  description: string;
  price: string;
  compareAtPrice: string;
}

/**
 * Os order bumps do checkout, até `MAX_ORDER_BUMPS`.
 *
 * Os campos vão como nomes repetidos (`bumpOfferId`, `bumpHeadline`, …) e a action casa um
 * com o outro pela posição. Funciona porque remover uma linha a tira do formulário inteiro:
 * o que chega são as linhas que sobraram, na ordem em que estão na tela.
 *
 * O erro de cada linha chega com a chave que o serviço mandou (`orderBumps.1.offerId`), que é
 * a mesma que o Zod usaria — a validação pode vir dos dois lados sem o formulário saber de qual.
 */
export function OrderBumpFields({
  offers,
  defaultValues,
  fieldError,
}: {
  /** Só o que pode ser vendido junto: cobrança única, mesma moeda, outro produto. */
  offers: { id: string; label: string }[];
  defaultValues: OrderBumpFormValue[];
  fieldError: (field: string) => string | undefined;
}) {
  const dict = useAppDictionary();
  const t = dict.checkoutForm.bump;
  const [rows, setRows] = useState<OrderBumpFormValue[]>(defaultValues);

  function addRow() {
    setRows((current) => [
      ...current,
      { offerId: offers[0]?.id ?? "", headline: "", description: "", price: "", compareAtPrice: "" },
    ]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {offers.length === 0 ? (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t.empty}</p>
        ) : (
          <>
            {rows.map((row, index) => (
              // A chave é o índice de propósito: a linha não tem id próprio até ser salva, e
              // reordenar não é possível aqui — só adicionar no fim e remover.
              <fieldset key={index} className="space-y-3 rounded-xl border p-4">
                <legend className="flex w-full items-center justify-between gap-2 px-1">
                  <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {fill(t.item, { number: index + 1 })}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t.remove}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setRows((current) => current.filter((_, at) => at !== index))}
                  >
                    <Trash2Icon />
                  </Button>
                </legend>

                <SelectField
                  label={t.offer}
                  name="bumpOfferId"
                  defaultValue={row.offerId}
                  required
                  error={fieldError(`orderBumps.${index}.offerId`)}
                >
                  {offers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.label}
                    </option>
                  ))}
                </SelectField>

                <TextField
                  label={t.headline}
                  name="bumpHeadline"
                  defaultValue={row.headline}
                  placeholder={t.headlinePlaceholder}
                  required
                  maxLength={120}
                  error={fieldError(`orderBumps.${index}.headline`)}
                />

                <div className="space-y-1.5">
                  <Label htmlFor={`bump-description-${index}`}>{dict.common.description}</Label>
                  <Textarea
                    id={`bump-description-${index}`}
                    name="bumpDescription"
                    rows={2}
                    defaultValue={row.description}
                    maxLength={240}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label={t.price}
                    name="bumpPrice"
                    defaultValue={row.price}
                    placeholder="29,00"
                    inputMode="decimal"
                    required
                    hint={t.priceHint}
                    error={fieldError(`orderBumps.${index}.price`)}
                  />
                  <TextField
                    label={t.compareAtPrice}
                    name="bumpCompareAtPrice"
                    defaultValue={row.compareAtPrice}
                    placeholder="97,00"
                    inputMode="decimal"
                    hint={t.compareAtHint}
                    error={fieldError(`orderBumps.${index}.compareAtPrice`)}
                  />
                </div>
              </fieldset>
            ))}

            {rows.length < MAX_ORDER_BUMPS ? (
              <Button type="button" variant="outline" className="w-full" onClick={addRow}>
                <PlusIcon />
                {t.add}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">{fill(t.full, { max: MAX_ORDER_BUMPS })}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
