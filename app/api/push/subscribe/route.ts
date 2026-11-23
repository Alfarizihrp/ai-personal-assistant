import { NextResponse } from "next/server";
import * as webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase-server";

function initWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@akhi-assistant.app";

  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys belum dikonfigurasi di environment variables.");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

// POST: Simpan atau perbarui PushSubscription perangkat ke Supabase
export async function POST(req: Request) {
  try {
    const subscription = await req.json();

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json(
        { error: "Data PushSubscription tidak lengkap." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      { onConflict: "endpoint" }
    );

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Kirim notifikasi uji coba langsung ke perangkat terdaftar
export async function PUT() {
  try {
    initWebPush();

    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*");

    if (error) throw new Error(error.message);
    if (!subs || subs.length === 0) {
      return NextResponse.json(
        { error: "Belum ada perangkat yang mengaktifkan Push Notification." },
        { status: 404 }
      );
    }

    const payload = JSON.stringify({
      title: "Assalaamu 'alaikum, Akhi!",
      body: "Web Push Notification latar belakang sudah aktif dan terhubung.",
      tag: "test-push",
      url: "/",
    });

    let sentCount = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sentCount++;
      } catch (pushErr: any) {
        // Hapus endpoint yang sudah kedaluwarsa (410 Gone / 404)
        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    return NextResponse.json({ success: true, sentCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}