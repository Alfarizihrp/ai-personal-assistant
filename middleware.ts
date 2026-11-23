import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Lindungi semua endpoint API privat
  if (pathname.startsWith("/api/")) {
    // Endpoint login PIN, pengecekan status sesi, dan cron latar belakang diperbolehkan lewat
    if (
      pathname === "/api/verify-pin" ||
      pathname === "/api/session" ||
      pathname === "/api/cron/reminders"
    ) {
      return NextResponse.next();
    }

    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: Sesi tidak ditemukan. Silakan masukkan PIN." },
        { status: 401 }
      );
    }

    const verified = await verifySessionToken(token);
    if (!verified) {
      return NextResponse.json(
        { error: "Unauthorized: Sesi tidak valid atau telah kedaluwarsa." },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};