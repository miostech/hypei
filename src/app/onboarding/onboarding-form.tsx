"use client";

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ShieldCheckIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { SelectField, TextField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessType } from "@/generated/prisma/enums";
import { SUPPORTED_CURRENCIES } from "@/lib/money/currency";
import { COUNTRY_INFO, SUPPORTED_COUNTRIES, type CountryCode } from "@/modules/organizations/countries";
import { TAX_ID_TYPES_BY_COUNTRY } from "@/modules/compliance/tax-id-types";
import { completeOnboarding } from "./actions";
import { idleState } from "@/lib/actions/action-state";

const STEPS = ["Organização", "País e cobrança", "Identidade fiscal", "Recebimento"] as const;

const TAX_PLACEHOLDER: Record<string, string> = {
  CPF: "000.000.000-00",
  CNPJ: "00.000.000/0000-00",
  NIF: "000000000",
  VAT_ID: "PT000000000",
  EIN: "00-0000000",
  SSN: "000-00-0000",
  TIN: "000000000",
};

export function OnboardingForm({ defaultEmail }: { defaultEmail: string }) {
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
  const step = errorStep ?? currentStep;

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
          {STEPS.map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-1.5">
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
        <CardTitle className="mt-4">{STEPS[step]}</CardTitle>
        <CardDescription>
          {step === 0 && "Como sua operação será identificada na Ripay."}
          {step === 1 && "Onde você vende e em qual moeda recebe."}
          {step === 2 && "Necessário para emissão fiscal e verificação de identidade."}
          {step === 3 && "Como o dinheiro das suas vendas chega até você."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className={step === 0 ? "space-y-4" : "hidden"}>
            <TextField
              label="Nome da organização"
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
              label="Identificador"
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              required
              hint="Usado nos links públicos da sua área de membros."
              error={fieldError("slug")}
            />
            <TextField label="E-mail de suporte" name="supportEmail" type="email" defaultValue={defaultEmail} required error={fieldError("supportEmail")} />
          </div>

          <div className={step === 1 ? "space-y-4" : "hidden"}>
            <SelectField
              label="País"
              name="country"
              value={country}
              onChange={(e) => setCountry(e.target.value as CountryCode)}
              error={fieldError("country")}
            >
              {SUPPORTED_COUNTRIES.map((code) => (
                <option key={code} value={code}>
                  {COUNTRY_INFO[code].name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Tipo de negócio"
              name="businessType"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value as keyof typeof BusinessType)}
              error={fieldError("businessType")}
            >
              <option value="INDIVIDUAL">Pessoa física</option>
              <option value="COMPANY">Empresa</option>
            </SelectField>
            <SelectField label="Moeda principal" name="currency" defaultValue={COUNTRY_INFO[country].currency} key={country} error={fieldError("currency")}>
              {SUPPORTED_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </SelectField>
          </div>

          <div className={step === 2 ? "space-y-4" : "hidden"}>
            <SelectField label="Tipo de documento" name="taxIdType" key={`${country}-${businessType}`} defaultValue={taxTypes[0]} error={fieldError("taxIdType")}>
              {taxTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Documento"
              name="taxId"
              required
              placeholder={TAX_PLACEHOLDER[taxTypes[0]] ?? ""}
              hint="Guardamos apenas os últimos dígitos — o número completo nunca é armazenado."
              error={fieldError("taxId")}
            />
            {businessType === "COMPANY" && <TextField label="Razão social" name="legalName" error={fieldError("legalName")} />}
            <TextField label="Site (opcional)" name="website" type="url" placeholder="https://…" error={fieldError("website")} />
          </div>

          <div className={step === 3 ? "space-y-4" : "hidden"}>
            <div className="flex gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
              <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="font-medium">Verificação e dados bancários</p>
                <p className="text-muted-foreground">
                  Ao concluir, criamos sua conta de recebimento no provedor de pagamentos. Os documentos e a conta bancária são enviados direto para
                  ele — a Ripay não armazena esses dados. Você pode concluir a verificação depois, em Integrações.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeftIcon />
              Voltar
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                Continuar
                <ArrowRightIcon />
              </Button>
            ) : (
              <SubmitButton pendingLabel="Criando…">Criar organização</SubmitButton>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
