import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, unlocked } from "@/lib/access";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/unlock" || pathname === "/api/unlock") return NextResponse.next();
  if (await unlocked(req.cookies.get(ACCESS_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Enter the access code to use this site.", locked: true },
      { status: 401 }
    );
  }
  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  return NextResponse.redirect(url);
}
