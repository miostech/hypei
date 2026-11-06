"use client";

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ShieldCheckIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { SelectField, TextField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessType } from "@/generated/prisma/enums";
import { useAppDictionary } from "@/lib/i18n/app/provider";
import { fill } from "@/lib/i18n/locale";
import { SUPPORTED_CURRENCIES } from "@/lib/money/currency";
import { COUNTRY_INFO, type CountryCode } from "@/modules/organizations/countries";
import { TAX_ID_TYPES_BY_COUNTRY } from "@/modules/compliance/tax-id-types";
import { completeOnboarding } from "./actions";
import { idleState } from "@/lib/actions/action-state";

// Recebimento não é passo: não pedia nada, só avisava. O aviso virou uma linha no último
// passo e a verificação segue onde a ação mora, em Conta → Verificação.
const STEPS = ["organization", "country", "tax"] as const;

const TAX_PLACEHOLDER: Record<string, string> = {
  CPF: "000.000.000-00",
  CNPJ: "00.000.000/0000-00",
  NIF: "000000000",
  VAT_ID: "PT000000000",
  EIN: "00-0000000",
  SSN: "000-00-0000",
  TIN: "000000000",
};

export function OnboardingForm({
  defaultEmail,
  providerName,
  countries,
  returnTo,
}: {
  defaultEmail: string;
  providerName: string;
  /** Resolvidos no servidor: a tabela ICU do Node e a do navegador podem divergir. */
  countries: { code: CountryCode; name: string }[];
  /** Para onde voltar quando a conta nasceu no meio de outra coisa — um convite de afiliação. */
  returnTo?: string;
}) {
  const t = useAppDictionary().onboarding;
  const [state, formAction] = useActionState(completeOnboarding, idleState);
  const [currentStep, setStep] = useState(0);
  const [country, setCountry] = useState<CountryCode>("BR");
  const [businessType, setBusinessType] = useState<keyof typeof BusinessType>("INDIVIDUAL");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const taxTypes = TAX_ID_TYPES_BY_COUNTRY[country]?.[businessType] ?? ["OTHER"];
  const fieldError = (field: string) => (state.status === "error" ? state.fieldErrors?.[field] : undefined);

  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  // Derived: a server-side validation error jumps back to the step that owns the field.
  const errorStep =
    state.status === "error"
      ? state.fieldErrors?.name || state.fieldErrors?.slug || state.fieldErrors?.supportEmail
        ? 0
        : state.fieldErrors?.taxId || state.fieldErrors?.taxIdType
          ? 2
          : null
      : null;
  // Preso ao último passo: fora do intervalo não existe título nem campo, e o card renderiza
  // vazio. Os botões já clampam, mas estado preservado de um hot reload não passa por eles.
  const step = Math.min(errorStep ?? currentStep, STEPS.length - 1);

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <div className="flex items-center gap-1.5">
          {STEPS.map((key, index) => (
            <div key={key} className="flex flex-1 items-center gap-1.5">
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  index < step ? "bg-primary text-primary-foreground" : index === step ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {index < step ? <CheckIcon className="size-3.5" /> : index + 1}
              </span>
              {index < STEPS.length - 1 && <span className={`h-px flex-1 ${index < step ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>
        <CardTitle className="mt-4">{t.steps[STEPS[step]].title}</CardTitle>
        <CardDescription>{t.steps[STEPS[step]].description}</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <div className={step === 0 ? "space-y-4" : "hidden"}>
            <TextField
              label={t.name}
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              required
              error={fieldError("name")}
            />
            <TextField
              label={t.slug}
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              required
              hint={t.slugHint}
              error={fieldError("slug")}
            />
            <TextField label={t.supportEmail} name="supportEmail" type="email" defaultValue={defaultEmail} required error={fieldError("supportEmail")} />
          </div>

          <div className={step === 1 ? "space-y-4" : "hidden"}>
            <SelectField
              label={t.country}
              name="country"
              value={country}
              onChange={(e) => setCountry(e.target.value as CountryCode)}
              error={fieldError("country")}
            >
              {countries.map(({ code, name: label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={t.businessType}
              name="businessType"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value as keyof typeof BusinessType)}
              error={fieldError("businessType")}
            >
              <option value="INDIVIDUAL">{t.individual}</option>
              <option value="COMPANY">{t.company}</option>
            </SelectField>
            <SelectField label={t.currency} name="currency" defaultValue={COUNTRY_INFO[country].currency} key={country} error={fieldError("currency")}>
              {SUPPORTED_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </SelectField>
          </div>

          <div className={step === 2 ? "space-y-4" : "hidden"}>
            <SelectField label={t.taxIdType} name="taxIdType" key={`${country}-${businessType}`} defaultValue={taxTypes[0]} error={fieldError("taxIdType")}>
              {taxTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </SelectField>
            <TextField
              label={t.taxId}
              name="taxId"
              required
              placeholder={TAX_PLACEHOLDER[taxTypes[0]] ?? ""}
              hint={t.taxIdHint}
              error={fieldError("taxId")}
            />
            {businessType === "COMPANY" && <TextField label={t.legalName} name="legalName" error={fieldError("legalName")} />}
            <TextField label={t.website} name="website" type="url" placeholder="https://…" error={fieldError("website")} />
          </div>

          {step === STEPS.length - 1 && (
            <p className="flex gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{fill(t.providerNote, { provider: providerName })}</span>
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeftIcon />
              {t.back}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                {t.next}
                <ArrowRightIcon />
              </Button>
            ) : (
              <SubmitButton pendingLabel={t.submitting}>{t.submit}</SubmitButton>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
