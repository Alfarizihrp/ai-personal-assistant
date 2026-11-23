import { describe, it, expect, beforeAll } from "vitest";
import { chunkText } from "@/lib/rag";

describe("Pengujian Modul Inti: Keamanan JWT & Text Chunking RAG", () => {
  beforeAll(() => {
    process.env.JWT_SECRET_KEY = "kunci_rahasia_pengujian_vitest_minimal_32_karakter";
  });

  it("harus membuat dan memverifikasi JWT session token dengan benar", async () => {
    const { createSessionToken, verifySessionToken } = await import("@/lib/auth");

    const token = await createSessionToken();
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const payload = await verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.role).toBe("owner");
    expect(payload?.user).toBe("Akhi");
  });

  it("harus menolak token JWT yang tidak valid atau dimanipulasi", async () => {
    const { verifySessionToken } = await import("@/lib/auth");

    const invalidPayload = await verifySessionToken("eyJhbGciOiJIUzI1NiJ9.palsu.signature");
    expect(invalidPayload).toBeNull();
  });

  it("tidak memecah teks pendek yang berada di bawah batas maxChunkSize", () => {
    const shortText = "Ini adalah catatan kajian singkat yang tidak perlu dipecah.";
    const chunks = chunkText(shortText, 500, 50);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(shortText);
  });

  it("memecah teks panjang menjadi beberapa chunks dengan overlap konteks", () => {
    const paragraph =
      "Arsitektur Retrieval-Augmented Generation menggabungkan pencarian vektor semantik dengan model bahasa besar. ";
    const longText = paragraph.repeat(15);

    const chunks = chunkText(longText, 400, 80);
    expect(chunks.length).toBeGreaterThan(2);

    // Pastikan setiap potongan berada dalam batas ukuran yang wajar
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(405);
    }
  });
});