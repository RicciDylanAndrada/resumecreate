import { ACCESS_COOKIE, accessToken } from "@/lib/access";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const expected = process.env.ACCESS_CODE;
  if (!expected) return Response.json({ ok: true });

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (typeof code !== "string" || code.trim() !== expected) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 800));
    return Response.json({ error: "That code isn't right. Check it and try again." }, { status: 401 });
  }

  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json",
      "set-cookie": `${ACCESS_COOKIE}=${await accessToken(expected)}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`,
    },
  });
}
