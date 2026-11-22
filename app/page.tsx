"use client";

import { useState, useRef, useEffect } from "react";
import {
  Mic,
  Square,
  Loader2,
  Calendar,
  MessageSquare,
  Send,
  CheckCircle2,
  Circle,
  Trash2,
  Volume2,
  VolumeX,
  Lightbulb,
  Bell,
  Plus,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sun,
  BookmarkPlus,
  Check,
  Lock,
  ShieldCheck,
  Delete,
  Pencil,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AssistantResponse {
  transcript: string;
  intent: "save_schedule" | "save_idea" | "open_app" | "daily_briefing" | "general_chat";
  taskTitle?: string;
  scheduleTime?: string;
  isoDateTime?: string;
  ideaTitle?: string;
  ideaContent?: string;
  targetApp?: string;
  replyMessage: string;
  spokenText?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  spokenText?: string;
  intent?: string;
  timestamp: string;
}

interface ScheduleItem {
  id: number;
  title: string;
  schedule_time: string;
  target_datetime?: string;
  is_done: boolean;
  reminded?: boolean;
}

interface IdeaItem {
  id: number;
  title: string;
  content: string;
  ai_expansion?: string | null;
  created_at: string;
}

export default function Home() {
  // State Keamanan PIN Lock
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);

  // State Asisten Utama
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [notifPermission, setNotifPermission] = useState<string>("default");

  const [textCommand, setTextCommand] = useState("");
  const [statusLog, setStatusLog] = useState("Siap mendengarkan perintahmu, Akhi");
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState<"chat" | "schedules" | "ideas">("chat");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const [savingChatId, setSavingChatId] = useState<string | null>(null);
  const [savedChatIds, setSavedChatIds] = useState<Record<string, boolean>>({});

  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // State Edit Jadwal
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [editScheduleTitle, setEditScheduleTitle] = useState("");
  const [editScheduleTime, setEditScheduleTime] = useState("");
  const [savingEditSchedule, setSavingEditSchedule] = useState(false);

  // State Edit Catatan Ide / Faedah
  const [editingIdeaId, setEditingIdeaId] = useState<number | null>(null);
  const [editIdeaTitle, setEditIdeaTitle] = useState("");
  const [editIdeaContent, setEditIdeaContent] = useState("");
  const [savingEditIdea, setSavingEditIdea] = useState(false);

  const [expandingIdeaId, setExpandingIdeaId] = useState<number | null>(null);
  const [collapsedExpansions, setCollapsedExpansions] = useState<Record<number, boolean>>({});

  const [manualIdeaTitle, setManualIdeaTitle] = useState("");
  const [manualIdeaContent, setManualIdeaContent] = useState("");
  const [showIdeaForm, setShowIdeaForm] = useState(false);
  const [savingManualIdea, setSavingManualIdea] = useState(false);
  const [ideaFormError, setIdeaFormError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const unlockedSession = sessionStorage.getItem("akhi_assistant_unlocked");
      if (unlockedSession === "true") {
        setIsUnlocked(true);
      }
      const savedChat = localStorage.getItem("akhi_chat_history");
      if (savedChat) {
        setChatHistory(JSON.parse(savedChat));
      }
    } catch {}
    setCheckingSession(false);
  }, []);

  const verifyPinCode = async (codeToVerify: string) => {
    if (verifyingPin || codeToVerify.length < 6) return;
    setVerifyingPin(true);
    setPinError("");

    try {
      const res = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: codeToVerify }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPinError(data.error || "PIN salah.");
        setPinInput("");
        return;
      }

      sessionStorage.setItem("akhi_assistant_unlocked", "true");
      setIsUnlocked(true);
      setPinInput("");
    } catch {
      setPinError("Gagal terhubung ke server verifikasi.");
      setPinInput("");
    } finally {
      setVerifyingPin(false);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (verifyingPin || pinInput.length >= 6) return;
    setPinError("");
    const nextPin = pinInput + digit;
    setPinInput(nextPin);

    if (nextPin.length === 6) {
      verifyPinCode(nextPin);
    }
  };

  const handlePinBackspace = () => {
    if (verifyingPin) return;
    setPinError("");
    setPinInput((prev) => prev.slice(0, -1));
  };

  useEffect(() => {
    if (isUnlocked || checkingSession) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handlePinDigit(e.key);
      } else if (e.key === "Backspace") {
        handlePinBackspace();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isUnlocked, checkingSession, pinInput, verifyingPin]);

  const handleLockApp = () => {
    stopSpeaking();
    sessionStorage.removeItem("akhi_assistant_unlocked");
    setIsUnlocked(false);
    setPinInput("");
    setPinError("");
  };

  useEffect(() => {
    try {
      localStorage.setItem("akhi_chat_history", JSON.stringify(chatHistory));
    } catch {}
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const speakReply = (text: string, isCalmStyle: boolean = false) => {
    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const cleanText = text
      .replace(/[\u0600-\u06FF]/g, "")
      .replace(/[*#_`]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "id-ID";

    const voices = window.speechSynthesis.getVoices();
    const idVoice =
      voices.find(
        (v) =>
          (v.lang.includes("id-ID") || v.lang.includes("id_ID")) &&
          (v.name.toLowerCase().includes("ardi") || v.name.toLowerCase().includes("male"))
      ) || voices.find((v) => v.lang.includes("id-ID") || v.lang.includes("id_ID"));

    if (idVoice) {
      utterance.voice = idVoice;
    }

    if (isCalmStyle) {
      utterance.rate = 0.90;
      utterance.pitch = 0.90;
    } else {
      utterance.rate = 0.98;
      utterance.pitch = 0.96;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const playReminderTone = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.4);
    } catch {}
  };

  const requestNotificationPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    }
  };

  useEffect(() => {
    if (!isUnlocked) return;

    if (typeof window !== "undefined") {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.getVoices();
        };
      }
      if ("Notification" in window) setNotifPermission(Notification.permission);
    }
    fetchAllData();
  }, [isUnlocked]);

  useEffect(() => {
    if (!isUnlocked) return;

    const interval = setInterval(async () => {
      const now = new Date().getTime();

      for (const item of schedules) {
        if (item.is_done || item.reminded || !item.target_datetime) continue;

        const targetTime = new Date(item.target_datetime).getTime();
        const diffMinutes = (targetTime - now) / (1000 * 60);

        if (diffMinutes <= 15 && diffMinutes >= -30) {
          playReminderTone();
          const reminderText =
            diffMinutes > 1
              ? `Assalaamu 'alaikum Akhi, ${Math.ceil(diffMinutes)} menit lagi ada jadwal ${item.title}.`
              : `Assalaamu 'alaikum Akhi, waktunya sekarang untuk ${item.title}.`;

          speakReply(reminderText, false);

          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Pengingat Jadwal — Asisten Akhi", {
              body: `${item.title} (${item.schedule_time})`,
            });
          }

          await supabase
            .from("schedules")
            .update({ reminded: true })
            .eq("id", item.id);

          setSchedules((prev) =>
            prev.map((s) => (s.id === item.id ? { ...s, reminded: true } : s))
          );
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [schedules, voiceEnabled, isUnlocked]);

  const fetchAllData = async () => {
    setLoadingData(true);
    const [schedRes, ideaRes] = await Promise.all([
      supabase.from("schedules").select("*").order("created_at", { ascending: false }),
      supabase.from("ideas").select("*").order("created_at", { ascending: false }),
    ]);

    if (!schedRes.error && schedRes.data) setSchedules(schedRes.data);
    if (!ideaRes.error && ideaRes.data) setIdeas(ideaRes.data);
    setLoadingData(false);
    return schedRes.data || [];
  };

  // --- FUNGSI EDIT JADWAL ---
  const startEditingSchedule = (item: ScheduleItem) => {
    setEditingScheduleId(item.id);
    setEditScheduleTitle(item.title);
    setEditScheduleTime(item.schedule_time);
    setError("");
  };

  const cancelEditingSchedule = () => {
    setEditingScheduleId(null);
    setEditScheduleTitle("");
    setEditScheduleTime("");
  };

  const handleSaveScheduleEdit = async (id: number) => {
    if (!editScheduleTitle.trim() || savingEditSchedule) return;
    setSavingEditSchedule(true);
    setError("");

    try {
      const updatedTitle = editScheduleTitle.trim();
      const updatedTime = editScheduleTime.trim() || "Waktu belum ditentukan";

      const { error: dbErr } = await supabase
        .from("schedules")
        .update({
          title: updatedTitle,
          schedule_time: updatedTime,
        })
        .eq("id", id);

      if (dbErr) throw new Error(dbErr.message);

      setSchedules((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, title: updatedTitle, schedule_time: updatedTime }
            : item
        )
      );
      cancelEditingSchedule();
    } catch (err: any) {
      setError(`Gagal memperbarui jadwal: ${err.message}`);
    } finally {
      setSavingEditSchedule(false);
    }
  };

  // --- FUNGSI EDIT CATATAN IDE / FAEDAH ---
  const startEditingIdea = (idea: IdeaItem) => {
    setEditingIdeaId(idea.id);
    setEditIdeaTitle(idea.title);
    setEditIdeaContent(idea.content);
    setError("");
  };

  const cancelEditingIdea = () => {
    setEditingIdeaId(null);
    setEditIdeaTitle("");
    setEditIdeaContent("");
  };

  const handleSaveIdeaEdit = async (id: number) => {
    if (!editIdeaContent.trim() || savingEditIdea) return;
    setSavingEditIdea(true);
    setError("");

    try {
      const updatedTitle = editIdeaTitle.trim() || "Catatan Ide";
      const updatedContent = editIdeaContent.trim();

      const { error: dbErr } = await supabase
        .from("ideas")
        .update({
          title: updatedTitle,
          content: updatedContent,
        })
        .eq("id", id);

      if (dbErr) throw new Error(dbErr.message);

      setIdeas((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, title: updatedTitle, content: updatedContent }
            : item
        )
      );
      cancelEditingIdea();
    } catch (err: any) {
      setError(`Gagal memperbarui catatan: ${err.message}`);
    } finally {
      setSavingEditIdea(false);
    }
  };

  const handleSaveFaedahToWorkspace = async (msg: ChatMessage, index: number) => {
    if (savingChatId || savedChatIds[msg.id]) return;
    setSavingChatId(msg.id);
    setError("");

    try {
      const prevUserMsg =
        index > 0 && chatHistory[index - 1]?.role === "user"
          ? chatHistory[index - 1].text
          : "Catatan Faedah Diskusi";

      const shortQuestion =
        prevUserMsg.length > 55 ? `${prevUserMsg.slice(0, 55)}...` : prevUserMsg;

      const labelPrefix =
        msg.intent === "daily_briefing" ? "[Briefing & Faedah]" : "[Faedah Ilmu]";

      const { error: dbErr } = await supabase.from("ideas").insert([
        {
          title: `${labelPrefix} ${shortQuestion}`,
          content: msg.text,
        },
      ]);

      if (dbErr) throw new Error(dbErr.message);

      await fetchAllData();
      setSavedChatIds((prev) => ({ ...prev, [msg.id]: true }));
      speakReply("Faedah diskusi sudah tersimpan ke Workspace, Akhi.", false);
    } catch (err: any) {
      setError(`Gagal menyimpan faedah: ${err.message}`);
    } finally {
      setSavingChatId(null);
    }
  };

  const triggerDailyBriefing = async (customTranscript?: string) => {
    if (isBriefingLoading || isProcessing) return;
    setIsBriefingLoading(true);
    setError("");
    stopSpeaking();
    setStatusLog("Menyiapkan ringkasan agenda & faedah...");

    try {
      const latestSchedules = await fetchAllData();

      const res = await fetch("/api/daily-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules: latestSchedules }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat Daily Briefing.");

      const timeStr = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const userMsg: ChatMessage = {
        id: `${Date.now()}-ub`,
        role: "user",
        text: customTranscript || "Briefing Agenda & Faedah Hari Ini",
        timestamp: timeStr,
      };
      const aiMsg: ChatMessage = {
        id: `${Date.now()}-ab`,
        role: "assistant",
        text: data.replyMessage,
        spokenText: data.spokenText || data.replyMessage,
        intent: "daily_briefing",
        timestamp: timeStr,
      };

      setChatHistory((prev) => [...prev, userMsg, aiMsg]);
      setActiveTab("chat");
      setStatusLog("Briefing siap!");

      speakReply(data.spokenText || data.replyMessage, true);
    } catch (err: any) {
      setError(err.message);
      setStatusLog("Gagal menyiapkan briefing.");
    } finally {
      setIsBriefingLoading(false);
    }
  };

  const saveScheduleToDb = async (title?: string, time?: string, isoDateTime?: string) => {
    if (!title) return;
    const { error } = await supabase.from("schedules").insert([
      {
        title,
        schedule_time: time || "Waktu belum ditentukan",
        target_datetime: isoDateTime || null,
        reminded: false,
      },
    ]);

    if (!error) {
      await fetchAllData();
      setActiveTab("schedules");
    } else {
      setError(`Gagal menyimpan jadwal: ${error.message}`);
    }
  };

  const saveIdeaToDb = async (title?: string, content?: string): Promise<boolean> => {
    if (!content) return false;
    const { error: dbErr } = await supabase.from("ideas").insert([
      {
        title: title || "Catatan Ide",
        content,
      },
    ]);

    if (!dbErr) {
      await fetchAllData();
      setActiveTab("ideas");
      return true;
    } else {
      const msg = `Gagal menyimpan ide ke Supabase: ${dbErr.message}`;
      setError(msg);
      setIdeaFormError(msg);
      return false;
    }
  };

  const handleExpandIdea = async (idea: IdeaItem) => {
    if (expandingIdeaId !== null) return;
    setExpandingIdeaId(idea.id);
    setError("");

    try {
      const res = await fetch("/api/expand-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: idea.title,
          content: idea.content,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengembangkan ide.");

      const { error: dbError } = await supabase
        .from("ideas")
        .update({ ai_expansion: data.expansion })
        .eq("id", idea.id);

      if (dbError) throw new Error(dbError.message);

      setIdeas((prev) =>
        prev.map((item) =>
          item.id === idea.id ? { ...item, ai_expansion: data.expansion } : item
        )
      );
      setCollapsedExpansions((prev) => ({ ...prev, [idea.id]: false }));
      speakReply(`Alhamdulillaah, ide ${idea.title} sudah selesai dijabarkan, Akhi.`, false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExpandingIdeaId(null);
    }
  };

  const toggleCollapseExpansion = (id: number) => {
    setCollapsedExpansions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleManualIdeaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIdeaFormError("");
    if (!manualIdeaContent.trim()) {
      setIdeaFormError("Isi detail ide terlebih dahulu.");
      return;
    }

    setSavingManualIdea(true);
    const success = await saveIdeaToDb(
      manualIdeaTitle.trim() || "Catatan Ide",
      manualIdeaContent.trim()
    );
    setSavingManualIdea(false);

    if (success) {
      setManualIdeaTitle("");
      setManualIdeaContent("");
      setShowIdeaForm(false);
    }
  };

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

  const deleteSchedule = async (id: number) => {
    const { error } = await supabase.from("schedules").delete().eq("id", id);
    if (!error) {
      setSchedules((prev) => prev.filter((item) => item.id !== id));
      if (editingScheduleId === id) cancelEditingSchedule();
    }
  };

  const deleteIdea = async (id: number) => {
    const { error } = await supabase.from("ideas").delete().eq("id", id);
    if (!error) {
      setIdeas((prev) => prev.filter((item) => item.id !== id));
      if (editingIdeaId === id) cancelEditingIdea();
    }
  };

  const clearChatHistory = () => {
    stopSpeaking();
    setChatHistory([]);
    setSavedChatIds({});
    localStorage.removeItem("akhi_chat_history");
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
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
    setStatusLog("Menyimak & menyiapkan jawaban...");

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          chatHistory: chatHistory.map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      const data: AssistantResponse & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || "Terjadi kesalahan pada server.");

      if (data.intent === "daily_briefing") {
        setIsProcessing(false);
        await triggerDailyBriefing(data.transcript);
        return;
      }

      const timeStr = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const voiceScript = data.spokenText || data.replyMessage;

      const userMsg: ChatMessage = {
        id: `${Date.now()}-u`,
        role: "user",
        text: data.transcript,
        timestamp: timeStr,
      };
      const aiMsg: ChatMessage = {
        id: `${Date.now()}-a`,
        role: "assistant",
        text: data.replyMessage,
        spokenText: voiceScript,
        intent: data.intent,
        timestamp: timeStr,
      };

      setChatHistory((prev) => [...prev, userMsg, aiMsg]);
      setStatusLog("Selesai!");

      speakReply(voiceScript, data.intent === "general_chat");

      if (data.intent === "open_app") {
        handleOpenApp(data.targetApp);
      } else if (data.intent === "save_schedule") {
        await saveScheduleToDb(
          data.taskTitle || data.transcript,
          data.scheduleTime,
          data.isoDateTime
        );
      } else if (data.intent === "save_idea") {
        await saveIdeaToDb(
          data.ideaTitle || "Catatan Ide Suara",
          data.ideaContent || data.transcript
        );
      } else {
        setActiveTab("chat");
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
    stopSpeaking();

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
    if (isProcessing || isBriefingLoading) return;
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      startRecording();
    }
  };

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </main>
    );
  }

  if (!isUnlocked) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-4">
        <div className="max-w-xs w-full bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-950/70 border border-blue-800/60 flex items-center justify-center mb-4">
            {verifyingPin ? (
              <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
            ) : (
              <ShieldCheck className="w-7 h-7 text-blue-400" />
            )}
          </div>

          <h1 className="text-lg font-bold tracking-tight">Akses Pribadi Akhi</h1>
          <p className="text-xs text-slate-400 mt-1 mb-6">
            Masukkan 6 digit PIN untuk membuka asisten
          </p>

          <div className="flex items-center justify-center gap-3 mb-5">
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const isFilled = idx < pinInput.length;
              return (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                    isFilled
                      ? "bg-blue-500 scale-110 shadow-sm shadow-blue-500/50"
                      : "bg-slate-800 border border-slate-700"
                  }`}
                />
              );
            })}
          </div>

          {pinError && (
            <p className="text-xs text-red-400 bg-red-950/50 border border-red-900/60 px-3 py-1.5 rounded-lg mb-4 w-full">
              {pinError}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2.5 w-full">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                type="button"
                disabled={verifyingPin}
                onClick={() => handlePinDigit(num)}
                className="h-14 rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-95 border border-slate-800/90 text-lg font-semibold text-slate-100 transition cursor-pointer disabled:opacity-50"
              >
                {num}
              </button>
            ))}

            <div className="h-14" />

            <button
              type="button"
              disabled={verifyingPin}
              onClick={() => handlePinDigit("0")}
              className="h-14 rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-95 border border-slate-800/90 text-lg font-semibold text-slate-100 transition cursor-pointer disabled:opacity-50"
            >
              0
            </button>

            <button
              type="button"
              disabled={verifyingPin || pinInput.length === 0}
              onClick={handlePinBackspace}
              className="h-14 rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-95 border border-slate-800/90 flex items-center justify-center text-slate-400 hover:text-red-400 transition cursor-pointer disabled:opacity-40"
              title="Hapus digit"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          <p className="text-[11px] text-slate-600 mt-6">
            AI Personal Assistant • Built by Alfarizi
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-8 px-4">
      <div className="max-w-md w-full space-y-5">
        {/* Kartu Utama Asisten */}
        <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col items-center text-center">
          <div className="absolute top-4 left-4">
            <button
              type="button"
              onClick={handleLockApp}
              title="Kunci layar aplikasi"
              className="p-2 rounded-xl border bg-slate-950 border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-900/60 transition cursor-pointer"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>

          <div className="absolute top-4 right-4 flex items-center gap-1.5">
            {notifPermission !== "granted" && (
              <button
                type="button"
                onClick={requestNotificationPermission}
                title="Aktifkan Notifikasi Pengingat"
                className="p-2 rounded-xl border bg-amber-950/40 border-amber-800/60 text-amber-400 hover:bg-amber-900/50 transition cursor-pointer"
              >
                <Bell className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (voiceEnabled) stopSpeaking();
                setVoiceEnabled(!voiceEnabled);
              }}
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
            Asisten Pribadi & Diskusi Ilmu untuk Akhi
          </p>

          <button
            type="button"
            disabled={isProcessing || isBriefingLoading}
            onClick={toggleRecording}
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
                onClick={stopSpeaking}
                className="text-[11px] bg-red-950/70 border border-red-800/60 text-red-300 px-2 py-0.5 rounded cursor-pointer"
              >
                Stop Suara
              </button>
            )}
          </div>

          <form onSubmit={handleTextSubmit} className="w-full mt-5 flex gap-2">
            <input
              type="text"
              value={textCommand}
              onChange={(e) => setTextCommand(e.target.value)}
              placeholder="Tanya dalil, catat jadwal, atau ide..."
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
            onClick={() => triggerDailyBriefing()}
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

        {/* Navigasi 3 Tab */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "chat"
                ? "bg-emerald-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Diskusi ({Math.floor(chatHistory.length / 2)})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("schedules")}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "schedules"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Jadwal ({schedules.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ideas")}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "ideas"
                ? "bg-amber-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Workspace ({ideas.length})</span>
          </button>
        </div>

        {/* Tab 1: Riwayat Diskusi */}
        {activeTab === "chat" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>Riwayat Diskusi & Briefing</span>
              </h2>
              {chatHistory.length > 0 && (
                <button
                  type="button"
                  onClick={clearChatHistory}
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
                Belum ada diskusi, Akhi. Klik tombol "Briefing Agenda & Faedah Hari Ini" di atas atau ajukan pertanyaan seputar ilmu & adab.
              </p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {chatHistory.map((msg, idx) => {
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
                              onClick={() => handleSaveFaedahToWorkspace(msg, idx)}
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
                                speakReply(
                                  msg.spokenText || msg.text,
                                  msg.intent === "general_chat" || msg.intent === "daily_briefing"
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
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Daftar Jadwal (Dengan Fitur Edit) */}
        {activeTab === "schedules" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-400" />
                <span>Agenda & Pengingat Otomatis</span>
              </h2>
              {notifPermission !== "granted" && (
                <button
                  type="button"
                  onClick={requestNotificationPermission}
                  className="text-[11px] text-amber-400 underline cursor-pointer"
                >
                  Izinkan Notifikasi
                </button>
              )}
            </div>

            {loadingData ? (
              <p className="text-xs text-slate-500 text-center py-4">Memuat agenda...</p>
            ) : schedules.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                Belum ada jadwal. Coba ucapkan "Ingatkan kajian besok jam 8 malam".
              </p>
            ) : (
              <ul className="space-y-2.5">
                {schedules.map((item) => {
                  const isEditingThis = editingScheduleId === item.id;

                  return (
                    <li
                      key={item.id}
                      className="bg-slate-950 border border-slate-800/80 rounded-xl p-3"
                    >
                      {isEditingThis ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editScheduleTitle}
                            onChange={(e) => setEditScheduleTitle(e.target.value)}
                            placeholder="Nama agenda..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                          />
                          <input
                            type="text"
                            value={editScheduleTime}
                            onChange={(e) => setEditScheduleTime(e.target.value)}
                            placeholder="Waktu agenda (misal: Besok jam 08.00 WIB)..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                          />
                          <div className="flex justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={cancelEditingSchedule}
                              className="text-[11px] text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                              <span>Batal</span>
                            </button>
                            <button
                              type="button"
                              disabled={savingEditSchedule || !editScheduleTitle.trim()}
                              onClick={() => handleSaveScheduleEdit(item.id)}
                              className="text-[11px] bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-3 py-1 rounded flex items-center gap-1 cursor-pointer"
                            >
                              {savingEditSchedule ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                              <span>Simpan</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
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
                                  item.is_done ? "line-through text-slate-500" : "text-slate-100"
                                }`}
                              >
                                {item.title}
                              </p>
                              <p className="text-xs text-blue-400 mt-0.5">{item.schedule_time}</p>
                              {item.target_datetime && !item.is_done && (
                                <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-900/50">
                                  {item.reminded ? "Sudah diingatkan" : "Pengingat aktif (H-15 mnt)"}
                                </span>
                              )}
                            </div>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditingSchedule(item)}
                              className="text-slate-500 hover:text-blue-400 p-1.5 transition cursor-pointer"
                              title="Edit jadwal"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSchedule(item.id)}
                              className="text-slate-600 hover:text-red-400 p-1.5 transition cursor-pointer"
                              title="Hapus jadwal"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Tab 3: Workspace Ide & Faedah (Dengan Fitur Edit) */}
        {activeTab === "ideas" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <span>Workspace Ide & Catatan Faedah</span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowIdeaForm(!showIdeaForm);
                  setIdeaFormError("");
                }}
                className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tulis Catatan</span>
              </button>
            </div>

            {showIdeaForm && (
              <form
                onSubmit={handleManualIdeaSubmit}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5"
              >
                <input
                  type="text"
                  value={manualIdeaTitle}
                  onChange={(e) => setManualIdeaTitle(e.target.value)}
                  placeholder="Judul ide atau catatan (opsional)..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
                <textarea
                  rows={3}
                  value={manualIdeaContent}
                  onChange={(e) => setManualIdeaContent(e.target.value)}
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
                    onClick={() => setShowIdeaForm(false)}
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
                Workspace masih kosong. Ucapkan "Catat ide...", klik "+ Tulis Catatan", atau simpan faedah dari tab Diskusi.
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
                            onChange={(e) => setEditIdeaTitle(e.target.value)}
                            placeholder="Judul catatan..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                          />
                          <textarea
                            rows={4}
                            value={editIdeaContent}
                            onChange={(e) => setEditIdeaContent(e.target.value)}
                            placeholder="Isi catatan atau konsep ide..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEditingIdea}
                              className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1 rounded flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Batal</span>
                            </button>
                            <button
                              type="button"
                              disabled={savingEditIdea || !editIdeaContent.trim()}
                              onClick={() => handleSaveIdeaEdit(idea.id)}
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
                                onClick={() => startEditingIdea(idea)}
                                className="text-slate-500 hover:text-amber-300 p-1 transition cursor-pointer"
                                title="Edit catatan"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteIdea(idea.id)}
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
                                  onClick={() => toggleCollapseExpansion(idea.id)}
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
                                onClick={() => handleExpandIdea(idea)}
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
        )}

        {/* Kredit Pembuat */}
        <footer className="text-center text-xs text-slate-600 pt-2">
          AI Personal Assistant • Built by Alfarizi
        </footer>
      </div>
    </main>
  );
}