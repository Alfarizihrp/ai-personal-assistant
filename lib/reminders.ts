export const REMINDER_LEAD_MINUTES = 15;
export const REMINDER_GRACE_MINUTES = 30;

export function isScheduleDueForReminder(
  targetDatetime: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!targetDatetime) return false;
  const targetMs = new Date(targetDatetime).getTime();
  if (Number.isNaN(targetMs)) return false;

  const diffMinutes = (targetMs - nowMs) / (1000 * 60);
  return diffMinutes <= REMINDER_LEAD_MINUTES && diffMinutes >= -REMINDER_GRACE_MINUTES;
}

export function getReminderTriggerTimestampSeconds(
  targetDatetime: string | null | undefined,
  nowMs: number = Date.now()
): number | null {
  if (!targetDatetime) return null;
  const targetMs = new Date(targetDatetime).getTime();
  if (Number.isNaN(targetMs)) return null;

  // Jangan jadwalkan jika sudah melewati batas toleransi 30 menit
  if (nowMs - targetMs > REMINDER_GRACE_MINUTES * 60 * 1000) {
    return null;
  }

  const leadMs = targetMs - REMINDER_LEAD_MINUTES * 60 * 1000;
  const effectiveTriggerMs = Math.max(nowMs, leadMs);
  return Math.floor(effectiveTriggerMs / 1000);
}

export function formatReminderBody(
  title: string,
  scheduleTime: string,
  targetDatetime: string,
  nowMs: number = Date.now()
): string {
  const targetMs = new Date(targetDatetime).getTime();
  const diffMinutes = Math.ceil((targetMs - nowMs) / (1000 * 60));

  return diffMinutes > 1
    ? `${diffMinutes} menit lagi: ${title} (${scheduleTime})`
    : `Waktunya sekarang: ${title} (${scheduleTime})`;
}

/**
 * Mengonversi ISO timestamp menjadi nilai input `datetime-local` zona waktu WIB (Asia/Jakarta).
 */
export function toJakartaDateTimeLocalValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/**
 * Mengonversi nilai `datetime-local` WIB (YYYY-MM-DDTHH:mm) ke ISO UTC string.
 */
export function jakartaDateTimeLocalToIso(localValue: string): string | null {
  const trimmed = localValue.trim();
  if (!trimmed) return null;
  const parsed = new Date(`${trimmed}:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function resolveAppBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const prodUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prodUrl) return `https://${prodUrl.replace(/^https?:\/\//, "")}`;

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;

  return "";
}

/**
 * Menjadwalkan trigger HTTP tepat waktu (H-15 menit) melalui Upstash QStash v2
 * jika QSTASH_TOKEN, CRON_SECRET, dan URL publik aplikasi tersedia.
 */
export async function scheduleExactPushReminder(
  scheduleId: number,
  targetDatetime: string | null | undefined
): Promise<{ scheduled: boolean; reason?: string }> {
  const qstashToken = process.env.QSTASH_TOKEN;
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = resolveAppBaseUrl();

  if (!qstashToken || !cronSecret || !baseUrl) {
    return { scheduled: false, reason: "qstash_unconfigured" };
  }

  const triggerAtSec = getReminderTriggerTimestampSeconds(targetDatetime);
  if (!triggerAtSec) {
    return { scheduled: false, reason: "invalid_or_past_target" };
  }

  const destinationUrl = `${baseUrl}/api/cron/reminders?scheduleId=${scheduleId}`;

  try {
    const res = await fetch(`https://qstash.upstash.io/v2/publish/${destinationUrl}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        "Upstash-Method": "GET",
        "Upstash-Not-Before": String(triggerAtSec),
        "Upstash-Forward-Authorization": `Bearer ${cronSecret}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("[QStash Reminder] Gagal menjadwalkan:", res.status, errText);
      return { scheduled: false, reason: `http_${res.status}` };
    }

    return { scheduled: true };
  } catch (err: any) {
    console.warn("[QStash Reminder] Error koneksi:", err?.message || err);
    return { scheduled: false, reason: "network_error" };
  }
}
