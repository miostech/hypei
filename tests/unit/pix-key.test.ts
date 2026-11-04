import { describe, expect, it } from "vitest";
import { maskPixKey, parsePixKey } from "@/modules/payouts/pix-key";

/** CPF e CNPJ válidos (dígito verificador correto), os mesmos usados nos outros testes. */
const CPF = "19100000000";
const CNPJ = "19131243000197";

describe("parsePixKey", () => {
  it("reconhece o tipo pelo formato, sem perguntar à produtora", () => {
    expect(parsePixKey("ca@kabrun.dev")).toEqual({ type: "EMAIL", value: "ca@kabrun.dev" });
    expect(parsePixKey("123e4567-e89b-42d3-a456-426614174000")).toEqual({
      type: "EVP",
      value: "123e4567-e89b-42d3-a456-426614174000",
    });
    expect(parsePixKey(CPF)).toEqual({ type: "CPF", value: CPF });
    expect(parsePixKey(CNPJ)).toEqual({ type: "CNPJ", value: CNPJ });
  });

  it("normaliza o que a produtora digita para o formato do DICT", () => {
    expect(parsePixKey("191.000.000-00")).toEqual({ type: "CPF", value: CPF });
    expect(parsePixKey("19.131.243/0001-97")).toEqual({ type: "CNPJ", value: CNPJ });
    expect(parsePixKey("  CA@Kabrun.DEV ")).toEqual({ type: "EMAIL", value: "ca@kabrun.dev" });
    expect(parsePixKey("(11) 99999-9999")).toEqual({ type: "PHONE", value: "+5511999999999" });
    expect(parsePixKey("+55 11 99999-9999")).toEqual({ type: "PHONE", value: "+5511999999999" });
  });

  it("recusa documento com dígito verificador errado", () => {
    // Onze dígitos que parecem um CPF: sem a checagem, viram um saque que falha semanas depois.
    // Também não escorregam para telefone, porque não têm forma de telefone brasileiro.
    expect(parsePixKey("12345678900")).toBeNull();
    expect(parsePixKey("19131243000100")).toBeNull();
    expect(parsePixKey("11111111111")).toBeNull();
  });

  it("recusa telefone que não existe no Brasil", () => {
    expect(parsePixKey("(11) 3333-3333")).toEqual({ type: "PHONE", value: "+551133333333" });
    // DDD 01 não existe, e celular que não começa em 9 também não.
    expect(parsePixKey("(01) 99999-9999")).toBeNull();
    expect(parsePixKey("(11) 89999-9999")).toBeNull();
  });

  it("recusa o que o DICT não aceitaria", () => {
    expect(parsePixKey("")).toBeNull();
    expect(parsePixKey("   ")).toBeNull();
    expect(parsePixKey("sem-arroba-nem-numero")).toBeNull();
    expect(parsePixKey("ca@kabrun")).toBeNull();
    expect(parsePixKey(`${"a".repeat(72)}@kabrun.dev`)).toBeNull();
    expect(parsePixKey("123e4567-e89b-42d3-a456")).toBeNull();
  });
});

describe("maskPixKey", () => {
  it("esconde o suficiente para a chave poder ir para log e auditoria", () => {
    expect(maskPixKey({ type: "CPF", value: CPF })).toBe("•••.•••.000-••");
    expect(maskPixKey({ type: "CNPJ", value: CNPJ })).toBe("••.•••.•••/0001-••");
    expect(maskPixKey({ type: "EMAIL", value: "camila@kabrun.dev" })).toBe("ca••••@kabrun.dev");
    expect(maskPixKey({ type: "PHONE", value: "+5511999999999" })).toBe("+55 ••••• 9999");
    expect(maskPixKey({ type: "EVP", value: "123e4567-e89b-42d3-a456-426614174000" })).toBe("123e4567…4000");
  });
});
