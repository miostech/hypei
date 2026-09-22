import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken, type SessionClaims } from "@/modules/auth/session-token";

/**
 * Optimistic route protection only (no DB access): a valid signed session cookie is required
 * for private areas. Real authorization (membership/roles) happens server-side in each page/action.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/sales",
  "/products",
  "/offers",
  "/checkouts",
  "/customers",
  "/subscriptions",
  "/finance",
  "/payouts",
  "/affiliates",
  "/coupons",
  "/members-area",
  "/analytics",
  "/integrations",
  "/settings",
  "/admin",
  "/members",
];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);

  if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const secret = process.env.SESSION_SECRET ?? "";
    const session = await verifyToken<SessionClaims>(request.cookies.get(SESSION_COOKIE)?.value, secret);
    if (!session) {
      const login = new URL("/api/auth/login", request.url);
      login.searchParams.set("returnTo", `${pathname}${search}`);
      return NextResponse.redirect(login);
    }
  }

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
