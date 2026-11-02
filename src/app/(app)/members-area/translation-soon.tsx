import { LanguagesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const LANGUAGES = ["Português", "Inglês", "Espanhol"];

/**
 * Anúncio, não funcionalidade: não existe nada por trás disto ainda. Aparece na lista de
 * conteúdos e no editor, sempre sob a mesma regra — só onde há aula em vídeo, porque é o que
 * se traduz. Num ebook ou numa planilha o aviso seria ruído.
 *
 * Sem data e sem botão de propósito. "Em breve" com botão que não faz nada vira reclamação, e
 * data que não se cumpre custa mais caro do que não ter anunciado.
 */
export function TranslationSoon() {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-2">
          <LanguagesIcon className="size-4 text-muted-foreground" aria-hidden />
          Traduzir as aulas
        </CardTitle>
        <CardDescription>Vender o mesmo conteúdo em outro idioma, sem regravar as aulas.</CardDescription>
        <CardAction>
          <Badge variant="warning">Em breve</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="flex flex-wrap gap-1.5">
          {LANGUAGES.map((language) => (
            <li key={language}>
              <Badge variant="outline">{language}</Badge>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Ainda não está disponível e não há nada para configurar agora.
        </p>
      </CardContent>
    </Card>
  );
}
