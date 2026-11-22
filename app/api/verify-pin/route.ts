import { NextResponse } from "next/server";

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

    if (String(pin).trim() === String(validPin).trim()) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "PIN yang dimasukkan salah, Akhi." },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memverifikasi PIN." },
      { status: 400 }
    );
  }
}