"use client";

import { useId, type ReactNode } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Field ids are generated, never derived from the field name: the same form can be
 * rendered twice on a page (a dialog over a settings form) without the labels
 * pointing at the wrong input.
 */
export function FormRow({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  name,
  error,
  hint,
  className,
  id,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; name: string; error?: string; hint?: string }) {
  const generated = useId();
  const fieldId = id ?? `${name}-${generated}`;
  return (
    <FormRow label={label} htmlFor={fieldId} error={error} hint={hint} className={className}>
      <Input id={fieldId} name={name} aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId}-error` : undefined} {...props} />
    </FormRow>
  );
}

/** Native select keeps forms progressive-enhancement friendly (works before hydration). */
export function SelectField({
  label,
  name,
  error,
  hint,
  children,
  className,
  id,
  ...props
}: React.ComponentProps<"select"> & { label: string; name: string; error?: string; hint?: string }) {
  const generated = useId();
  const fieldId = id ?? `${name}-${generated}`;
  return (
    <FormRow label={label} htmlFor={fieldId} error={error} hint={hint} className={className}>
      <select
        id={fieldId}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={cn(
          "flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        )}
        {...props}
      >
        {children}
      </select>
    </FormRow>
  );
}
