import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatReminderBody,
  getReminderTriggerTimestampSeconds,
  isScheduleDueForReminder,
  jakartaDateTimeLocalToIso,
  scheduleExactPushReminder,
  toJakartaDateTimeLocalValue,
} from "@/lib/reminders";

const mockGenerateContent = vi.fn();
const mockRetrieveRagContext = vi.fn();
const mockIsGuestSession = vi.fn<() => Promise<boolean>>();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: mockGenerateContent,
        embedContent: vi.fn(),
      };
    },
    Type: {
      OBJECT: "OBJECT",
      STRING: "STRING",
      NUMBER: "NUMBER",
      BOOLEAN: "BOOLEAN",
    },
  };
});

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/session-server", () => ({
  isGuestSession: () => mockIsGuestSession(),
}));

vi.mock("@/lib/rag-retrieval", () => ({
  retrieveRagContext: (...args: any[]) => mockRetrieveRagContext(...args),
}));

describe("Konfigurasi Model Gemini Terpadu & Fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("beralih ke model berikutnya saat terjadi error 503 atau 429", async () => {
    const { generateContentWithFallback } = await import("@/lib/gemini");

    mockGenerateContent
      .mockRejectedValueOnce({ status: 503, message: "503 UNAVAILABLE" })
      .mockResolvedValueOnce({ text: "ok-from-fallback" });

    const res = await generateContentWithFallback({
      contents: ["Halo"],
      models: ["gemini-3.8-flash", "gemini-3.8-flash-lite"],
      retryDelayMs: 0,
    });

    expect(res.text).toBe("ok-from-fallback");
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(mockGenerateContent.mock.calls[0][0].model).toBe("gemini-3.8-flash");
    expect(mockGenerateContent.mock.calls[1][0].model).toBe("gemini-3.8-flash-lite");
  });

  it("langsung melempar error non-retryable (mis. 400 Bad Request)", async () => {
    const { generateContentWithFallback } = await import("@/lib/gemini");

    mockGenerateContent.mockRejectedValueOnce({ status: 400, message: "Invalid argument" });

    await expect(
      generateContentWithFallback({
        contents: ["Halo"],
        models: ["gemini-3.8-flash", "gemini-3.8-flash-lite"],
        retryDelayMs: 0,
      })
    ).rejects.toMatchObject({ status: 400 });

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });
});

describe("RAG untuk Input Suara (/api/assistant)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsGuestSession.mockResolvedValue(false);
  });

  it("melakukan pra-transkripsi audio, menjalankan RAG, dan menyertakan sumber pada respons", async () => {
    const { POST } = await import("@/app/api/assistant/route");

    mockRetrieveRagContext.mockResolvedValueOnce({
      ragContext: '\nREFERENSI MEMORI:\n[Sumber 1: "Catatan Tauhid"]\nIsi ringkasan.\n',
      matchedSources: [{ title: "Catatan Tauhid", category: "Catatan Ilmu & Kajian", similarity: 91 }],
    });

    mockGenerateContent
      .mockResolvedValueOnce({ text: "Apa ringkasan catatan tauhid saya?" })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          transcript: "Apa ringkasan catatan tauhid saya?",
          detectedLang: "id",
          intent: "general_chat",
          replyMessage: "Berdasarkan Catatan Tauhid Anda...",
          spokenText: "Berdasarkan Catatan Tauhid Anda...",
        }),
      });

    const res = await POST(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        body: JSON.stringify({
          audioBase64: "ZmFrZV9hdWRpbw==",
          mimeType: "audio/webm",
        }),
      })
    );

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(mockRetrieveRagContext).toHaveBeenCalledWith(
      "Apa ringkasan catatan tauhid saya?",
      false
    );
    expect(data.sources).toEqual([
      { title: "Catatan Tauhid", category: "Catatan Ilmu & Kajian", similarity: 91 },
    ]);
    expect(data.replyMessage).toContain("Catatan Tauhid");
  });
});

describe("Utilitas & Penjadwalan Pengingat H-15 Menit", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("mengevaluasi jendela pengingat -30 menit s/d +15 menit secara akurat", () => {
    const now = new Date("2026-11-25T10:00:00.000Z").getTime();

    expect(isScheduleDueForReminder("2026-11-25T10:15:00.000Z", now)).toBe(true);
    expect(isScheduleDueForReminder("2026-11-25T10:20:00.000Z", now)).toBe(false);
    expect(isScheduleDueForReminder("2026-11-25T09:30:00.000Z", now)).toBe(true);
    expect(isScheduleDueForReminder("2026-11-25T09:20:00.000Z", now)).toBe(false);
    expect(isScheduleDueForReminder(null, now)).toBe(false);
  });

  it("menghitung timestamp QStash tepat H-15 menit dan memformat WIB datetime-local", () => {
    const now = new Date("2026-11-25T10:00:00.000Z").getTime();
    const target = "2026-11-25T11:00:00.000Z"; // 18:00 WIB

    const triggerSec = getReminderTriggerTimestampSeconds(target, now);
    expect(triggerSec).toBe(Math.floor(new Date("2026-11-25T10:45:00.000Z").getTime() / 1000));

    const localStr = toJakartaDateTimeLocalValue(target);
    expect(localStr).toBe("2026-11-25T18:00");
    expect(jakartaDateTimeLocalToIso(localStr)).toBe(target);

    expect(formatReminderBody("Kajian", "18:00 WIB", "2026-11-25T10:10:00.000Z", now)).toBe(
      "10 menit lagi: Kajian (18:00 WIB)"
    );
  });

  it("memanggil Upstash QStash v2 dengan header otentikasi & Not-Before saat terkonfigurasi", async () => {
    process.env.QSTASH_TOKEN = "qstash-test-token";
    process.env.CRON_SECRET = "cron-test-secret";
    process.env.APP_BASE_URL = "https://akhi.example.com";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ messageId: "msg_123" }), { status: 201 })
    );

    const futureIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const result = await scheduleExactPushReminder(42, futureIso);

    expect(result).toEqual({ scheduled: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      "https://qstash.upstash.io/v2/publish/https://akhi.example.com/api/cron/reminders?scheduleId=42"
    );
    expect((init?.headers as Record<string, string>)["Upstash-Method"]).toBe("GET");
    expect((init?.headers as Record<string, string>)["Upstash-Forward-Authorization"]).toBe(
      "Bearer cron-test-secret"
    );
  });
});
