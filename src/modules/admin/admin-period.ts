import { startOfDayIn, timezoneForCountry } from "@/lib/time/day-window";

/**
 * O recorte que o admin está olhando.
 *
 * O padrão é o dia porque é a pergunta que a operação faz todo dia — "quanto vendemos hoje?" —,
 * e porque um número de 30 dias não muda quando algo acontece agora, então não serve para
 * acompanhar nada.
 */
export const ADMIN_PERIODS = ["hoje", "7d", "30d", "mes"] as const;
export type AdminPeriod = (typeof ADMIN_PERIODS)[number];

export const DEFAULT_ADMIN_PERIOD: AdminPeriod = "hoje";

export const ADMIN_PERIOD_LABEL: Record<AdminPeriod, string> = {
  hoje: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  mes: "Este mês",
};

/** Como a descrição da tela fala do recorte, para a frase ler natural. */
export const ADMIN_PERIOD_PHRASE: Record<AdminPeriod, string> = {
  hoje: "hoje",
  "7d": "nos últimos 7 dias",
  "30d": "nos últimos 30 dias",
  mes: "neste mês",
};

/**
 * O dia da Kabrun é o dia de São Paulo, não o do servidor.
 *
 * Em produção o servidor roda em UTC, e ali "hoje" começaria às 21h de ontem no Brasil: a
 * operação abriria o painel de manhã e veria as vendas da noite anterior somadas no dia errado.
 * A equipe é brasileira e o recorte é dela, então é fixo — ao contrário do painel do produtor,
 * onde o fuso sai do país da organização.
 */
const ADMIN_TIMEZONE = timezoneForCountry("BR");

/** O `periodo=` da URL. Valor estranho cai no padrão em vez de quebrar a tela. */
export function parseAdminPeriod(raw: string | string[] | undefined): AdminPeriod {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return ADMIN_PERIODS.find((period) => period === value) ?? DEFAULT_ADMIN_PERIOD;
}

/**
 * De quando o período começa. Sempre da meia-noite de um dia inteiro: "7 dias" é hoje e os seis
 * anteriores, não as últimas 168 horas — contar por hora faria o número de hoje cair de manhã,
 * quando a janela larga o começo do primeiro dia.
 */
export function adminPeriodStart(period: AdminPeriod, now = new Date()): Date {
  const today = startOfDayIn(ADMIN_TIMEZONE, now);
  switch (period) {
    case "hoje":
      return today;
    case "7d":
      return new Date(today.getTime() - 6 * 86_400_000);
    case "30d":
      return new Date(today.getTime() - 29 * 86_400_000);
    case "mes": {
      // Do dia 1º no fuso de São Paulo. Meio-dia para o recuo não escorregar na virada do
      // horário de verão, e aí `startOfDayIn` acerta a meia-noite do dia certo.
      const local = new Date(today.getTime() + 12 * 3_600_000);
      const firstOfMonth = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1, 12));
      return startOfDayIn(ADMIN_TIMEZONE, firstOfMonth);
    }
  }
}

/** Quantos dias o período cobre, para a tela do gráfico que pensa em dias. */
export function adminPeriodDays(period: AdminPeriod, now = new Date()): number {
  const start = adminPeriodStart(period, now);
  const today = startOfDayIn(ADMIN_TIMEZONE, now);
  return Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1;
}
