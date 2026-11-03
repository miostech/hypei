/**
 * Providers return requirement codes ("individual.verification.document").
 * A producer should never have to read those, so each one becomes a sentence in
 * the words they use. Unknown codes fall back to the raw value — better an odd
 * label than a silent gap in the checklist.
 *
 * As frases moram no dicionário (`dict.verification.requirements`) e chegam aqui
 * por parâmetro: só a deduplicação é regra, e regra não tem idioma. É ela que
 * junta dob.day, dob.month e dob.year numa linha só.
 */
export interface Requirement {
  code: string;
  label: string;
  hint?: string;
}

export type RequirementLabels = Record<string, { label: string; hint?: string } | undefined>;

/** Maps provider codes to sentences, dropping duplicates (dob.day/month/year). */
export function describeRequirements(codes: readonly string[], labels: RequirementLabels): Requirement[] {
  const seen = new Set<string>();
  const requirements: Requirement[] = [];

  for (const code of codes) {
    const known = labels[code];
    const label = known?.label ?? code;
    if (seen.has(label)) continue;
    seen.add(label);
    requirements.push({ code, label, hint: known?.hint });
  }
  return requirements;
}
