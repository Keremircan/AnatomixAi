import type { NextRequest } from "next/server";
import { error, json, readJson, rejectCrossSite } from "@/lib/server/http";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/server/session";
import { deleteHealthData, dismissHealthReminder, getHealthData, saveHealthData } from "@/lib/server/health";
import { normalizeHealthInput } from "@/lib/health";

/**
 * Oturumdaki kullanıcının kişiselleştirilmiş sağlık profili.
 * GET: profil + hatırlatma bandının gösterilip gösterilmeyeceği · PUT/POST: tam profil (UPSERT)
 * PATCH { action: "dismiss" }: "Şimdi değil" · DELETE: profili tamamen siler.
 * Kimlik yalnızca imzalı oturum çerezinden alınır; gövdede kullanıcı kimliği kabul edilmez.
 */
async function sessionUserId(request: NextRequest) {
  return (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value))?.sub ?? null;
}

export async function GET(request: NextRequest) {
  const userId = await sessionUserId(request);
  if (!userId) return error(401, "Oturum gerekli.");
  return json(await getHealthData(userId));
}

async function save(request: NextRequest) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;
  const userId = await sessionUserId(request);
  if (!userId) return error(401, "Oturum gerekli.");
  const body = await readJson(request);
  if (!body) return error(400, "Geçersiz istek.");
  const health = await saveHealthData(userId, normalizeHealthInput(body));
  if (!health) return error(401, "Oturum gerekli.");
  return json({ health, remind: false });
}

export const PUT = save;
export const POST = save;

export async function PATCH(request: NextRequest) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;
  const userId = await sessionUserId(request);
  if (!userId) return error(401, "Oturum gerekli.");
  const body = await readJson(request);
  if (body?.action !== "dismiss") return error(400, "Geçersiz istek.");
  await dismissHealthReminder(userId);
  return json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return error(403, "Bu istek kabul edilmedi.");
  const userId = await sessionUserId(request);
  if (!userId) return error(401, "Oturum gerekli.");
  await deleteHealthData(userId);
  return json({ health: null, remind: true });
}
