import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { pin } = await req.json();
    const validPin = process.env.APP_ACCESS_PIN;

    if (!validPin) {
      return NextResponse.json(
        { error: "APP_ACCESS_PIN belum dikonfigurasi di server." },
        { status: 500 }
      );
    }

    if (String(pin).trim() !== String(validPin).trim()) {
      return NextResponse.json(
        { error: "PIN yang dimasukkan salah, Akhi." },
        { status: 401 }
      );
    }

    const token = await createSessionToken();
    const response = NextResponse.json({ success: true });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true, // Tidak bisa diakses JavaScript browser (anti-XSS)
      secure: process.env.NODE_ENV === "production", // Wajib HTTPS di Vercel
      sameSite: "strict", // Perlindungan penuh terhadap serangan CSRF
      path: "/",
      maxAge: 60 * 60 * 24, // 24 jam
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memverifikasi PIN." },
      { status: 400 }
    );
  }
}

// Endpoint untuk mengunci / menghapus HTTP-Only Cookie saat tombol gembok ditekan
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}