import { LanguagesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppDictionary } from "@/lib/i18n/app";

/**
 * Anúncio, não funcionalidade: não existe nada por trás disto ainda. Aparece na lista de
 * conteúdos e no editor, sempre sob a mesma regra — só onde há aula em vídeo, porque é o que
 * se traduz. Num ebook ou numa planilha o aviso seria ruído.
 *
 * Sem data e sem botão de propósito. "Em breve" com botão que não faz nada vira reclamação, e
 * data que não se cumpre custa mais caro do que não ter anunciado.
 */
export function TranslationSoon({ dict }: { dict: AppDictionary }) {
  const t = dict.membersArea.translationSoon;

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-2">
          <LanguagesIcon className="size-4 text-muted-foreground" aria-hidden />
          {t.title}
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
        <CardAction>
          <Badge variant="warning">{t.badge}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="flex flex-wrap gap-1.5">
          {t.languages.map((language) => (
            <li key={language}>
              <Badge variant="outline">{language}</Badge>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t.note}</p>
      </CardContent>
    </Card>
  );
}
