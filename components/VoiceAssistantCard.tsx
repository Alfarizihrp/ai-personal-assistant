"use client";

import React from "react";
import {
  Bell,
  BellRing,
  Loader2,
  Lock,
  Mic,
  Send,
  Square,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";

interface VoiceAssistantCardProps {
  isProcessing: boolean;
  isBriefingLoading: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  voiceEnabled: boolean;
  pushSubscribed: boolean;
  subscribingPush: boolean;
  statusLog: string;
  textCommand: string;
  error: string;
  onLockApp: () => void;
  onEnablePush: () => void;
  onToggleVoice: () => void;
  onToggleRecording: () => void;
  onStopSpeaking: () => void;
  onTextCommandChange: (value: string) => void;
  onTextSubmit: (e: React.FormEvent) => void;
  onTriggerDailyBriefing: () => void;
}

export default function VoiceAssistantCard({
  isProcessing,
  isBriefingLoading,
  isRecording,
  isSpeaking,
  voiceEnabled,
  pushSubscribed,
  subscribingPush,
  statusLog,
  textCommand,
  error,
  onLockApp,
  onEnablePush,
  onToggleVoice,
  onToggleRecording,
  onStopSpeaking,
  onTextCommandChange,
  onTextSubmit,
  onTriggerDailyBriefing,
}: VoiceAssistantCardProps) {
  return (
    <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col items-center text-center">
      <div className="absolute top-4 left-4">
        <button
          type="button"
          onClick={onLockApp}
          title="Kunci layar & akhiri sesi JWT"
          className="p-2 rounded-xl border bg-slate-950 border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-900/60 transition cursor-pointer"
        >
          <Lock className="w-4 h-4" />
        </button>
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-1.5">
        <button
          type="button"
          disabled={subscribingPush}
          onClick={onEnablePush}
          title={
            pushSubscribed
              ? "Web Push Latar Belakang Aktif"
              : "Aktifkan Web Push Latar Belakang"
          }
          className={`p-2 rounded-xl border transition cursor-pointer ${
            pushSubscribed
              ? "bg-emerald-950/50 border-emerald-800/60 text-emerald-400"
              : "bg-amber-950/40 border-amber-800/60 text-amber-400 hover:bg-amber-900/50"
          }`}
        >
          {subscribingPush ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : pushSubscribed ? (
            <BellRing className="w-4 h-4" />
          ) : (
            <Bell className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          onClick={onToggleVoice}
          title={voiceEnabled ? "Matikan suara balasan" : "Nyalakan suara balasan"}
          className={`p-2 rounded-xl border transition cursor-pointer ${
            voiceEnabled
              ? "bg-blue-950/50 border-blue-800/60 text-blue-400"
              : "bg-slate-950 border-slate-800 text-slate-500"
          }`}
        >
          {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      <h1 className="text-2xl font-bold tracking-tight mb-1 mt-2">
        AI Personal Assistant
      </h1>
      <p className="text-slate-400 text-xs mb-6">
        Asisten Pribadi, Diskusi Ilmu & Semantic Memory (RAG)
      </p>

      <button
        type="button"
        disabled={isProcessing || isBriefingLoading}
        onClick={onToggleRecording}
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg cursor-pointer ${
          isProcessing || isBriefingLoading
            ? "bg-slate-700 cursor-not-allowed"
            : isRecording
            ? "bg-red-500 hover:bg-red-600 animate-pulse shadow-red-500/40"
            : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/30"
        }`}
      >
        {isProcessing || isBriefingLoading ? (
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        ) : isRecording ? (
          <Square className="w-8 h-8 text-white fill-white" />
        ) : (
          <Mic className="w-8 h-8 text-white" />
        )}
      </button>

      <div className="mt-3 flex items-center gap-2">
        <p className="text-xs text-blue-400 font-mono">
          {isSpeaking ? "Asisten sedang berbicara..." : statusLog}
        </p>
        {isSpeaking && (
          <button
            type="button"
            onClick={onStopSpeaking}
            className="text-[11px] bg-red-950/70 border border-red-800/60 text-red-300 px-2 py-0.5 rounded cursor-pointer"
          >
            Stop Suara
          </button>
        )}
      </div>

      <form onSubmit={onTextSubmit} className="w-full mt-5 flex gap-2">
        <input
          type="text"
          value={textCommand}
          onChange={(e) => onTextCommandChange(e.target.value)}
          placeholder="Tanya dalil, cari catatan memori, atau multi-aksi..."
          disabled={isProcessing || isRecording || isBriefingLoading}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={isProcessing || isRecording || isBriefingLoading || !textCommand.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white px-4 rounded-xl flex items-center justify-center transition cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      <button
        type="button"
        disabled={isProcessing || isRecording || isBriefingLoading}
        onClick={onTriggerDailyBriefing}
        className="w-full mt-3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-950/80 to-teal-950/80 hover:from-emerald-900/80 hover:to-teal-900/80 border border-emerald-800/60 text-emerald-300 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
      >
        {isBriefingLoading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Menyusun Briefing Hari Ini...</span>
          </>
        ) : (
          <>
            <Sun className="w-4 h-4 text-amber-400" />
            <span>Briefing Agenda & Faedah Hari Ini</span>
          </>
        )}
      </button>

      {error && (
        <p className="mt-4 text-xs text-red-400 bg-red-950/50 border border-red-900 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}
    </div>
  );
}
