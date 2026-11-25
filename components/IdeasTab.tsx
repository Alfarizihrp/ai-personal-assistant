"use client";

import React from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  FileDown,
  Lightbulb,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { IdeaItem } from "@/types/assistant";
import { exportIdeaToPdf } from "@/lib/pdf-export";

interface IdeasTabProps {
  ideas: IdeaItem[];
  loadingData: boolean;
  showIdeaForm: boolean;
  manualIdeaTitle: string;
  manualIdeaContent: string;
  savingManualIdea: boolean;
  ideaFormError: string;
  editingIdeaId: number | null;
  editIdeaTitle: string;
  editIdeaContent: string;
  savingEditIdea: boolean;
  expandingIdeaId: number | null;
  collapsedExpansions: Record<number, boolean>;
  onToggleIdeaForm: () => void;
  onManualTitleChange: (val: string) => void;
  onManualContentChange: (val: string) => void;
  onSubmitManualIdea: (e: React.FormEvent) => void;
  onStartEdit: (idea: IdeaItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: number) => void;
  onEditTitleChange: (val: string) => void;
  onEditContentChange: (val: string) => void;
  onDelete: (id: number) => void;
  onExpandIdea: (idea: IdeaItem) => void;
  onToggleCollapse: (id: number) => void;
}

export default function IdeasTab({
  ideas,
  loadingData,
  showIdeaForm,
  manualIdeaTitle,
  manualIdeaContent,
  savingManualIdea,
  ideaFormError,
  editingIdeaId,
  editIdeaTitle,
  editIdeaContent,
  savingEditIdea,
  expandingIdeaId,
  collapsedExpansions,
  onToggleIdeaForm,
  onManualTitleChange,
  onManualContentChange,
  onSubmitManualIdea,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditTitleChange,
  onEditContentChange,
  onDelete,
  onExpandIdea,
  onToggleCollapse,
}: IdeasTabProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <span>Workspace Ide & Catatan Faedah</span>
        </h2>
        <button
          type="button"
          onClick={onToggleIdeaForm}
          className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tulis Catatan</span>
        </button>
      </div>

      {showIdeaForm && (
        <form
          onSubmit={onSubmitManualIdea}
          className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5"
        >
          <input
            type="text"
            value={manualIdeaTitle}
            onChange={(e) => onManualTitleChange(e.target.value)}
            placeholder="Judul ide atau catatan (opsional)..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
          />
          <textarea
            rows={3}
            value={manualIdeaContent}
            onChange={(e) => onManualContentChange(e.target.value)}
            placeholder="Tuliskan detail konsep, ide, atau faedah di sini..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
          />

          {ideaFormError && (
            <p className="text-[11px] text-red-400 bg-red-950/50 border border-red-900/60 px-2.5 py-1.5 rounded">
              {ideaFormError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onToggleIdeaForm}
              className="text-xs text-slate-400 px-3 py-1.5 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingManualIdea}
              className="text-xs bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white px-3.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 cursor-pointer"
            >
              {savingManualIdea && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>{savingManualIdea ? "Menyimpan..." : "Simpan"}</span>
            </button>
          </div>
        </form>
      )}

      {loadingData ? (
        <p className="text-xs text-slate-500 text-center py-4">Memuat workspace...</p>
      ) : ideas.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-4">
          Workspace masih kosong. Ucapkan &ldquo;Catat ide...&rdquo;, klik &ldquo;+ Tulis Catatan&rdquo;, atau simpan faedah dari tab Diskusi.
        </p>
      ) : (
        <div className="space-y-3">
          {ideas.map((idea) => {
            const isExpanding = expandingIdeaId === idea.id;
            const isCollapsed = collapsedExpansions[idea.id];
            const isEditingThis = editingIdeaId === idea.id;

            return (
              <div
                key={idea.id}
                className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5"
              >
                {isEditingThis ? (
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      value={editIdeaTitle}
                      onChange={(e) => onEditTitleChange(e.target.value)}
                      placeholder="Judul catatan..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                    <textarea
                      rows={4}
                      value={editIdeaContent}
                      onChange={(e) => onEditContentChange(e.target.value)}
                      placeholder="Isi catatan atau konsep ide..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={onCancelEdit}
                        className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1 rounded flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Batal</span>
                      </button>
                      <button
                        type="button"
                        disabled={savingEditIdea || !editIdeaContent.trim()}
                        onClick={() => onSaveEdit(idea.id)}
                        className="text-xs bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white px-3.5 py-1 rounded-lg font-medium flex items-center gap-1 cursor-pointer"
                      >
                        {savingEditIdea ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Simpan Perubahan</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-amber-300">
                        {idea.title}
                      </h3>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => exportIdeaToPdf(idea)}
                          className="text-slate-400 hover:text-emerald-300 px-1.5 py-1 rounded text-[10px] flex items-center gap-1 transition cursor-pointer"
                          title="Unduh catatan ini sebagai PDF"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartEdit(idea)}
                          className="text-slate-500 hover:text-amber-300 p-1 transition cursor-pointer"
                          title="Edit catatan"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(idea.id)}
                          className="text-slate-600 hover:text-red-400 p-1 transition cursor-pointer"
                          title="Hapus catatan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                      {idea.content}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                      <span className="text-[10px] text-slate-600">
                        {new Date(idea.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>

                      <div className="flex items-center gap-2">
                        {idea.ai_expansion && (
                          <button
                            type="button"
                            onClick={() => onToggleCollapse(idea.id)}
                            className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-0.5 cursor-pointer"
                          >
                            {isCollapsed ? (
                              <>
                                <ChevronDown className="w-3.5 h-3.5" />
                                <span>Lihat Rincian</span>
                              </>
                            ) : (
                              <>
                                <ChevronUp className="w-3.5 h-3.5" />
                                <span>Sembunyikan</span>
                              </>
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={expandingIdeaId !== null}
                          onClick={() => onExpandIdea(idea)}
                          className="text-[11px] bg-amber-950/60 hover:bg-amber-900/70 border border-amber-700/50 text-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                          {isExpanding ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Menjabarkan...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3" />
                              <span>
                                {idea.ai_expansion ? "Kembangkan Ulang" : "Kembangkan dengan AI"}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {idea.ai_expansion && !isCollapsed && (
                      <div className="mt-2 p-3 bg-slate-900/90 border border-amber-900/40 rounded-lg text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                        {idea.ai_expansion}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
