"use client";

import { ArrowUpRight, Loader2, Search, X } from "lucide-react";
import type { GlobalSearchResult } from "@/types/assistant";

interface GlobalSearchBarProps {
  query: string;
  searching: boolean;
  results: GlobalSearchResult | null;
  onQueryChange: (value: string) => void;
  onClear: () => void;
  onNavigateTab: (tab: "schedules" | "ideas" | "rag") => void;
}

export default function GlobalSearchBar({
  query,
  searching,
  results,
  onQueryChange,
  onClear,
  onNavigateTab,
}: GlobalSearchBarProps) {
  const totalSearchHits = results
    ? results.schedules.length + results.ideas.length + results.knowledge.length
    : 0;

  return (
    <div className="relative">
      <div className="flex items-center bg-slate-900 border border-slate-800 focus-within:border-blue-500 rounded-2xl px-3.5 py-2.5 shadow-lg transition">
        {searching ? (
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0 mr-2.5" />
        ) : (
          <Search className="w-4 h-4 text-slate-500 shrink-0 mr-2.5" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Cari lintas jadwal, ide, faedah & memori RAG..."
          className="flex-1 bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={onClear}
            className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
            title="Bersihkan pencarian"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {results && query.trim().length >= 2 && (
        <div className="mt-2 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-[11px] font-semibold text-slate-300">
              Hasil Pencarian Lintas Data ({totalSearchHits})
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Tutup
            </button>
          </div>

          {totalSearchHits === 0 ? (
            <p className="text-xs text-slate-500 text-center py-3">
              Tidak ditemukan data yang cocok dengan &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {results.schedules.map((s) => (
                <button
                  key={`gs-${s.id}`}
                  type="button"
                  onClick={() => onNavigateTab("schedules")}
                  className="w-full text-left bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 transition cursor-pointer"
                >
                  <div>
                    <span className="text-[10px] font-semibold text-blue-400 uppercase">
                      Jadwal
                    </span>
                    <p className="text-xs font-medium text-slate-100">{s.title}</p>
                    <p className="text-[11px] text-slate-400">{s.schedule_time}</p>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </button>
              ))}

              {results.ideas.map((i) => (
                <button
                  key={`gi-${i.id}`}
                  type="button"
                  onClick={() => onNavigateTab("ideas")}
                  className="w-full text-left bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 transition cursor-pointer"
                >
                  <div>
                    <span className="text-[10px] font-semibold text-amber-400 uppercase">
                      Ide & Faedah
                    </span>
                    <p className="text-xs font-medium text-slate-100">{i.title}</p>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{i.content}</p>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </button>
              ))}

              {results.knowledge.map((k) => (
                <button
                  key={`gk-${k.id}`}
                  type="button"
                  onClick={() => onNavigateTab("rag")}
                  className="w-full text-left bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 transition cursor-pointer"
                >
                  <div>
                    <span className="text-[10px] font-semibold text-purple-400 uppercase">
                      Memori RAG • {k.category}
                    </span>
                    <p className="text-xs font-medium text-slate-100">{k.title}</p>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{k.snippet}</p>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
