import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildSchedulesSheetPayload,
  buildWellnessSheetsPayload,
  isValidGoogleAppsScriptUrl,
} from "@/lib/sheets";
import { chunkText, mergeKnowledgeChunks } from "@/lib/rag";
import {
  exportIdeaToPdf,
  exportKnowledgeDocToPdf,
  normalizeTextForPdf,
  sanitizePdfFilename,
} from "@/lib/pdf-export";

const mockIsGuestSession = vi.fn<() => Promise<boolean>>();
const mockSupabaseFrom = vi.fn();
const mockPdfSave = vi.fn();

vi.mock("@/lib/session-server", () => ({
  isGuestSession: () => mockIsGuestSession(),
}));

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: (...args: any[]) => mockSupabaseFrom(...args),
  },
}));

vi.mock("jspdf", () => ({
  jsPDF: class {
    internal = {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    };
    setFont = vi.fn();
    setFontSize = vi.fn();
    setTextColor = vi.fn();
    setDrawColor = vi.fn();
    setLineWidth = vi.fn();
    line = vi.fn();
    text = vi.fn();
    addPage = vi.fn();
    setPage = vi.fn();
    getNumberOfPages = () => 1;
    splitTextToSize = (txt: string) => [txt];
    save = mockPdfSave;
  },
}));

describe("Validasi & Payload Google Sheets Export", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("hanya mengizinkan URL HTTPS Google Apps Script (anti-SSRF)", () => {
    expect(
      isValidGoogleAppsScriptUrl("https://script.google.com/macros/s/AKfycb123/exec")
    ).toBe(true);
    expect(
      isValidGoogleAppsScriptUrl("http://script.google.com/macros/s/AKfycb123/exec")
    ).toBe(false);
    expect(isValidGoogleAppsScriptUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isValidGoogleAppsScriptUrl("https://evil.example.com/hook")).toBe(false);
  });

  it("memformat tabel Jadwal dan Sehat (Nutrisi & Olahraga) dengan benar", () => {
    const sched = buildSchedulesSheetPayload([
      {
        id: 1,
        title: "Kajian Kitab",
        schedule_time: "20:00 WIB",
        target_datetime: "2026-11-25T13:00:00.000Z",
        is_done: false,
        reminded: false,
      },
    ]);
    expect(sched.sheetName).toBe("Jadwal");
    expect(sched.rows).toHaveLength(1);
    expect(sched.rows[0][1]).toBe("Kajian Kitab");
    expect(sched.rows[0][4]).toBe("Belum Selesai");

    const wellness = buildWellnessSheetsPayload(
      [
        {
          id: 10,
          food_name: "Nasi & Ayam",
          calories: 500,
          protein_g: 38,
          carbs_g: 55,
          fat_g: 12,
          ai_notes: "Seimbang",
          created_at: "2026-11-25T05:00:00.000Z",
        },
      ],
      [
        {
          id: 20,
          routine_name: "Push-up",
          duration_minutes: 25,
          ai_plan: "3x12",
          ai_evaluation: "Bagus",
          is_completed: true,
          created_at: "2026-11-25T06:00:00.000Z",
        },
      ]
    );
    expect(wellness).toHaveLength(2);
    expect(wellness[0].sheetName).toBe("Nutrisi");
    expect(wellness[1].sheetName).toBe("Olahraga");
    expect(wellness[1].rows[0][5]).toBe("Selesai");
  });

  it("POST /api/export/sheets mensimulasikan ekspor pada mode guest tanpa fetch eksternal", async () => {
    mockIsGuestSession.mockResolvedValue(true);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { POST } = await import("@/app/api/export/sheets/route");

    const res = await POST(
      new Request("http://localhost/api/export/sheets", {
        method: "POST",
        body: JSON.stringify({ type: "schedules" }),
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.sandbox).toBe(true);
    expect(data.exportedRows).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POST /api/export/sheets menolak URL non-Apps-Script dan mengirim payload valid ke webhook", async () => {
    mockIsGuestSession.mockResolvedValue(false);
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        order: async () => ({
          data: [
            {
              id: 7,
              title: "Rapat Proyek",
              schedule_time: "Besok 09:00 WIB",
              target_datetime: null,
              is_done: false,
              reminded: false,
              created_at: "2026-11-25T01:00:00.000Z",
            },
          ],
          error: null,
        }),
      }),
    });

    const { POST } = await import("@/app/api/export/sheets/route");

    const badRes = await POST(
      new Request("http://localhost/api/export/sheets", {
        method: "POST",
        body: JSON.stringify({
          type: "schedules",
          webhookUrl: "https://evil.example.com/steal",
        }),
      })
    );
    expect(badRes.status).toBe(400);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, totalRows: 1 }), { status: 200 })
    );

    const okRes = await POST(
      new Request("http://localhost/api/export/sheets", {
        method: "POST",
        body: JSON.stringify({
          type: "schedules",
          webhookUrl: "https://script.google.com/macros/s/AKfycbTest/exec",
        }),
      })
    );
    const okData = await okRes.json();

    expect(okRes.status).toBe(200);
    expect(okData.success).toBe(true);
    expect(okData.exportedRows).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("Ekspor PDF Ide & Rekonstruksi Teks Penuh Memori RAG", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mergeKnowledgeChunks menggabungkan ulang chunks overlap menjadi teks utuh tanpa duplikasi", () => {
    const source =
      "Arsitektur sistem menggunakan Next.js App Router, TypeScript, Supabase PostgreSQL dengan pgvector HNSW index, serta Google Gemini API untuk inferensi multimodal dan Function Calling multi-aksi.";
    const chunks = chunkText(source, 90, 25);
    expect(chunks.length).toBeGreaterThan(1);

    const merged = mergeKnowledgeChunks(chunks);
    expect(merged).toBe(source);
  });

  it("GET /api/knowledge?title=... mengembalikan fullContent hasil gabungan chunks", async () => {
    mockIsGuestSession.mockResolvedValue(false);
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: async () => ({
            data: [
              {
                id: 1,
                title: "Catatan Sistem",
                category: "Dokumentasi Teknis & Proyek",
                content: "Bagian pertama menjelaskan autentikasi JWT.",
                created_at: "2026-11-25T02:00:00.000Z",
              },
              {
                id: 2,
                title: "Catatan Sistem",
                category: "Dokumentasi Teknis & Proyek",
                content: "menjelaskan autentikasi JWT. Bagian kedua membahas RAG.",
                created_at: "2026-11-25T02:00:00.000Z",
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    const { GET } = await import("@/app/api/knowledge/route");
    const res = await GET(
      new Request("http://localhost/api/knowledge?title=Catatan%20Sistem")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.document.chunkCount).toBe(2);
    expect(data.document.fullContent).toBe(
      "Bagian pertama menjelaskan autentikasi JWT. Bagian kedua membahas RAG."
    );
  });

  it("exportIdeaToPdf & exportKnowledgeDocToPdf menormalkan teks dan menyimpan nama file aman", () => {
    expect(sanitizePdfFilename("Ide: Hybrid Search (RRF)!")).toBe(
      "ide-hybrid-search-rrf.pdf"
    );
    expect(normalizeTextForPdf("🎯 KONSEP:\n• Poin satu")).toBe(
      "KONSEP:\n- Poin satu"
    );

    exportIdeaToPdf({
      id: 5,
      title: "Hybrid Search RAG",
      content: "Gabungan BM25 dan pgvector.",
      ai_expansion: "🎯 KONSEP:\n• Langkah 1",
      created_at: "2026-11-25T03:00:00.000Z",
    });
    expect(mockPdfSave).toHaveBeenCalledWith("hybrid-search-rag.pdf");

    exportKnowledgeDocToPdf({
      title: "Ringkasan Kitab Tauhid",
      category: "Catatan Ilmu & Kajian",
      chunkCount: 3,
      created_at: "2026-11-25T03:00:00.000Z",
      fullContent: "Isi lengkap catatan kajian.",
    });
    expect(mockPdfSave).toHaveBeenCalledWith("ringkasan-kitab-tauhid.pdf");
  });
});
