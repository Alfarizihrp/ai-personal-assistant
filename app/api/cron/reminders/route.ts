import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized Cron Trigger" }, { status: 401 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:admin@akhi-assistant.app";

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: "VAPID keys belum diatur." }, { status: 500 });
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    // Ambil semua jadwal yang belum selesai dan belum diingatkan
    const { data: schedules, error: schedErr } = await supabaseAdmin
      .from("schedules")
      .select("*")
      .eq("is_done", false)
      .eq("reminded", false)
      .not("target_datetime", "is", null);

    if (schedErr) throw new Error(schedErr.message);

    const now = Date.now();
    const dueSchedules = (schedules || []).filter((item) => {
      const target = new Date(item.target_datetime).getTime();
      const diffMinutes = (target - now) / (1000 * 60);
      return diffMinutes <= 15 && diffMinutes >= -30;
    });

    if (dueSchedules.length === 0) {
      return NextResponse.json({ processed: 0, message: "Tidak ada jadwal jatuh tempo." });
    }

    const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("*");

    for (const item of dueSchedules) {
      const target = new Date(item.target_datetime).getTime();
      const diffMinutes = Math.ceil((target - now) / (1000 * 60));

      const bodyText =
        diffMinutes > 1
          ? `${diffMinutes} menit lagi: ${item.title} (${item.schedule_time})`
          : `Waktunya sekarang: ${item.title} (${item.schedule_time})`;

      const payload = JSON.stringify({
        title: "Pengingat Jadwal — Akhi AI",
        body: bodyText,
        tag: `schedule-${item.id}`,
        url: "/",
      });

      for (const sub of subs || []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
        } catch (pushErr: any) {
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
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
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}