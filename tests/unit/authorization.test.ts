import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/errors";
import { hasPermission } from "@/modules/organizations/permissions";
import { assertPermission, assertRole, type TenantContext } from "@/modules/organizations/tenant-access";
import { hashTaxId, maskTaxId, validateTaxId } from "@/modules/compliance/tax-identity";
import { safeReturnTo } from "@/modules/auth/session-token";

const ctx = (role: TenantContext["membership"]["role"]) =>
  ({ userId: "u", organization: { id: "o" }, membership: { role } }) as unknown as TenantContext;

describe("Authorization (Hypei-side, roles → permissions)", () => {
  it("grants finance permissions only to finance-capable roles", () => {
    expect(hasPermission("OWNER", "payouts:request")).toBe(true);
    expect(hasPermission("FINANCE", "payouts:request")).toBe(true);
    expect(hasPermission("MARKETING", "payouts:request")).toBe(false);
    expect(hasPermission("VIEWER", "finance:read")).toBe(false);
    expect(hasPermission("SUPPORT", "refunds:create")).toBe(true);
  });

  it("throws ForbiddenError for missing role/permission", () => {
    expect(() => assertRole(ctx("VIEWER"), ["OWNER", "ADMIN"])).toThrow(ForbiddenError);
    expect(() => assertPermission(ctx("MARKETING"), "finance:read")).toThrow(ForbiddenError);
    expect(() => assertPermission(ctx("ADMIN"), "products:write")).not.toThrow();
  });

  it("only allows relative same-origin redirects after login", () => {
    expect(safeReturnTo("/finance")).toBe("/finance");
    expect(safeReturnTo("https://evil.com")).toBe("/dashboard");
    expect(safeReturnTo("//evil.com")).toBe("/dashboard");
  });
});

describe("Tax identity (never stored in clear)", () => {
  it("validates CPF/CNPJ/NIF check digits", () => {
    expect(validateTaxId("CPF", "BR", "529.982.247-25")).toBe(true);
    expect(validateTaxId("CPF", "BR", "111.111.111-11")).toBe(false);
    expect(validateTaxId("CNPJ", "BR", "11.222.333/0001-81")).toBe(true);
    expect(validateTaxId("NIF", "PT", "123456789")).toBe(true);
    expect(validateTaxId("EIN", "US", "12-3456789")).toBe(true);
  });

  it("masks and hashes the document", () => {
    expect(maskTaxId("529.982.247-25")).toBe("•••••••4725");
    const h1 = hashTaxId("CPF", "529.982.247-25", "secret-32-chars-long-for-tests!!");
    const h2 = hashTaxId("CPF", "52998224725", "secret-32-chars-long-for-tests!!");
    expect(h1).toBe(h2);
    expect(h1).not.toContain("52998224725");
  });
});
