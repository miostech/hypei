/**
 * Providers return requirement codes ("individual.verification.document").
 * A producer should never have to read those, so each one becomes a sentence in
 * the words they use. Unknown codes fall back to the raw value — better an odd
 * label than a silent gap in the checklist.
 */
export interface Requirement {
  code: string;
  label: string;
  hint?: string;
}

const LABELS: Record<string, { label: string; hint?: string }> = {
  "individual.first_name": { label: "Nome do titular" },
  "individual.last_name": { label: "Sobrenome do titular" },
  "individual.id_number": { label: "CPF do titular" },
  "individual.dob.day": { label: "Data de nascimento do titular" },
  "individual.dob.month": { label: "Data de nascimento do titular" },
  "individual.dob.year": { label: "Data de nascimento do titular" },
  "individual.email": { label: "E-mail do titular" },
  "individual.phone": { label: "Telefone do titular" },
  "individual.address.line1": { label: "Endereço do titular" },
  "individual.address.city": { label: "Cidade do titular" },
  "individual.address.postal_code": { label: "CEP do titular" },
  "individual.address.state": { label: "Estado do titular" },
  "individual.verification.document": {
    label: "Documento de identidade",
    hint: "RG ou CNH, frente e verso, foto legível e dentro da validade.",
  },
  "individual.verification.additional_document": {
    label: "Comprovante de endereço",
    hint: "Conta de luz, água ou telefone dos últimos três meses.",
  },
  "company.name": { label: "Razão social" },
  "company.tax_id": { label: "CNPJ da empresa" },
  "company.address.line1": { label: "Endereço da empresa" },
  "company.phone": { label: "Telefone da empresa" },
  "company.verification.document": {
    label: "Documento da empresa",
    hint: "Contrato social ou cartão CNPJ.",
  },
  "company.directors_provided": { label: "Dados dos sócios" },
  "company.owners_provided": { label: "Dados dos proprietários" },
  "business_profile.url": { label: "Site ou rede social do negócio" },
  "business_profile.mcc": { label: "Ramo de atividade" },
  "business_profile.product_description": { label: "Descrição do que você vende" },
  external_account: {
    label: "Conta bancária para receber",
    hint: "É para ela que os saques são enviados.",
  },
  "tos_acceptance.date": { label: "Aceite dos termos do provedor de pagamento" },
  "tos_acceptance.ip": { label: "Aceite dos termos do provedor de pagamento" },
};

/** Maps provider codes to sentences, dropping duplicates (dob.day/month/year). */
export function describeRequirements(codes: readonly string[]): Requirement[] {
  const seen = new Set<string>();
  const requirements: Requirement[] = [];

  for (const code of codes) {
    const known = LABELS[code];
    const label = known?.label ?? code;
    if (seen.has(label)) continue;
    seen.add(label);
    requirements.push({ code, label, hint: known?.hint });
  }
  return requirements;
}
