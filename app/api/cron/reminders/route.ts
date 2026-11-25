import { NextResponse } from "next/server";
import * as webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  formatReminderBody,
  isScheduleDueForReminder,
} from "@/lib/reminders";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET belum dikonfigurasi di server." },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized Cron Trigger" }, { status: 401 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:admin@akhi-assistant.app";

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: "VAPID keys belum diatur." }, { status: 500 });
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const { searchParams } = new URL(req.url);
    const scheduleIdParam = searchParams.get("scheduleId");

    // Ambil jadwal yang belum selesai dan belum diingatkan (opsional spesifik per scheduleId)
    let query = supabaseAdmin
      .from("schedules")
      .select("*")
      .eq("is_done", false)
      .eq("reminded", false)
      .not("target_datetime", "is", null);

    if (scheduleIdParam && Number.isFinite(Number(scheduleIdParam))) {
      query = query.eq("id", Number(scheduleIdParam));
    }

    const { data: schedules, error: schedErr } = await query;

    if (schedErr) throw new Error(schedErr.message);

    const now = Date.now();
    const dueSchedules = (schedules || []).filter((item) =>
      isScheduleDueForReminder(item.target_datetime, now)
    );

    if (dueSchedules.length === 0) {
      return NextResponse.json({ processed: 0, sentCount: 0, message: "Tidak ada jadwal jatuh tempo." });
    }

    const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("*");
    let sentCount = 0;

    for (const item of dueSchedules) {
      const bodyText = formatReminderBody(
        item.title,
        item.schedule_time,
        item.target_datetime,
        now
      );

      const payload = JSON.stringify({
        title: "Pengingat Jadwal — Akhi AI",
        body: bodyText,
        tag: `schedule-${item.id}`,
        url: "/",
      });

      const results = await Promise.allSettled(
        (subs || []).map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload
            );
            return true;
          } catch (pushErr: any) {
            if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
              await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
            }
            return false;
          }
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) sentCount++;
      }

      // Tandai jadwal sudah diingatkan agar tidak terkirim ganda
      await supabaseAdmin
        .from("schedules")
        .update({ reminded: true })
        .eq("id", item.id);
    }

    return NextResponse.json({
      success: true,
      processed: dueSchedules.length,
      sentCount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}