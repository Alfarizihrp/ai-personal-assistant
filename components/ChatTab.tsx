"use client";

import {
  BookmarkPlus,
  BrainCircuit,
  Check,
  Loader2,
  MessageSquare,
  RotateCcw,
  Volume2,
  Zap,
} from "lucide-react";
import type { ChatMessage } from "@/types/assistant";

interface ChatTabProps {
  chatHistory: ChatMessage[];
  savingChatId: string | null;
  savedChatIds: Record<string, boolean>;
  onClearHistory: () => void;
  onSaveFaedah: (msg: ChatMessage, index: number) => void;
  onSpeak: (text: string, isCalm: boolean) => void;
}

export default function ChatTab({
  chatHistory,
  savingChatId,
  savedChatIds,
  onClearHistory,
  onSaveFaedah,
  onSpeak,
}: ChatTabProps) {
  const turns: { items: { msg: ChatMessage; origIdx: number }[] }[] = [];
  for (let i = 0; i < chatHistory.length; i++) {
    const current = chatHistory[i];
    const next = chatHistory[i + 1];
    if (current.role === "user" && next?.role === "assistant") {
      turns.push({
        items: [
          { msg: current, origIdx: i },
          { msg: next, origIdx: i + 1 },
        ],
      });
      i++;
    } else {
      turns.push({ items: [{ msg: current, origIdx: i }] });
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <span>Riwayat Diskusi & Briefing</span>
        </h2>
        {chatHistory.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="text-[11px] text-slate-400 hover:text-red-400 flex items-center gap-1 cursor-pointer"
            title="Bersihkan riwayat diskusi"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {chatHistory.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6 leading-relaxed">
          Belum ada diskusi, Akhi. Ajukan pertanyaan seputar ilmu, cek dokumen di tab Memori, atau beri perintah multi-aksi seperti &ldquo;tandai jadwal selesai dan catat makan siang&rdquo;.
        </p>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {turns.reverse().map((turn, tIdx) => (
            <div
              key={tIdx}
              className="space-y-2 pb-3 border-b border-slate-800/60 last:border-b-0"
            >
              {turn.items.map(({ msg, origIdx }) => {
                const isSavingThis = savingChatId === msg.id;
                const isSavedThis = savedChatIds[msg.id];

                return (
                  <div
                    key={msg.id}
                    className={`rounded-xl p-3.5 text-sm ${
                      msg.role === "user"
                        ? "bg-blue-950/40 border border-blue-900/50 ml-6 text-slate-100"
                        : "bg-slate-950 border border-slate-800 mr-2 text-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider ${
                          msg.role === "user" ? "text-blue-400" : "text-emerald-400"
                        }`}
                      >
                        {msg.role === "user" ? "Akhi" : "Asisten"} • {msg.timestamp}
                      </span>

                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            disabled={isSavingThis || isSavedThis}
                            onClick={() => onSaveFaedah(msg, origIdx)}
                            className={`text-[11px] flex items-center gap-1 transition cursor-pointer ${
                              isSavedThis
                                ? "text-amber-400 cursor-default"
                                : "text-slate-400 hover:text-amber-300"
                            }`}
                            title="Simpan catatan faedah ini ke Workspace Supabase"
                          >
                            {isSavingThis ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Menyimpan...</span>
                              </>
                            ) : isSavedThis ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Tersimpan</span>
                              </>
                            ) : (
                              <>
                                <BookmarkPlus className="w-3 h-3" />
                                <span>Simpan Faedah</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onSpeak(
                                msg.spokenText || msg.text,
                                msg.intent === "general_chat" ||
                                  msg.intent === "daily_briefing"
                              )
                            }
                            className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                          >
                            <Volume2 className="w-3 h-3" />
                            <span>Dengar</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                      {msg.text}
                    </p>

                    {msg.role === "assistant" &&
                      msg.actions &&
                      msg.actions.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            <span>Aksi Dieksekusi:</span>
                          </span>
                          {msg.actions.map((act, aIdx) => (
                            <span
                              key={aIdx}
                              className="text-[10px] bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 px-2 py-0.5 rounded-md"
                            >
                              {act}
                            </span>
                          ))}
                        </div>
                      )}

                    {msg.role === "assistant" &&
                      msg.sources &&
                      msg.sources.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-purple-400 font-medium flex items-center gap-1">
                            <BrainCircuit className="w-3 h-3" />
                            <span>Sumber Memori:</span>
                          </span>
                          {msg.sources.map((src, sIdx) => (
                            <span
                              key={sIdx}
                              className="text-[10px] bg-purple-950/60 border border-purple-800/60 text-purple-200 px-2 py-0.5 rounded-md"
                            >
                              {src.title} ({src.similarity}%)
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
