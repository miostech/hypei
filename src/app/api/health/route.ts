import { NextResponse } from "next/server";

/** Liveness probe (no dependencies touched). */
export function GET() {
  return NextResponse.json({ status: "ok", service: "ripay-web" });
}
