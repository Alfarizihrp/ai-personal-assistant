import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { PinRateLimiter, verifyPinTimingSafe } from "@/lib/rate-limit";
import {
  calculateDailyNutritionSummary,
  getJakartaDateKey,
} from "@/lib/nutrition";

const mockIsGuestSession = vi.fn<() => Promise<boolean>>();

vi.mock("@/lib/session-server", () => ({
  isGuestSession: () => mockIsGuestSession(),
}));

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

describe("Keamanan Auth, Rate Limiting & Cron Secret", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET_KEY = "kunci_rahasia_pengujian_vitest_minimal_32_karakter";
  });

  it("PinRateLimiter memblokir setelah batas gagal dan pulih setelah reset/kedaluwarsa", () => {
    const limiter = new PinRateLimiter(3, 60_000);
    const key = "203.0.113.10";
    const t0 = 1_700_000_000_000;

    expect(limiter.check(key, t0).allowed).toBe(true);
    expect(limiter.recordFailure(key, t0 + 100).blocked).toBe(false);
    expect(limiter.recordFailure(key, t0 + 200).blocked).toBe(false);

    const thirdFail = limiter.recordFailure(key, t0 + 300);
    expect(thirdFail.blocked).toBe(true);
    expect(limiter.check(key, t0 + 400).allowed).toBe(false);

    // Setelah window berlalu (resetAt = t0 + 100 + 60_000 = t0 + 60_100), akses diizinkan lagi
    expect(limiter.check(key, t0 + 60_101).allowed).toBe(true);

    // Reset eksplisit membersihkan catatan gagal
    limiter.recordFailure(key, t0 + 70_000);
    limiter.reset(key);
    expect(limiter.check(key, t0 + 70_100).remaining).toBe(3);
  });

  it("verifyPinTimingSafe memvalidasi PIN secara akurat dan menolak input salah", () => {
    expect(verifyPinTimingSafe("123456", "123456")).toBe(true);
    expect(verifyPinTimingSafe(" 123456 ", "123456")).toBe(true);
    expect(verifyPinTimingSafe("123457", "123456")).toBe(false);
    expect(verifyPinTimingSafe("", "123456")).toBe(false);
    expect(verifyPinTimingSafe("123", "123456")).toBe(false);
  });

  it("GET /api/session mengembalikan role dan user dari JWT yang valid", async () => {
    const { createSessionToken, SESSION_COOKIE_NAME } = await import("@/lib/auth");
    const { GET } = await import("@/app/api/session/route");

    const guestToken = await createSessionToken("guest");
    const req = new NextRequest("http://localhost/api/session", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${guestToken}`,
      },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      authenticated: true,
      role: "guest",
      user: "Recruiter Demo",
    });
  });

  it("GET /api/cron/reminders menolak request jika CRON_SECRET belum diatur atau salah", async () => {
    const { GET } = await import("@/app/api/cron/reminders/route");

    delete process.env.CRON_SECRET;
    const resNoSecret = await GET(new Request("http://localhost/api/cron/reminders"));
    expect(resNoSecret.status).toBe(500);

    process.env.CRON_SECRET = "rahasia-cron-uji";
    const resWrongHeader = await GET(
      new Request("http://localhost/api/cron/reminders", {
        headers: { authorization: "Bearer salah" },
      })
    );
    expect(resWrongHeader.status).toBe(401);
  });
});

describe("Isolasi Mode Guest pada API AI & Push", () => {
  beforeEach(() => {
    mockIsGuestSession.mockResolvedValue(true);
  });

  it("POST dan PUT /api/push/subscribe menolak sesi guest dengan 403", async () => {
    const { POST, PUT } = await import("@/app/api/push/subscribe/route");

    const postRes = await POST(
      new Request("http://localhost/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: "https://example.com/push",
          keys: { p256dh: "a", auth: "b" },
        }),
      })
    );
    expect(postRes.status).toBe(403);

    const putRes = await PUT();
    expect(putRes.status).toBe(403);
  });

  it("POST /api/daily-briefing dan /api/expand-idea mengembalikan simulasi sandbox untuk guest", async () => {
    const { POST: briefingPost } = await import("@/app/api/daily-briefing/route");
    const { POST: expandPost } = await import("@/app/api/expand-idea/route");

    const briefingRes = await briefingPost(
      new Request("http://localhost/api/daily-briefing", {
        method: "POST",
        body: JSON.stringify({
          schedules: [{ title: "Kajian", schedule_time: "20:00 WIB", is_done: false }],
        }),
      })
    );
    const briefingData = await briefingRes.json();
    expect(briefingRes.status).toBe(200);
    expect(briefingData.sandbox).toBe(true);
    expect(briefingData.replyMessage).toContain("Kajian");

    const expandRes = await expandPost(
      new Request("http://localhost/api/expand-idea", {
        method: "POST",
        body: JSON.stringify({ title: "Hybrid Search", content: "BM25 + pgvector" }),
      })
    );
    const expandData = await expandRes.json();
    expect(expandRes.status).toBe(200);
    expect(expandData.sandbox).toBe(true);
    expect(expandData.expansion).toContain("Hybrid Search");
  });
});

describe("Filter Nutrisi Harian (Asia/Jakarta)", () => {
  it("hanya menjumlahkan kalori dan protein untuk tanggal hari ini di WIB", () => {
    // 25 Nov 2026 pukul 10:00 WIB (03:00 UTC)
    const now = new Date("2026-11-25T03:00:00.000Z");
    expect(getJakartaDateKey(now)).toBe("2026-11-25");

    const logs = [
      // Hari ini di WIB (25 Nov 2026 00:30 WIB = 24 Nov 17:30 UTC)
      { calories: 450, protein_g: 30, created_at: "2026-11-24T17:30:00.000Z" },
      // Hari ini di WIB (25 Nov 2026 08:00 WIB = 25 Nov 01:00 UTC)
      { calories: 300, protein_g: 20, created_at: "2026-11-25T01:00:00.000Z" },
      // Kemarin di WIB (24 Nov 2026 23:30 WIB = 24 Nov 16:30 UTC)
      { calories: 900, protein_g: 50, created_at: "2026-11-24T16:30:00.000Z" },
    ];

    const summary = calculateDailyNutritionSummary(logs, now);
    expect(summary.todayEntries).toHaveLength(2);
    expect(summary.totalCalories).toBe(750);
    expect(summary.totalProtein).toBe(50);
  });
});
