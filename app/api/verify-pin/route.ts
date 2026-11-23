import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Mode Demo Tamu (Recruiter Sandbox) tanpa membuka data asli
    if (body?.mode === "guest") {
      const guestToken = await createSessionToken("guest");
      const response = NextResponse.json({
        success: true,
        role: "guest",
        message: "Sesi Demo Recruiter aktif selama 30 menit.",
      });

      response.cookies.set("akhi_session", guestToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 30, // 30 menit
      });

      return response;
    }

    // Mode Pemilik (Owner) dengan PIN 6 digit
    const { pin } = body;
    const validPin = process.env.APP_ACCESS_PIN;

    if (!validPin) {
      return NextResponse.json(
        { error: "Konfigurasi APP_ACCESS_PIN belum diatur di server." },
        { status: 500 }
      );
    }

    if (!pin || String(pin).trim() !== String(validPin).trim()) {
      return NextResponse.json(
        { error: "Kode PIN tidak valid." },
        { status: 401 }
      );
    }

    const token = await createSessionToken("owner");
    const response = NextResponse.json({
      success: true,
      role: "owner",
      message: "Autentikasi berhasil.",
    });

    response.cookies.set("akhi_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Gagal memverifikasi akses." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("akhi_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}