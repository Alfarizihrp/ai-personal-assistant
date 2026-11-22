"use client";

import { useState, useRef, useEffect } from "react";
import {
  Mic,
  Square,
  Loader2,
  Calendar,
  ExternalLink,
  MessageSquare,
  Send,
  CheckCircle2,
  Circle,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AssistantResponse {
  transcript: string;
  intent: "save_schedule" | "open_app" | "general_chat";
  taskTitle?: string;
  scheduleTime?: string;
  targetApp?: string;
  replyMessage: string;
}

interface ScheduleItem {
  id: number;
  title: string;
  schedule_time: string;
  is_done: boolean;
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [textCommand, setTextCommand] = useState("");
  const [statusLog, setStatusLog] = useState("Siap mendengarkan atau menerima ketikan");
  const [error, setError] = useState("");
  const [aiResult, setAiResult] = useState<AssistantResponse | null>(null);

  // State untuk daftar jadwal dari Supabase
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Ambil data jadwal dari Supabase saat halaman dibuka
  const fetchSchedules = async () => {
    setLoadingSchedules(true);
    const { data, error } = await supabase
      .from("schedules")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSchedules(data);
    }
    setLoadingSchedules(false);
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  // Simpan jadwal baru ke Supabase
  const saveScheduleToDb = async (title?: string, time?: string) => {
    if (!title) return;
    const { error } = await supabase.from("schedules").insert([
      {
        title: title,
        schedule_time: time || "Waktu belum ditentukan",
      },
    ]);

    if (!error) {
      fetchSchedules(); // Refresh daftar jadwal di layar
    } else {
      setError(`Gagal menyimpan jadwal ke database: ${error.message}`);
    }
  };

  // Tandai jadwal selesai / belum selesai
  const toggleScheduleDone = async (id: number, currentStatus: boolean) => {
    const { error } = await supabase
      .from("schedules")
      .update({ is_done: !currentStatus })
      .eq("id", id);

    if (!error) {
      setSchedules((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, is_done: !currentStatus } : item
        )
      );
    }
  };

  // Hapus jadwal dari Supabase
  const deleteSchedule = async (id: number) => {
    const { error } = await supabase.from("schedules").delete().eq("id", id);

    if (!error) {
      setSchedules((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleOpenApp = (appName?: string) => {
    if (!appName) return;
    const app = appName.toLowerCase();
    const appLinks: Record<string, string> = {
      whatsapp: "https://wa.me/",
      youtube: "https://www.youtube.com",
      instagram: "https://www.instagram.com",
      maps: "https://maps.google.com",
      gmail: "https://mail.google.com",
      github: "https://github.com",
    };
    if (appLinks[app]) window.open(appLinks[app], "_blank");
  };

  const sendToAssistant = async (payload: {
    audioBase64?: string;
    mimeType?: string;
    textInput?: string;
  }) => {
    setIsProcessing(true);
    setError("");
    setAiResult(null);
    setStatusLog("Memproses dengan Gemini...");

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Terjadi kesalahan pada server.");

      setAiResult(data);
      setStatusLog("Selesai!");

      // Eksekusi aksi sesuai intent dari Gemini
      if (data.intent === "open_app") {
        handleOpenApp(data.targetApp);
      } else if (data.intent === "save_schedule") {
        await saveScheduleToDb(data.taskTitle, data.scheduleTime);
      }
    } catch (err: any) {
      setError(err.message);
      setStatusLog("Gagal memproses perintah.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textCommand.trim() || isProcessing) return;
    const cmd = textCommand;
    setTextCommand("");
    sendToAssistant({ textInput: cmd });
  };

  const startRecording = async () => {
    setError("");
    setAiResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const rawMime = mediaRecorder.mimeType || "audio/ogg";
        const cleanMime = rawMime.includes("ogg") ? "audio/ogg" : "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: cleanMime });

        stream.getTracks().forEach((track) => track.stop());
        const base64Audio = await blobToBase64(audioBlob);
        sendToAssistant({ audioBase64: base64Audio, mimeType: cleanMime });
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatusLog("Mendengarkan... Klik tombol merah jika selesai bicara.");
    } catch (err: any) {
      setError(`Gagal mengakses mikrofon: ${err.message}`);
    }
  };

  const toggleRecording = () => {
    if (isProcessing) return;
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      startRecording();
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-10 px-4">
      <div className="max-w-md w-full space-y-6">
        {/* Kartu Utama Asisten */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col items-center text-center">
          <h1 className="text-2xl font-bold tracking-tight mb-1">
            Akhi — AI Assistant
          </h1>
          <p className="text-slate-400 text-xs mb-6">
            Ucapkan jadwal, perintah buka aplikasi, atau pertanyaan
          </p>

          <button
            type="button"
            disabled={isProcessing}
            onClick={toggleRecording}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg cursor-pointer ${
              isProcessing
                ? "bg-slate-700 cursor-not-allowed"
                : isRecording
                ? "bg-red-500 hover:bg-red-600 animate-pulse shadow-red-500/40"
                : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/30"
            }`}
          >
            {isProcessing ? (
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            ) : isRecording ? (
              <Square className="w-8 h-8 text-white fill-white" />
            ) : (
              <Mic className="w-8 h-8 text-white" />
            )}
          </button>

          <p className="mt-3 text-xs text-blue-400 font-mono">{statusLog}</p>

          {/* Form Input Teks Pendamping */}
          <form onSubmit={handleTextSubmit} className="w-full mt-5 flex gap-2">
            <input
              type="text"
              value={textCommand}
              onChange={(e) => setTextCommand(e.target.value)}
              placeholder="Ketik: Catat bimbingan besok jam 10..."
              disabled={isProcessing || isRecording}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={isProcessing || isRecording || !textCommand.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white px-4 rounded-xl flex items-center justify-center transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Hasil Pemrosesan Gemini */}
          {aiResult && (
            <div className="w-full mt-5 text-left space-y-2.5 bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                  Perintah:
                </span>
                <p className="text-sm text-slate-200 italic">
                  "{aiResult.transcript}"
                </p>
              </div>

              <div className="border-t border-slate-800 pt-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-1">
                  {aiResult.intent === "save_schedule" && (
                    <>
                      <Calendar className="w-4 h-4" />
                      <span>Jadwal Tersimpan ke Database</span>
                    </>
                  )}
                  {aiResult.intent === "open_app" && (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      <span>Membuka Aplikasi ({aiResult.targetApp})</span>
                    </>
                  )}
                  {aiResult.intent === "general_chat" && (
                    <>
                      <MessageSquare className="w-4 h-4" />
                      <span>Respons Asisten</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-slate-100">{aiResult.replyMessage}</p>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-4 text-xs text-red-400 bg-red-950/50 border border-red-900 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
        </div>

        {/* Kartu Daftar Jadwal dari Supabase */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>Daftar Jadwal & Agenda</span>
            </h2>
            <span className="text-xs text-slate-500">
              {schedules.length} item
            </span>
          </div>

          {loadingSchedules ? (
            <p className="text-xs text-slate-500 text-center py-4">
              Memuat jadwal...
            </p>
          ) : schedules.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">
              Belum ada jadwal tersimpan. Coba ucapkan "Catat jadwal..."
            </p>
          ) : (
            <ul className="space-y-2.5">
              {schedules.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 bg-slate-950 border border-slate-800/80 rounded-xl p-3"
                >
                  <button
                    type="button"
                    onClick={() => toggleScheduleDone(item.id, item.is_done)}
                    className="flex items-start gap-3 text-left flex-1 cursor-pointer"
                  >
                    {item.is_done ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          item.is_done
                            ? "line-through text-slate-500"
                            : "text-slate-100"
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="text-xs text-blue-400 mt-0.5">
                        {item.schedule_time}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteSchedule(item.id)}
                    className="text-slate-600 hover:text-red-400 p-1 transition cursor-pointer"
                    title="Hapus jadwal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      {/* Kredit Pembuat */}
      <footer className="text-center text-xs text-slate-600 pt-2">
        Akhi AI Personal Assistant • Built by Alfarizi
      </footer>
    </div>
  </main>
  );
}