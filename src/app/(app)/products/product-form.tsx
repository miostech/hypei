"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { SelectField, TextField } from "@/components/shared/form-field";
import { ImageUploadField } from "@/components/shared/image-upload-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProductStatus, ProductType } from "@/generated/prisma/enums";
import { idleState, type ActionState } from "@/lib/actions/action-state";
import { useAppDictionary } from "@/lib/i18n/app/provider";
import { requestThumbnailUpload } from "./actions";

export interface ProductFormValues {
  id?: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  status: string;
  thumbnailKey: string;
  thumbnailUrl: string | null;
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
  const dict = useAppDictionary();
  const t = dict.productForm;
  const [state, formAction] = useActionState(action, idleState);
  const fieldError = (field: string) => (state.status === "error" ? state.fieldErrors?.[field] : undefined);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? dict.actions.saved);
    if (state.status === "error" && !state.fieldErrors) toast.error(state.message);
  }, [state, dict.actions.saved]);

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-3">
      {defaultValues.id && <input type="hidden" name="id" value={defaultValues.id} />}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{t.info.title}</CardTitle>
          <CardDescription>{t.info.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextField label={dict.common.name} name="name" defaultValue={defaultValues.name} required maxLength={120} error={fieldError("name")} />
          <TextField
            label={t.info.slug}
            name="slug"
            defaultValue={defaultValues.slug}
            required
            hint={t.info.slugHint}
            error={fieldError("slug")}
          />
          <div className="space-y-1.5">
            <Label htmlFor="description">{dict.common.description}</Label>
            <Textarea id="description" name="description" rows={5} defaultValue={defaultValues.description} maxLength={2000} />
          </div>
          <ImageUploadField
            name="thumbnailKey"
            label={t.info.cover}
            hint={t.info.coverHint}
            pendingNote={t.info.coverPending}
            previewClass="size-20"
            ownerId={defaultValues.id}
            defaultKey={defaultValues.thumbnailKey}
            previewUrl={defaultValues.thumbnailUrl}
            requestUpload={requestThumbnailUpload}
          />
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{t.publication.title}</CardTitle>
          <CardDescription>{t.publication.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SelectField label={dict.common.type} name="type" defaultValue={defaultValues.type} error={fieldError("type")}>
            {Object.values(ProductType).map((type) => (
              <option key={type} value={type}>
                {dict.products.types[type]}
              </option>
            ))}
          </SelectField>
          <SelectField label={dict.common.status} name="status" defaultValue={defaultValues.status} error={fieldError("status")}>
            {Object.values(ProductStatus).map((status) => (
              <option key={status} value={status}>
                {dict.products.statuses[status]}
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
