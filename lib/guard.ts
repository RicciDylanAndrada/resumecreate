import { ACCESS_COOKIE, unlocked } from "./access";

// Second check behind middleware.ts, so the API never spends the owner's
// credits for a visitor who hasn't entered the access code.
export async function denied(req: Request): Promise<Response | null> {
  const cookies = req.headers.get("cookie") || "";
  const match = cookies.split(/;\s*/).find((c) => c.startsWith(`${ACCESS_COOKIE}=`));
  if (await unlocked(match?.slice(ACCESS_COOKIE.length + 1))) return null;
  return Response.json({ error: "Enter the access code to use this site.", locked: true }, { status: 401 });
}
