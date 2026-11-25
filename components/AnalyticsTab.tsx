"use client";

import { BarChart3, RotateCcw } from "lucide-react";
import type { IdeaItem, KnowledgeDocItem, ScheduleItem } from "@/types/assistant";

interface AnalyticsTabProps {
  schedules: ScheduleItem[];
  ideas: IdeaItem[];
  knowledgeDocs: KnowledgeDocItem[];
  pushSubscribed: boolean;
  onRefresh: () => void;
}

export default function AnalyticsTab({
  schedules,
  ideas,
  knowledgeDocs,
  pushSubscribed,
  onRefresh,
}: AnalyticsTabProps) {
  const totalSchedules = schedules.length;
  const completedSchedules = schedules.filter((s) => s.is_done).length;
  const pendingSchedules = totalSchedules - completedSchedules;
  const scheduleCompletionRate =
    totalSchedules > 0 ? Math.round((completedSchedules / totalSchedules) * 100) : 0;

  const totalIdeas = ideas.length;
  const expandedIdeasCount = ideas.filter((i) => Boolean(i.ai_expansion)).length;
  const ideaExpansionRate =
    totalIdeas > 0 ? Math.round((expandedIdeasCount / totalIdeas) * 100) : 0;

  const totalRagDocs = knowledgeDocs.length;
  const totalRagChunks = knowledgeDocs.reduce((acc, doc) => acc + doc.chunkCount, 0);

  const categoryCounts = knowledgeDocs.reduce<Record<string, number>>((acc, doc) => {
    const cat = doc.category || "Catatan Umum";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span>Analitik Produktivitas & Memori</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Ringkasan real-time eksekusi agenda, ide, dan indeks vektor
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
          title="Segarkan metrik analitik"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-3.5">
          <p className="text-[11px] text-slate-400">Penyelesaian Jadwal</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            {scheduleCompletionRate}%
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {completedSchedules} selesai dari {totalSchedules} agenda
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-3.5">
          <p className="text-[11px] text-slate-400">Ide & Catatan Faedah</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{totalIdeas}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {expandedIdeasCount} sudah dijabarkan AI
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-3.5">
          <p className="text-[11px] text-slate-400">Memori Vektor (RAG)</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">{totalRagChunks}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Tersebar di {totalRagDocs} dokumen
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-3.5">
          <p className="text-[11px] text-slate-400">Status Sistem PWA</p>
          <p className="text-sm font-bold text-emerald-400 mt-2">
            {pushSubscribed ? "Push Aktif" : "Push Siaga"}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            JWT Cookie & RLS Terkunci
          </p>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 space-y-4">
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-300 font-medium">Rasio Agenda Tuntas</span>
            <span className="text-blue-400 font-semibold">
              {completedSchedules}/{totalSchedules} ({scheduleCompletionRate}%)
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${scheduleCompletionRate}%` }}
            />
          </div>
          {pendingSchedules > 0 && (
            <p className="text-[10px] text-slate-500 mt-1">
              Masih ada {pendingSchedules} agenda aktif yang menunggu diselesaikan.
            </p>
          )}
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-300 font-medium">Rasio Ekspansi Ide AI</span>
            <span className="text-amber-400 font-semibold">
              {expandedIdeasCount}/{totalIdeas} ({ideaExpansionRate}%)
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${ideaExpansionRate}%` }}
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 space-y-2.5">
        <h3 className="text-xs font-semibold text-purple-300">
          Sebaran Kategori Knowledge Base
        </h3>
        {Object.keys(categoryCounts).length === 0 ? (
          <p className="text-[11px] text-slate-500">
            Belum ada dokumen yang diindeks di tab Memori.
          </p>
        ) : (
          <div className="space-y-2">
            {Object.entries(categoryCounts).map(([cat, count]) => {
              const pct = Math.round((count / totalRagDocs) * 100);
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">{cat}</span>
                    <span className="text-purple-400">
                      {count} dok ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
