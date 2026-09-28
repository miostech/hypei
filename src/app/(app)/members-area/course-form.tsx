"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { SelectField, TextField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { idleState, type ActionState } from "@/lib/actions/action-state";

export interface CourseFormValues {
  courseId?: string;
  productId?: string;
  title: string;
  slug: string;
  description: string;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

export function CourseForm({
  action,
  defaultValues,
  products,
  submitLabel,
  title,
  description,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues: CourseFormValues;
  /** Only on creation: products that do not have a course yet. */
  products?: { id: string; name: string }[];
  submitLabel: string;
  title: string;
  description: string;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const [name, setName] = useState(defaultValues.title);
  const [slug, setSlug] = useState(defaultValues.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(defaultValues.slug));
  const descriptionId = useId();
  const fieldError = (field: string) => (state.status === "error" ? state.fieldErrors?.[field] : undefined);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Salvo");
    if (state.status === "error" && !state.fieldErrors) toast.error(state.message);
  }, [state]);

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {defaultValues.courseId && <input type="hidden" name="courseId" value={defaultValues.courseId} />}

          {products && (
            <SelectField label="Produto" name="productId" defaultValue={defaultValues.productId} required error={fieldError("productId")}>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </SelectField>
          )}

          <TextField
            label="Título do curso"
            name="title"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
            required
            error={fieldError("title")}
          />

          <TextField
            label="Link do curso"
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            required
            hint="Usado no endereço da área de membros."
            error={fieldError("slug")}
          />

          <div className="space-y-1.5">
            <Label htmlFor={descriptionId}>Descrição</Label>
            <Textarea id={descriptionId} name="description" rows={4} defaultValue={defaultValues.description} maxLength={2000} />
          </div>

          {state.status === "error" && !state.fieldErrors && <p className="text-xs text-destructive">{state.message}</p>}
          <SubmitButton className="w-full">{submitLabel}</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
