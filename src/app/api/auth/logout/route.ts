import type { NextRequest } from "next/server";
import { json, rejectCrossSite } from "@/lib/server/http";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return res;
}
