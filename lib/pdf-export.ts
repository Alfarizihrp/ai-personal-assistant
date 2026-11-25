import { jsPDF } from "jspdf";
import type { IdeaItem } from "@/types/assistant";

export function sanitizePdfFilename(title: string, fallback = "dokumen"): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${slug || fallback}.pdf`;
}

/**
 * Menormalkan teks agar aman dirender font standar PDF (Helvetica / WinAnsi),
 * mengganti bullet umum serta menghapus emoji/karakter non-Latin-1 yang tidak didukung.
 */
export function normalizeTextForPdf(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[•▪◦]/g, "-")
    .replace(/[🎯⚙️🛠️🚀🔹💡🧠]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function formatWibDate(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return (
    new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "long",
      timeStyle: "short",
    }).format(d) + " WIB"
  );
}

function createStyledPdfDocument(params: {
  badge: string;
  title: string;
  metaLines: string[];
  sections: { heading: string; body: string }[];
  filename: string;
}): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const maxWidth = pageWidth - marginX * 2;
  let cursorY = 18;

  const ensureSpace = (neededMm: number) => {
    if (cursorY + neededMm > pageHeight - 20) {
      doc.addPage();
      cursorY = 18;
    }
  };

  // Header Badge
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(37, 99, 235);
  doc.text(normalizeTextForPdf(params.badge).toUpperCase(), marginX, cursorY);
  cursorY += 6;

  // Document Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(
    normalizeTextForPdf(params.title) || "Dokumen Tanpa Judul",
    maxWidth
  );
  doc.text(titleLines, marginX, cursorY);
  cursorY += titleLines.length * 6.5 + 2;

  // Metadata
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  for (const meta of params.metaLines) {
    ensureSpace(6);
    doc.text(normalizeTextForPdf(meta), marginX, cursorY);
    cursorY += 5;
  }

  // Divider
  cursorY += 2;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
  cursorY += 8;

  // Content Sections
  for (const section of params.sections) {
    if (!section.body.trim()) continue;

    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(normalizeTextForPdf(section.heading), marginX, cursorY);
    cursorY += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(51, 65, 85);

    const paragraphs = normalizeTextForPdf(section.body).split("\n");
    for (const para of paragraphs) {
      if (!para.trim()) {
        cursorY += 3;
        continue;
      }
      const wrapped = doc.splitTextToSize(para, maxWidth);
      for (const line of wrapped) {
        ensureSpace(6);
        doc.text(line, marginX, cursorY);
        cursorY += 5.4;
      }
      cursorY += 1.5;
    }

    cursorY += 4;
  }

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Akhi AI Personal Assistant  |  Halaman ${i} / ${totalPages}`,
      marginX,
      pageHeight - 10
    );
  }

  doc.save(params.filename);
}

export function exportIdeaToPdf(idea: IdeaItem): void {
  const sections: { heading: string; body: string }[] = [
    { heading: "Catatan & Konsep Utama", body: idea.content },
  ];

  if (idea.ai_expansion) {
    sections.push({
      heading: "Penjabaran & Rencana Eksekusi AI",
      body: idea.ai_expansion,
    });
  }

  createStyledPdfDocument({
    badge: "Akhi AI • Workspace Ide & Catatan Faedah",
    title: idea.title || "Catatan Ide",
    metaLines: [`Dibuat: ${formatWibDate(idea.created_at)}`],
    sections,
    filename: sanitizePdfFilename(idea.title, `ide-${idea.id}`),
  });
}

export function exportKnowledgeDocToPdf(docData: {
  title: string;
  category: string;
  chunkCount: number;
  created_at: string;
  fullContent: string;
}): void {
  createStyledPdfDocument({
    badge: "Akhi AI • Semantic Memory (RAG)",
    title: docData.title,
    metaLines: [
      `Kategori: ${docData.category}  |  Jumlah Potongan Vektor: ${docData.chunkCount} chunks`,
      `Diindeks: ${formatWibDate(docData.created_at)}`,
    ],
    sections: [{ heading: "Isi Dokumen Lengkap", body: docData.fullContent }],
    filename: sanitizePdfFilename(docData.title, "memori-rag"),
  });
}
