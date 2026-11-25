"use client";

import React from "react";
import { BrainCircuit, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import type { KnowledgeDocItem } from "@/types/assistant";

interface MemoryRagTabProps {
  knowledgeDocs: KnowledgeDocItem[];
  loadingData: boolean;
  showRagForm: boolean;
  ragTitle: string;
  ragCategory: string;
  ragContent: string;
  indexingRag: boolean;
  ragFormError: string;
  onToggleRagForm: () => void;
  onTitleChange: (val: string) => void;
  onCategoryChange: (val: string) => void;
  onContentChange: (val: string) => void;
  onSubmitRag: (e: React.FormEvent) => void;
  onDeleteDoc: (title: string) => void;
}

export default function MemoryRagTab({
  knowledgeDocs,
  loadingData,
  showRagForm,
  ragTitle,
  ragCategory,
  ragContent,
  indexingRag,
  ragFormError,
  onToggleRagForm,
  onTitleChange,
  onCategoryChange,
  onContentChange,
  onSubmitRag,
  onDeleteDoc,
}: MemoryRagTabProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-purple-400" />
            <span>Semantic Memory (pgvector RAG)</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Indeks dokumen/catatan agar asisten bisa menjawab berdasarkan referensimu
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleRagForm}
          className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Indeks Teks</span>
        </button>
      </div>

      {showRagForm && (
        <form
          onSubmit={onSubmitRag}
          className="bg-slate-950 border border-purple-900/50 rounded-xl p-3.5 space-y-2.5"
        >
          <input
            type="text"
            value={ragTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Judul dokumen (misal: Ringkasan Kitab Tauhid / Arsitektur Sistem)..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
          />

          <select
            value={ragCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
          >
            <option value="Catatan Ilmu & Kajian">Catatan Ilmu & Kajian</option>
            <option value="Akademik & Skripsi">Akademik & Skripsi</option>
            <option value="Dokumentasi Teknis & Proyek">Dokumentasi Teknis & Proyek</option>
            <option value="Catatan Pribadi">Catatan Pribadi</option>
          </select>

          <textarea
            rows={5}
            value={ragContent}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="Tempelkan teks materi, paragraf draf, atau rangkuman panjang di sini. Sistem akan otomatis memecahnya menjadi chunks dan mengubahnya menjadi vektor embedding..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
          />

          {ragFormError && (
            <p className="text-[11px] text-red-400 bg-red-950/50 border border-red-900/60 px-2.5 py-1.5 rounded">
              {ragFormError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onToggleRagForm}
              className="text-xs text-slate-400 px-3 py-1.5 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={indexingRag}
              className="text-xs bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 text-white px-3.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 cursor-pointer"
            >
              {indexingRag && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>{indexingRag ? "Membuat Vektor..." : "Simpan ke Memori Vektor"}</span>
            </button>
          </div>
        </form>
      )}

      {loadingData ? (
        <p className="text-xs text-slate-500 text-center py-4">Memuat memori vektor...</p>
      ) : knowledgeDocs.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6 leading-relaxed">
          Belum ada dokumen terindeks. Klik &ldquo;+ Indeks Teks&rdquo; untuk menambahkan materi kajian, catatan proyek, atau ringkasan buku agar bisa dicari secara semantik oleh asisten.
        </p>
      ) : (
        <div className="space-y-3">
          {knowledgeDocs.map((doc, dIdx) => (
            <div
              key={dIdx}
              className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <h3 className="text-sm font-semibold text-purple-300">
                      {doc.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-900/50">
                      {doc.category}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {doc.chunkCount} vector chunks
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteDoc(doc.title)}
                  className="text-slate-600 hover:text-red-400 p-1 transition cursor-pointer"
                  title="Hapus dokumen dari memori vektor"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">{doc.preview}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
