import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGenerateContent = vi.fn();
const mockRetrieveRagContext = vi.fn();
const mockIsGuestSession = vi.fn<() => Promise<boolean>>();
const mockSupabaseFrom = vi.fn();

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

vi.mock("@/lib/session-server", () => ({
  isGuestSession: () => mockIsGuestSession(),
}));

vi.mock("@/lib/rag-retrieval", () => ({
  retrieveRagContext: (...args: any[]) => mockRetrieveRagContext(...args),
}));

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: (...args: any[]) => mockSupabaseFrom(...args),
  },
}));

describe("Multi-Action Function Calling (/api/assistant)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRetrieveRagContext.mockResolvedValue({ ragContext: "", matchedSources: [] });
  });

  it("mengeksekusi beberapa tool sekaligus dalam 1 permintaan (guest mode)", async () => {
    mockIsGuestSession.mockResolvedValue(true);
    const { POST } = await import("@/app/api/assistant/route");

    mockGenerateContent
      .mockResolvedValueOnce({
        functionCalls: [
          { name: "complete_schedule", args: { scheduleId: 901 } },
          {
            name: "log_meal_entry",
            args: {
              foodName: "Nasi & Ayam Bakar",
              calories: 520,
              proteinG: 40,
              carbsG: 55,
              fatG: 12,
              aiNotes: "Seimbang.",
            },
          },
        ],
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                { functionCall: { name: "complete_schedule", args: { scheduleId: 901 } } },
                { functionCall: { name: "log_meal_entry", args: { foodName: "Nasi & Ayam Bakar" } } },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          transcript: "Tandai interview selesai dan catat makan siang nasi ayam bakar",
          detectedLang: "id",
          intent: "general_chat",
          replyMessage: "Alhamdulillaah Akhi, jadwal ditandai selesai dan makan siang dicatat.",
          spokenText: "Alhamdulillaah Akhi, jadwal ditandai selesai dan makan siang dicatat.",
        }),
      });

    const res = await POST(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        body: JSON.stringify({
          textInput: "Tandai interview selesai dan catat makan siang nasi ayam bakar",
        }),
      })
    );

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.handledByServerTools).toBe(true);
    expect(data.actions).toHaveLength(2);
    expect(data.refreshTargets).toEqual(expect.arrayContaining(["schedules", "wellness"]));
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });

  it("executeAssistantToolCall membaca ringkasan nutrisi hari ini untuk guest", async () => {
    const { executeAssistantToolCall } = await import("@/lib/assistant-tools");
    const ctx = {
      isGuest: true,
      actions: [],
      refreshTargets: new Set<"schedules" | "ideas" | "wellness" | "rag">(),
      sources: [],
    };

    const result = await executeAssistantToolCall("get_today_nutrition", {}, ctx);
    expect(result.sandbox).toBe(true);
    expect(typeof result.totalCalories).toBe("number");
    expect(result.totalCalories).toBeGreaterThan(0);
  });
});

describe("Sinkronisasi Riwayat Diskusi (/api/chat)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengisolasi sesi guest di GET, POST, dan DELETE /api/chat", async () => {
    mockIsGuestSession.mockResolvedValue(true);
    const { GET, POST, DELETE } = await import("@/app/api/chat/route");

    const getRes = await GET();
    expect(await getRes.json()).toEqual({ messages: [], sandbox: true });

    const postRes = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ role: "user", text: "Halo" }),
      })
    );
    expect(await postRes.json()).toEqual({ success: true, sandbox: true });

    const delRes = await DELETE();
    expect(await delRes.json()).toEqual({ success: true, sandbox: true });
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });

  it("menangani tabel chat_messages yang belum dibuat secara graceful", async () => {
    mockIsGuestSession.mockResolvedValue(false);
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        order: () => ({
          limit: async () => ({
            data: null,
            error: { message: 'relation "public.chat_messages" does not exist' },
          }),
        }),
      }),
    });

    const { GET } = await import("@/app/api/chat/route");
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ messages: [], tableMissing: true });
  });
});
