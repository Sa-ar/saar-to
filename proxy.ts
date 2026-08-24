import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getApexOrigin, parseVanityLabel } from "@/lib/hosts";
import { HTTP_STATUS } from "@/lib/http";

function isProtectedPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/new" ||
    pathname.startsWith("/stats") ||
    pathname.startsWith("/api/urls") ||
    pathname.startsWith("/api/invites") ||
    pathname.startsWith("/api/stats") ||
    pathname.startsWith("/api/blob")
  );
}

function isAppPathOnVanity(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/stats") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/go/")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const vanityLabel = parseVanityLabel(request.headers.get("host"));

  if (vanityLabel) {
    if (pathname === "/" || pathname === "") {
      const url = request.nextUrl.clone();
      url.pathname = `/go/${encodeURIComponent(vanityLabel)}`;
      return NextResponse.rewrite(url);
    }

    if (isAppPathOnVanity(pathname)) {
      const apex = getApexOrigin();
      return NextResponse.redirect(new URL(pathname + request.nextUrl.search, apex));
    }

    return new NextResponse("Not Found", { status: HTTP_STATUS.NOT_FOUND });
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (token) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: HTTP_STATUS.UNAUTHORIZED });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/",
    "/new",
    "/login",
    "/register",
    "/stats/:path*",
    "/api/:path*",
    "/go/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
