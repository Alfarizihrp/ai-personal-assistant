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
  BellRing,
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
  BrainCircuit,
  FileText,
  Search,
  BarChart3,
  ArrowUpRight,
  HeartPulse,
} from "lucide-react";

import WellnessTab from "@/components/WellnessTab";

interface RagSource {
  title: string;
  category: string;
  similarity: number;
}

interface AssistantResponse {
  transcript: string;
  intent:
    | "save_schedule"
    | "save_idea"
    | "generate_workout"
    | "log_meal"
    | "open_app"
    | "daily_briefing"
    | "general_chat";
  detectedLang?: "id" | "en" | "ar";
  taskTitle?: string;
  scheduleTime?: string;
  isoDateTime?: string;
  ideaTitle?: string;
  ideaContent?: string;
  workoutGoal?: string;
  mealDescription?: string;
  targetApp?: string;
  replyMessage: string;
  spokenText?: string;
  sources?: RagSource[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  spokenText?: string;
  intent?: string;
  sources?: RagSource[];
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

interface KnowledgeDocItem {
  title: string;
  category: string;
  preview: string;
  chunkCount: number;
  created_at: string;
}

interface GlobalSearchResult {
  schedules: { id: number; title: string; schedule_time: string; is_done: boolean }[];
  ideas: { id: number; title: string; content: string; created_at: string }[];
  knowledge: { id: number; title: string; category: string; snippet: string }[];
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function Home() {
  // State Keamanan HTTP-Only Cookie / JWT Session
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [sessionRole, setSessionRole] = useState<"owner" | "guest" | null>(null);
  const [enteringDemo, setEnteringDemo] = useState(false);

  // State PWA & Background Push Notification
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [subscribingPush, setSubscribingPush] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  // State Pencarian Lintas Data (Global Search)
  const [globalQuery, setGlobalQuery] = useState("");
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const [globalResults, setGlobalResults] = useState<GlobalSearchResult | null>(null);

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

  const [activeTab, setActiveTab] = useState<
    "chat" | "schedules" | "ideas" | "rag" | "wellness" | "analytics"
  >("chat");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const [savingChatId, setSavingChatId] = useState<string | null>(null);
  const [savedChatIds, setSavedChatIds] = useState<Record<string, boolean>>({});

  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // State Form Input Memori Semantik (RAG)
  const [showRagForm, setShowRagForm] = useState(false);
  const [ragTitle, setRagTitle] = useState("");
  const [ragCategory, setRagCategory] = useState("Catatan Ilmu & Kajian");
  const [ragContent, setRagContent] = useState("");
  const [indexingRag, setIndexingRag] = useState(false);
  const [ragFormError, setRagFormError] = useState("");

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
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(async (reg) => {
          const existingSub = await reg.pushManager.getSubscription();
          if (existingSub) {
            setPushSubscribed(true);
          }
        })
        .catch((err) => console.warn("Service Worker registration skipped:", err));
    }
  }, []);

  useEffect(() => {
    const checkServerSession = async () => {
      try {
        const res = await fetch("/api/session", { method: "GET" });
        const data = await res.json();
        setIsUnlocked(Boolean(data.authenticated));
        setSessionRole(data.role || null);
      } catch {
        setIsUnlocked(false);
      } finally {
        setCheckingSession(false);
      }
    };

    try {
      const savedChat = localStorage.getItem("akhi_chat_history");
      if (savedChat) {
        setChatHistory(JSON.parse(savedChat));
      }
    } catch {}

    checkServerSession();
  }, []);

  const handleUnauthorizedResponse = (res: Response) => {
    if (res.status === 401) {
      stopSpeaking();
      setIsUnlocked(false);
      setPinError("Sesi kedaluwarsa. Silakan masukkan PIN kembali.");
      return true;
    }
    return false;
  };

  // Debounced Pencarian Lintas Data (Schedules, Ideas, Knowledge Base)
  useEffect(() => {
    if (!isUnlocked) return;
    const trimmed = globalQuery.trim();

    if (trimmed.length < 2) {
      setGlobalResults(null);
      setSearchingGlobal(false);
      return;
    }

    setSearchingGlobal(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (handleUnauthorizedResponse(res)) return;
        const data = await res.json();
        if (res.ok) {
          setGlobalResults(data);
        }
      } catch {
      } finally {
        setSearchingGlobal(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [globalQuery, isUnlocked]);

  const enableBackgroundPush = async () => {
    if (subscribingPush) return;
    setSubscribingPush(true);
    setError("");

    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Browser ini belum mendukung Web Push Notification.");
      }

      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm !== "granted") {
        throw new Error("Izin notifikasi ditolak di pengaturan browser.");
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY belum terpasang.");
      }

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (handleUnauthorizedResponse(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan langganan push.");

      setPushSubscribed(true);
      speakReply("Alhamdulillaah, notifikasi latar belakang sudah aktif di perangkat ini, Akhi.", false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubscribingPush(false);
    }
  };

  const handleTestBackgroundPush = async () => {
    if (testingPush) return;
    setTestingPush(true);
    setError("");

    try {
      const res = await fetch("/api/push/subscribe", { method: "PUT" });
      if (handleUnauthorizedResponse(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim notifikasi uji coba.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTestingPush(false);
    }
  };

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

      setSessionRole("owner");
      setIsUnlocked(true);
      setPinInput("");
    } catch {
      setPinError("Gagal terhubung ke server verifikasi.");
      setPinInput("");
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleEnterGuestDemo = async () => {
    if (enteringDemo || verifyingPin) return;
    setEnteringDemo(true);
    setPinError("");

    try {
      const res = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "guest" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memulai mode demo.");

      setSessionRole("guest");
      setIsUnlocked(true);
    } catch (err: any) {
      setPinError(err.message);
    } finally {
      setEnteringDemo(false);
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

  const handleLockApp = async () => {
    stopSpeaking();
    try {
      await fetch("/api/verify-pin", { method: "DELETE" });
    } catch {}
    setIsUnlocked(false);
    setSessionRole(null);
    setPinInput("");
    setPinError("");
  };

  const speakReply = (
    text: string,
    isCalmStyle: boolean = false,
    langCode?: "id" | "en" | "ar"
  ) => {
    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    // Deteksi otomatis jika mengandung huruf Arab
    const hasArabic = /[\u0600-\u06FF]/.test(text);
    const effectiveLang = langCode || (hasArabic ? "ar" : "id");

    // Hanya hapus huruf Arab jika bahasa target BUKAN bahasa Arab (misal dalil sisipan pada teks Indonesia)
    const cleanText = (
      effectiveLang === "ar"
        ? text.replace(/[*#_`]/g, "")
        : text.replace(/[\u0600-\u06FF]/g, "").replace(/[*#_`]/g, "")
    )
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();

    if (effectiveLang === "ar") {
      utterance.lang = "ar-SA";
      const arVoice = voices.find((v) => v.lang.toLowerCase().startsWith("ar"));
      if (arVoice) utterance.voice = arVoice;
    } else if (effectiveLang === "en") {
      utterance.lang = "en-US";
      const enVoice =
        voices.find((v) => v.lang.includes("en-US") || v.lang.includes("en-GB")) ||
        voices.find((v) => v.lang.toLowerCase().startsWith("en"));
      if (enVoice) utterance.voice = enVoice;
    } else {
      utterance.lang = "id-ID";
      const idVoice =
        voices.find(
          (v) =>
            (v.lang.includes("id-ID") || v.lang.includes("id_ID")) &&
            (v.name.toLowerCase().includes("ardi") || v.name.toLowerCase().includes("male"))
        ) || voices.find((v) => v.lang.includes("id-ID") || v.lang.includes("id_ID"));
      if (idVoice) utterance.voice = idVoice;
    }

    utterance.rate = isCalmStyle ? 0.9 : 0.98;
    utterance.pitch = isCalmStyle ? 0.92 : 0.96;

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

          await fetch("/api/workspace", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resource: "schedules",
              id: item.id,
              updates: { reminded: true },
            }),
          });

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
    try {
      const [wsRes, ragRes] = await Promise.all([
        fetch("/api/workspace"),
        fetch("/api/knowledge"),
      ]);

      if (handleUnauthorizedResponse(wsRes) || handleUnauthorizedResponse(ragRes)) return [];

      const wsData = await wsRes.json();
      const ragData = await ragRes.json();

      if (!wsRes.ok) throw new Error(wsData.error || "Gagal memuat workspace.");
      if (!ragRes.ok) throw new Error(ragData.error || "Gagal memuat memori RAG.");

      setSchedules(wsData.schedules || []);
      setIdeas(wsData.ideas || []);
      setKnowledgeDocs(ragData.documents || []);
      return wsData.schedules || [];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoadingData(false);
    }
  };

  const handleRagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRagFormError("");

    if (!ragTitle.trim() || !ragContent.trim()) {
      setRagFormError("Judul dan isi materi dokumen wajib diisi.");
      return;
    }

    setIndexingRag(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: ragTitle.trim(),
          category: ragCategory,
          content: ragContent.trim(),
        }),
      });

      if (handleUnauthorizedResponse(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengindeks dokumen.");

      setRagTitle("");
      setRagContent("");
      setShowRagForm(false);
      await fetchAllData();
      speakReply(
        `Alhamdulillaah, catatan ${ragTitle.trim()} berhasil diindeks ke memori semantik sebanyak ${data.chunksSaved} bagian, Akhi.`,
        false
      );
    } catch (err: any) {
      setRagFormError(err.message);
    } finally {
      setIndexingRag(false);
    }
  };

  const handleDeleteKnowledgeDoc = async (title: string) => {
    try {
      const res = await fetch(
        `/api/knowledge?title=${encodeURIComponent(title)}`,
        { method: "DELETE" }
      );
      if (handleUnauthorizedResponse(res)) return;
      if (res.ok) {
        setKnowledgeDocs((prev) => prev.filter((doc) => doc.title !== title));
      }
    } catch (err: any) {
      setError(`Gagal menghapus dokumen: ${err.message}`);
    }
  };

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

      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "schedules",
          id,
          updates: { title: updatedTitle, schedule_time: updatedTime },
        }),
      });

      if (handleUnauthorizedResponse(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

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

      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "ideas",
          id,
          updates: { title: updatedTitle, content: updatedContent },
        }),
      });

      if (handleUnauthorizedResponse(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

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

      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "ideas",
          payload: {
            title: `${labelPrefix} ${shortQuestion}`,
            content: msg.text,
          },
        }),
      });

      if (handleUnauthorizedResponse(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

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

      if (handleUnauthorizedResponse(res)) return;
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
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "schedules",
          payload: {
            title,
            schedule_time: time || "Waktu belum ditentukan",
            target_datetime: isoDateTime || null,
            reminded: false,
          },
        }),
      });

      if (handleUnauthorizedResponse(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await fetchAllData();
      setActiveTab("schedules");
    } catch (err: any) {
      setError(`Gagal menyimpan jadwal: ${err.message}`);
    }
  };

  const saveIdeaToDb = async (title?: string, content?: string): Promise<boolean> => {
    if (!content) return false;
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "ideas",
          payload: {
            title: title || "Catatan Ide",
            content,
          },
        }),
      });

      if (handleUnauthorizedResponse(res)) return false;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await fetchAllData();
      setActiveTab("ideas");
      return true;
    } catch (err: any) {
      const msg = `Gagal menyimpan ide: ${err.message}`;
      setError(msg);
      setIdeaFormError(msg);
      return false;
    }
  };

  const triggerVoiceWorkout = async (goal?: string) => {
  if (!goal) return;
  try {
    const res = await fetch("/api/wellness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_workout", goal }),
    });
    if (handleUnauthorizedResponse(res)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setActiveTab("wellness");
  } catch (err: any) {
    setError(`Gagal membuat skema olahraga: ${err.message}`);
  }
};

const triggerVoiceMealLog = async (description?: string) => {
  if (!description) return;
  try {
    const res = await fetch("/api/wellness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "log_meal_text", description }),
    });
    if (handleUnauthorizedResponse(res)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setActiveTab("wellness");
  } catch (err: any) {
    setError(`Gagal mencatat kalori makanan: ${err.message}`);
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

      if (handleUnauthorizedResponse(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengembangkan ide.");

      const patchRes = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "ideas",
          id: idea.id,
          updates: { ai_expansion: data.expansion },
        }),
      });

      if (handleUnauthorizedResponse(patchRes)) return;
      const patchData = await patchRes.json();
      if (!patchRes.ok) throw new Error(patchData.error);

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
    const res = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: "schedules",
        id,
        updates: { is_done: !currentStatus },
      }),
    });

    if (handleUnauthorizedResponse(res)) return;
    if (res.ok) {
      setSchedules((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, is_done: !currentStatus } : item
        )
      );
    }
  };

  const deleteSchedule = async (id: number) => {
    const res = await fetch(`/api/workspace?resource=schedules&id=${id}`, {
      method: "DELETE",
    });

    if (handleUnauthorizedResponse(res)) return;
    if (res.ok) {
      setSchedules((prev) => prev.filter((item) => item.id !== id));
      if (editingScheduleId === id) cancelEditingSchedule();
    }
  };

  const deleteIdea = async (id: number) => {
    const res = await fetch(`/api/workspace?resource=ideas&id=${id}`, {
      method: "DELETE",
    });

    if (handleUnauthorizedResponse(res)) return;
    if (res.ok) {
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
    setStatusLog("Menyimak & mencari konteks memori...");

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          chatHistory: chatHistory.map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      if (handleUnauthorizedResponse(res)) return;
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
        sources: data.sources || [],
        timestamp: timeStr,
      };

      setChatHistory((prev) => [...prev, userMsg, aiMsg]);
      setStatusLog("Selesai!");

      speakReply(voiceScript, data.intent === "general_chat", data.detectedLang);

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
   } else if (data.intent === "generate_workout") {
     await triggerVoiceWorkout(data.workoutGoal || data.transcript);
   } else if (data.intent === "log_meal") {
     await triggerVoiceMealLog(data.mealDescription || data.transcript);
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

  // --- KALKULASI METRIK ANALITIK PRODUKTIVITAS ---
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

  const totalSearchHits = globalResults
    ? globalResults.schedules.length +
      globalResults.ideas.length +
      globalResults.knowledge.length
    : 0;

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

          <div className="w-full mt-5 pt-4 border-t border-slate-800/80">
            <button
              type="button"
              disabled={enteringDemo || verifyingPin}
              onClick={handleEnterGuestDemo}
              className="w-full py-2.5 px-3 rounded-xl bg-blue-950/60 hover:bg-blue-900/70 border border-blue-800/60 text-blue-300 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {enteringDemo ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyiapkan Sandbox Demo...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mode Demo Tamu (Recruiter Sandbox)</span>
                </>
              )}
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
      <div className="max-w-md w-full space-y-4">
        {sessionRole === "guest" && (
          <div className="bg-amber-950/60 border border-amber-800/60 text-amber-200 text-[11px] px-3.5 py-2 rounded-xl flex items-center justify-between">
            <span>
              <strong>Mode Demo Recruiter:</strong> Data simulasi aktif (database pemilik terlindungi).
            </span>
            <button
              type="button"
              onClick={handleLockApp}
              className="underline font-semibold hover:text-white ml-2 cursor-pointer"
            >
              Keluar
            </button>
          </div>
        )}

        {/* Bar Pencarian Lintas Data (Global Search) */}
        <div className="relative">
          <div className="flex items-center bg-slate-900 border border-slate-800 focus-within:border-blue-500 rounded-2xl px-3.5 py-2.5 shadow-lg transition">
            {searchingGlobal ? (
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0 mr-2.5" />
            ) : (
              <Search className="w-4 h-4 text-slate-500 shrink-0 mr-2.5" />
            )}
            <input
              type="text"
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder="Cari lintas jadwal, ide, faedah & memori RAG..."
              className="flex-1 bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            {globalQuery && (
              <button
                type="button"
                onClick={() => {
                  setGlobalQuery("");
                  setGlobalResults(null);
                }}
                className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                title="Bersihkan pencarian"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Dropdown Hasil Pencarian Lintas Data */}
          {globalResults && globalQuery.trim().length >= 2 && (
            <div className="mt-2 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[11px] font-semibold text-slate-300">
                  Hasil Pencarian Lintas Data ({totalSearchHits})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setGlobalQuery("");
                    setGlobalResults(null);
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Tutup
                </button>
              </div>

              {totalSearchHits === 0 ? (
                <p className="text-xs text-slate-500 text-center py-3">
                  Tidak ditemukan data yang cocok dengan "{globalQuery}".
                </p>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {globalResults.schedules.map((s) => (
                    <button
                      key={`gs-${s.id}`}
                      type="button"
                      onClick={() => {
                        setActiveTab("schedules");
                        setGlobalResults(null);
                      }}
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

                  {globalResults.ideas.map((i) => (
                    <button
                      key={`gi-${i.id}`}
                      type="button"
                      onClick={() => {
                        setActiveTab("ideas");
                        setGlobalResults(null);
                      }}
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

                  {globalResults.knowledge.map((k) => (
                    <button
                      key={`gk-${k.id}`}
                      type="button"
                      onClick={() => {
                        setActiveTab("rag");
                        setGlobalResults(null);
                      }}
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

        {/* Kartu Utama Asisten */}
        <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col items-center text-center">
          <div className="absolute top-4 left-4">
            <button
              type="button"
              onClick={handleLockApp}
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
              onClick={enableBackgroundPush}
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
            Asisten Pribadi, Diskusi Ilmu & Semantic Memory (RAG)
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
              placeholder="Tanya dalil, cari catatan memori, atau jadwal..."
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

        {/* Navigasi 6 Tab (Diskusi, Jadwal, Ide, Memori RAG, Sehat, Analitik) */}
        <div className="grid grid-cols-6 gap-1 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
              activeTab === "chat"
                ? "bg-emerald-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Diskusi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("schedules")}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
              activeTab === "schedules"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Jadwal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ideas")}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
              activeTab === "ideas"
                ? "bg-amber-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Ide</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("rag")}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
              activeTab === "rag"
                ? "bg-purple-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>Memori</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("wellness")}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
              activeTab === "wellness"
                ? "bg-rose-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5" />
            <span>Sehat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
              activeTab === "analytics"
                ? "bg-cyan-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analitik</span>
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
                Belum ada diskusi, Akhi. Ajukan pertanyaan seputar ilmu, atau tanyakan isi dokumen yang sudah diindeks di tab Memori.
              </p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {(() => {
                  // Kelompokkan pesan menjadi pasangan [User, Assistant] lalu tampilkan yang terbaru di paling atas
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

                  return turns.reverse().map((turn, tIdx) => (
                    <div key={tIdx} className="space-y-2 pb-3 border-b border-slate-800/60 last:border-b-0">
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
                                    onClick={() => handleSaveFaedahToWorkspace(msg, origIdx)}
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

                            {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
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
                  ));
                })()}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Daftar Jadwal */}
        {activeTab === "schedules" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-400" />
                <span>Agenda & Pengingat</span>
              </h2>

              {pushSubscribed ? (
                <button
                  type="button"
                  disabled={testingPush}
                  onClick={handleTestBackgroundPush}
                  className="text-[11px] bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-800/60 text-emerald-300 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  {testingPush ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <BellRing className="w-3 h-3" />
                  )}
                  <span>{testingPush ? "Mengirim..." : "Test Push HP"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={subscribingPush}
                  onClick={enableBackgroundPush}
                  className="text-[11px] bg-amber-950/70 hover:bg-amber-900/70 border border-amber-800/60 text-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Bell className="w-3 h-3" />
                  <span>Aktifkan Push Latar Belakang</span>
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

        {/* Tab 3: Workspace Ide & Faedah */}
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

        {/* Tab 4: Semantic Memory & RAG Knowledge Base */}
        {activeTab === "rag" && (
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
                onClick={() => {
                  setShowRagForm(!showRagForm);
                  setRagFormError("");
                }}
                className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Indeks Teks</span>
              </button>
            </div>

            {showRagForm && (
              <form
                onSubmit={handleRagSubmit}
                className="bg-slate-950 border border-purple-900/50 rounded-xl p-3.5 space-y-2.5"
              >
                <input
                  type="text"
                  value={ragTitle}
                  onChange={(e) => setRagTitle(e.target.value)}
                  placeholder="Judul dokumen (misal: Ringkasan Kitab Tauhid / Arsitektur Sistem)..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />

                <select
                  value={ragCategory}
                  onChange={(e) => setRagCategory(e.target.value)}
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
                  onChange={(e) => setRagContent(e.target.value)}
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
                    onClick={() => setShowRagForm(false)}
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
                Belum ada dokumen terindeks. Klik "+ Indeks Teks" untuk menambahkan materi kajian, catatan proyek, atau ringkasan buku agar bisa dicari secara semantik oleh asisten.
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
                        onClick={() => handleDeleteKnowledgeDoc(doc.title)}
                        className="text-slate-600 hover:text-red-400 p-1 transition cursor-pointer"
                        title="Hapus dokumen dari memori vektor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {doc.preview}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Kesehatan (AI Calorie Scanner & Workout Monitor) */}
        {activeTab === "wellness" && <WellnessTab />}

        {/* Tab 6: Dashboard Analitik Produktivitas */}
        {activeTab === "analytics" && (
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
                onClick={fetchAllData}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                title="Segarkan metrik analitik"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            {/* Grid 4 Kartu Metrik Utama */}
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

            {/* Progress Bars Produktivitas */}
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

            {/* Distribusi Kategori Semantic Memory */}
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
        )}

        {/* Kredit Pembuat */}
        <footer className="text-center text-xs text-slate-600 pt-2">
          AI Personal Assistant • Built by Alfarizi
        </footer>
      </div>
    </main>
  );
}