export interface SheetTablePayload {
  sheetName: string;
  headers: string[];
  rows: (string | number | boolean)[][];
}

export interface ScheduleSheetRow {
  id: number;
  title: string;
  schedule_time: string;
  target_datetime?: string | null;
  is_done: boolean;
  reminded?: boolean;
  created_at?: string;
}

export interface NutritionSheetRow {
  id: number;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ai_notes?: string | null;
  created_at: string;
}

export interface WorkoutSheetRow {
  id: number;
  routine_name: string;
  duration_minutes: number;
  ai_plan?: string | null;
  ai_evaluation?: string | null;
  is_completed: boolean;
  created_at: string;
}

function formatWibDateTime(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return (
    new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d) + " WIB"
  );
}

/**
 * Validasi ketat URL Google Apps Script Web App untuk mencegah SSRF.
 */
export function isValidGoogleAppsScriptUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "script.google.com" ||
        parsed.hostname === "script.googleusercontent.com")
    );
  } catch {
    return false;
  }
}

export function buildSchedulesSheetPayload(
  schedules: ScheduleSheetRow[]
): SheetTablePayload {
  return {
    sheetName: "Jadwal",
    headers: [
      "ID",
      "Agenda",
      "Label Waktu",
      "Target Pengingat (WIB)",
      "Status",
      "Sudah Diingatkan",
      "Dibuat (WIB)",
    ],
    rows: schedules.map((s) => [
      s.id,
      s.title,
      s.schedule_time || "-",
      formatWibDateTime(s.target_datetime),
      s.is_done ? "Selesai" : "Belum Selesai",
      s.reminded ? "Ya" : "Belum",
      formatWibDateTime(s.created_at),
    ]),
  };
}

export function buildWellnessSheetsPayload(
  nutrition: NutritionSheetRow[],
  workouts: WorkoutSheetRow[]
): SheetTablePayload[] {
  const nutritionSheet: SheetTablePayload = {
    sheetName: "Nutrisi",
    headers: [
      "ID",
      "Nama Makanan",
      "Kalori (kkal)",
      "Protein (g)",
      "Karbohidrat (g)",
      "Lemak (g)",
      "Catatan AI",
      "Waktu Catat (WIB)",
    ],
    rows: nutrition.map((n) => [
      n.id,
      n.food_name,
      Number(n.calories) || 0,
      Number(n.protein_g) || 0,
      Number(n.carbs_g) || 0,
      Number(n.fat_g) || 0,
      n.ai_notes || "-",
      formatWibDateTime(n.created_at),
    ]),
  };

  const workoutSheet: SheetTablePayload = {
    sheetName: "Olahraga",
    headers: [
      "ID",
      "Nama Latihan",
      "Durasi (menit)",
      "Rencana AI",
      "Evaluasi AI",
      "Status",
      "Waktu Catat (WIB)",
    ],
    rows: workouts.map((w) => [
      w.id,
      w.routine_name,
      Number(w.duration_minutes) || 0,
      w.ai_plan || "-",
      w.ai_evaluation || "-",
      w.is_completed ? "Selesai" : "Belum Selesai",
      formatWibDateTime(w.created_at),
    ]),
  };

  return [nutritionSheet, workoutSheet];
}

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = payload.sheets || [];
    var totalRows = 0;

    sheets.forEach(function (item) {
      var sheet = ss.getSheetByName(item.sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(item.sheetName);
      }
      sheet.clearContents();

      var headers = item.headers || [];
      var rows = item.rows || [];
      if (headers.length > 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
      }
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
        totalRows += rows.length;
      }
      sheet.autoResizeColumns(1, Math.max(1, headers.length));
    });

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, totalRows: totalRows }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;
