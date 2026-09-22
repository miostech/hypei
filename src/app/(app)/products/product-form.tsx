"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { SelectField, TextField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProductStatus, ProductType } from "@/generated/prisma/enums";
import { PRODUCT_STATUS_LABELS, PRODUCT_TYPE_LABELS } from "@/modules/products/product.schemas";
import { idleState, type ActionState } from "@/lib/actions/action-state";

export interface ProductFormValues {
  id?: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  status: string;
  thumbnailUrl: string;
}

export function ProductForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues: ProductFormValues;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const fieldError = (field: string) => (state.status === "error" ? state.fieldErrors?.[field] : undefined);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Salvo");
    if (state.status === "error" && !state.fieldErrors) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-3">
      {defaultValues.id && <input type="hidden" name="id" value={defaultValues.id} />}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Informações do produto</CardTitle>
          <CardDescription>O que o comprador vai receber.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextField label="Nome" name="name" defaultValue={defaultValues.name} required maxLength={120} error={fieldError("name")} />
          <TextField
            label="Slug"
            name="slug"
            defaultValue={defaultValues.slug}
            required
            hint="Identificador interno, em letras minúsculas e hífens."
            error={fieldError("slug")}
          />
          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" name="description" rows={5} defaultValue={defaultValues.description} maxLength={2000} />
          </div>
          <TextField
            label="Imagem de capa (URL)"
            name="thumbnailUrl"
            type="url"
            defaultValue={defaultValues.thumbnailUrl}
            placeholder="https://…"
            error={fieldError("thumbnailUrl")}
          />
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Publicação</CardTitle>
          <CardDescription>Só produtos ativos podem ser vendidos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SelectField label="Tipo" name="type" defaultValue={defaultValues.type} error={fieldError("type")}>
            {Object.values(ProductType).map((type) => (
              <option key={type} value={type}>
                {PRODUCT_TYPE_LABELS[type]}
              </option>
            ))}
          </SelectField>
          <SelectField label="Status" name="status" defaultValue={defaultValues.status} error={fieldError("status")}>
            {Object.values(ProductStatus).map((status) => (
              <option key={status} value={status}>
                {PRODUCT_STATUS_LABELS[status]}
              </option>
            ))}
          </SelectField>
          {state.status === "error" && !state.fieldErrors && <p className="text-xs text-destructive">{state.message}</p>}
          <SubmitButton className="w-full">{submitLabel}</SubmitButton>
        </CardContent>
      </Card>
    </form>
  );
}
