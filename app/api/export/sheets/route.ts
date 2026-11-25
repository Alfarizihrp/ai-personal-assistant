import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isGuestSession } from "@/lib/session-server";
import {
  GUEST_NUTRITION_LOGS,
  GUEST_SCHEDULES,
  GUEST_WORKOUT_LOGS,
} from "@/lib/guest-sandbox";
import {
  buildSchedulesSheetPayload,
  buildWellnessSheetsPayload,
  isValidGoogleAppsScriptUrl,
  type SheetTablePayload,
} from "@/lib/sheets";

export async function GET() {
  const configured = Boolean(
    process.env.GOOGLE_SHEETS_WEBHOOK_URL &&
      isValidGoogleAppsScriptUrl(process.env.GOOGLE_SHEETS_WEBHOOK_URL)
  );
  return NextResponse.json({ configured });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const exportType = body?.type;
    const customWebhookUrl =
      typeof body?.webhookUrl === "string" ? body.webhookUrl.trim() : "";

    if (exportType !== "schedules" && exportType !== "wellness") {
      return NextResponse.json(
        { error: "Tipe ekspor tidak valid. Gunakan 'schedules' atau 'wellness'." },
        { status: 400 }
      );
    }

    const isGuest = await isGuestSession();
    let sheets: SheetTablePayload[] = [];

    if (exportType === "schedules") {
      if (isGuest) {
        sheets = [buildSchedulesSheetPayload(GUEST_SCHEDULES)];
      } else {
        const { data, error } = await supabaseAdmin
          .from("schedules")
          .select("*")
          .order("id", { ascending: false });
        if (error) throw new Error(error.message);
        sheets = [buildSchedulesSheetPayload(data || [])];
      }
    } else {
      if (isGuest) {
        sheets = buildWellnessSheetsPayload(
          GUEST_NUTRITION_LOGS,
          GUEST_WORKOUT_LOGS
        );
      } else {
        const [nutriRes, workoutRes] = await Promise.all([
          supabaseAdmin
            .from("nutrition_logs")
            .select("*")
            .order("id", { ascending: false })
            .limit(100),
          supabaseAdmin
            .from("workout_logs")
            .select("*")
            .order("id", { ascending: false })
            .limit(100),
        ]);
        if (nutriRes.error) throw new Error(nutriRes.error.message);
        if (workoutRes.error) throw new Error(workoutRes.error.message);
        sheets = buildWellnessSheetsPayload(
          nutriRes.data || [],
          workoutRes.data || []
        );
      }
    }

    const totalRows = sheets.reduce((acc, s) => acc + s.rows.length, 0);

    if (isGuest) {
      return NextResponse.json({
        success: true,
        sandbox: true,
        exportedRows: totalRows,
        sheetsCount: sheets.length,
        message: `[Mode Demo] Simulasi pengiriman ${totalRows} baris ke Google Sheets berhasil.`,
      });
    }

    const targetWebhookUrl =
      customWebhookUrl || (process.env.GOOGLE_SHEETS_WEBHOOK_URL || "").trim();

    if (!targetWebhookUrl) {
      return NextResponse.json(
        {
          error:
            "URL Google Apps Script Web App belum diatur. Isi di pengaturan Spreadsheet atau set GOOGLE_SHEETS_WEBHOOK_URL.",
          needsSetup: true,
        },
        { status: 400 }
      );
    }

    if (!isValidGoogleAppsScriptUrl(targetWebhookUrl)) {
      return NextResponse.json(
        {
          error:
            "URL webhook harus berupa URL HTTPS Google Apps Script (https://script.google.com/...).",
        },
        { status: 400 }
      );
    }

    const hookRes = await fetch(targetWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "follow",
      body: JSON.stringify({
        source: "akhi-ai-assistant",
        type: exportType,
        exportedAt: new Date().toISOString(),
        sheets,
      }),
    });

    const rawBody = await hookRes.text();
    let parsedBody: any = null;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {}

    if (!hookRes.ok || parsedBody?.success === false) {
      throw new Error(
        parsedBody?.error ||
          `Google Sheets merespons status ${hookRes.status}. Pastikan Web App Apps Script sudah di-deploy dengan akses 'Anyone'.`
      );
    }

    return NextResponse.json({
      success: true,
      exportedRows: totalRows,
      sheetsCount: sheets.length,
      message: `Berhasil mengirim ${totalRows} baris ke Google Sheets (${sheets
        .map((s) => s.sheetName)
        .join(" & ")}).`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Gagal mengirim data ke Google Sheets." },
      { status: 500 }
    );
  }
}
