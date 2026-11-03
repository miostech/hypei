import { describe, expect, it } from "vitest";
import { classifyDelivery } from "@/modules/products/product-delivery";

/**
 * O checkout cobra sem checar se o produto entrega algo: o pagamento entra no ledger e o
 * comprador recebe um e-mail sem link. Este classificador é o que faz essa falha aparecer
 * para o produtor antes da primeira venda, então um falso "pronto" é o erro caro aqui.
 */
describe("Entrega do produto", () => {
  it("não entrega nada quando o produto não tem conteúdo", () => {
    expect(classifyDelivery(null)).toEqual({ ready: false, reason: "missing" });
  });

  it("não entrega quando o conteúdo existe mas está sem aulas", () => {
    expect(classifyDelivery({ id: "crs_1", published: true, lessons: 0 })).toEqual({ ready: false, reason: "empty", courseId: "crs_1" });
  });

  it("não entrega enquanto o conteúdo é rascunho", () => {
    expect(classifyDelivery({ id: "crs_1", published: false, lessons: 3 })).toEqual({ ready: false, reason: "unpublished", courseId: "crs_1" });
  });

  it("aponta a aula que falta antes do rascunho, porque é o que bloqueia publicar", () => {
    expect(classifyDelivery({ id: "crs_1", published: false, lessons: 0 })).toMatchObject({ reason: "empty" });
  });

  it("entrega só com conteúdo publicado e pelo menos uma aula", () => {
    expect(classifyDelivery({ id: "crs_1", published: true, lessons: 1 })).toEqual({ ready: true, courseId: "crs_1" });
  });
});
